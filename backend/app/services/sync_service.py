from datetime import datetime

from .. import models
from ..providers.base import GitProvider
from ..providers.github import GitHubProvider, parse_github_time
from ..security import decrypt_token


def _provider_factory(repo: models.Repository, token: str) -> GitProvider:
    if repo.platform == "github":
        return GitHubProvider(repo.repo_path, token)
    raise ValueError(f"不支持的平台: {repo.platform}")


def sync_repository(db, repo: models.Repository, master_key: str,
                    provider_factory=None, recompute=None) -> models.SyncRun:
    """增量同步一个仓库（幂等）。recompute(db) 在成功后回调（T5/T8 注入）。"""
    factory = provider_factory or _provider_factory
    run = models.SyncRun(repository_id=repo.id, status="running",
                         started_at=datetime.utcnow())
    db.add(run)
    db.commit()
    db.refresh(run)
    try:
        token = decrypt_token(repo.token_encrypted, master_key)
        provider = factory(repo, token)
        since = repo.last_synced_at.isoformat() if repo.last_synced_at else None
        commits = provider.list_commits(since=since)
        fetched = 0
        for c in commits:
            exists = db.query(models.Commit).filter_by(repository_id=repo.id, sha=c.sha).first()
            if not exists:
                db.add(models.Commit(
                    repository_id=repo.id, sha=c.sha, author_name=c.author_name,
                    author_email=c.author_email, committed_at=parse_github_time(c.committed_at),
                    add_lines=c.add_lines, del_lines=c.del_lines, files_changed=c.files_changed,
                ))
                fetched += 1
        repo.last_synced_at = datetime.utcnow()
        run.status = "success"
        run.finished_at = datetime.utcnow()
        run.commits_fetched = fetched
        db.commit()
        if recompute:
            recompute(db)
    except Exception as e:  # noqa: BLE001
        db.rollback()
        run.status = "failed"
        run.finished_at = datetime.utcnow()
        run.error_message = str(e)
        db.commit()
    return run
