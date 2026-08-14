from .config import settings


def run_all_syncs(session_factory, master_key: str) -> None:
    """遍历所有仓库执行同步（定时任务入口，SPEC §3 M2）"""
    from . import models
    from .services.aggregate_service import recompute_aggregates
    from .services.sync_service import sync_repository

    db = session_factory()
    try:
        for repo in db.query(models.Repository).all():
            sync_repository(db, repo, master_key, recompute=recompute_aggregates)
    finally:
        db.close()


def start_scheduler(session_factory, master_key: str):
    """SYNC_INTERVAL_HOURS <= 0 时不启动（默认关闭，手动为主，SPEC §10 已决）"""
    if settings.sync_interval_hours <= 0:
        return None
    from apscheduler.schedulers.background import BackgroundScheduler

    scheduler = BackgroundScheduler()
    scheduler.add_job(run_all_syncs, "interval", hours=settings.sync_interval_hours,
                      args=[session_factory, master_key])
    scheduler.start()
    return scheduler
