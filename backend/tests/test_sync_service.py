from app import models
from app.providers.base import CommitInfo
from app.security import encrypt_token
from app.services.sync_service import sync_repository


class FakeProvider:
    def __init__(self, commits):
        self._commits = commits

    def list_commits(self, since=None):
        return self._commits


def make_repo(db):
    proj = models.Project(name="P")
    db.add(proj)
    db.commit()
    repo = models.Repository(project_id=proj.id, platform="github", repo_path="org/repo",
                             token_encrypted=encrypt_token("ghp_fake", "mk"), token_last4="ake0")
    db.add(repo)
    db.commit()
    return repo


def fake_commits():
    return [
        CommitInfo(sha="s1", author_name="Alice", author_email="a@x.com",
                   committed_at="2026-01-05T09:30:00Z", add_lines=10, del_lines=2, files_changed=1),
        CommitInfo(sha="s2", author_name="Bob", author_email="b@x.com",
                   committed_at="2026-01-05T10:00:00Z", add_lines=5, del_lines=0, files_changed=2),
    ]


def test_sync_inserts_commits(db_session):
    repo = make_repo(db_session)
    run = sync_repository(db_session, repo, "mk", provider_factory=lambda _r, _t: FakeProvider(fake_commits()))
    assert run.status == "success"
    assert db_session.query(models.Commit).filter_by(repository_id=repo.id).count() == 2


def test_sync_idempotent(db_session):
    repo = make_repo(db_session)
    for _ in range(2):
        sync_repository(db_session, repo, "mk", provider_factory=lambda _r, _t: FakeProvider(fake_commits()))
    assert db_session.query(models.Commit).filter_by(repository_id=repo.id).count() == 2


def test_sync_failure_keeps_data(db_session):
    repo = make_repo(db_session)

    class BoomProvider:
        def list_commits(self, since=None):
            raise RuntimeError("token invalid")

    run = sync_repository(db_session, repo, "mk", provider_factory=lambda _r, _t: BoomProvider())
    assert run.status == "failed"
    assert "token invalid" in run.error_message
    assert db_session.query(models.Commit).filter_by(repository_id=repo.id).count() == 0
