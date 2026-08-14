from app.config import settings
from app.scheduler import run_all_syncs, start_scheduler


def test_disabled_returns_none(monkeypatch):
    monkeypatch.setattr(settings, "sync_interval_hours", 0)
    assert start_scheduler(None, "mk") is None


def test_enabled_starts_and_stops(monkeypatch):
    monkeypatch.setattr(settings, "sync_interval_hours", 1)

    class FakeJob:
        def __init__(self, fn):
            self.fn = fn

    def fake_add_job(self, fn, trigger, hours=None, args=None):
        return FakeJob(fn)

    from apscheduler.schedulers.background import BackgroundScheduler
    monkeypatch.setattr(BackgroundScheduler, "add_job", fake_add_job)
    scheduler = start_scheduler(None, "mk")
    assert scheduler is not None
    scheduler.shutdown(wait=False)


def test_run_all_syncs_iterates_repos(db_session, monkeypatch):
    from app import models
    repo = models.Repository(project_id=1, platform="github", repo_path="org/repo",
                             token_encrypted="x", token_last4="abcd")
    db_session.add(repo)
    db_session.commit()

    calls = []

    def fake_sync(db, repo_, master_key, recompute=None):
        calls.append(repo_.id)

    from app.services import sync_service
    monkeypatch.setattr(sync_service, "sync_repository", fake_sync)
    run_all_syncs(lambda: db_session, "mk")
    assert calls == [repo.id]
