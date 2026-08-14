from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..security import ensure_master_key
from ..services.aggregate_service import recompute_aggregates
from ..services.sync_service import sync_repository

router = APIRouter(prefix="/api", tags=["sync"])


@router.post("/repositories/{repository_id}/sync")
def trigger_sync(repository_id: int, db: Session = Depends(get_db)):
    repo = db.get(models.Repository, repository_id)
    if repo is None:
        raise HTTPException(status_code=404, detail="仓库不存在")
    run = sync_repository(db, repo, ensure_master_key(), recompute=recompute_aggregates)
    return {"id": run.id, "repository_id": run.repository_id, "status": run.status,
            "started_at": run.started_at, "finished_at": run.finished_at,
            "commits_fetched": run.commits_fetched, "error_message": run.error_message}


@router.get("/repositories/{repository_id}/sync-runs")
def list_sync_runs(repository_id: int, db: Session = Depends(get_db)):
    return [
        {"id": r.id, "status": r.status, "started_at": r.started_at, "finished_at": r.finished_at,
         "commits_fetched": r.commits_fetched, "error_message": r.error_message}
        for r in db.query(models.SyncRun).filter_by(repository_id=repository_id)
        .order_by(models.SyncRun.id.desc()).limit(20).all()
    ]
