import json
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..services.risk_engine import evaluate_iteration_risk

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    rows = db.query(models.WorkdayAggregate).all()
    total_hours = sum(r.estimated_hours for r in rows)
    total_commits = sum(r.commits for r in rows)
    developers = {r.developer for r in rows}
    trend: dict[str, int] = defaultdict(int)
    for r in rows:
        trend[r.date.isoformat()] += r.commits
    return {"total_hours": round(total_hours, 2), "total_commits": total_commits,
            "active_developers": len(developers),
            "trend": [{"date": k, "commits": v} for k, v in sorted(trend.items())]}


@router.get("/developers")
def developers(db: Session = Depends(get_db)):
    rows = db.query(models.WorkdayAggregate).all()
    by_dev: dict[str, dict] = {}
    for r in rows:
        d = by_dev.setdefault(r.developer, {"commits": 0, "hours": 0.0, "active_days": 0})
        d["commits"] += r.commits
        d["hours"] += r.estimated_hours
        d["active_days"] += 1
    return [{"developer": k, **v} for k, v in sorted(by_dev.items())]


@router.get("/iterations/{iteration_id}")
def iteration_stats(iteration_id: int, db: Session = Depends(get_db)):
    it = db.get(models.Iteration, iteration_id)
    if it is None:
        raise HTTPException(status_code=404, detail="迭代不存在")
    snapshots = db.query(models.IterationMetricSnapshot).filter_by(iteration_id=iteration_id).all()
    daily: dict[str, int] = defaultdict(int)
    night_commits = total = 0
    start = datetime.combine(it.start_date, datetime.min.time())
    end = datetime.combine(it.end_date, datetime.max.time())
    for c in db.query(models.Commit).filter(models.Commit.committed_at >= start,
                                            models.Commit.committed_at <= end).all():
        daily[c.committed_at.date().isoformat()] += 1
        total += 1
        if c.committed_at.hour < 6:
            night_commits += 1
    night_ratio = night_commits / total if total else 0.0
    signals = evaluate_iteration_risk(dict(daily), it.start_date, it.end_date, night_ratio)
    return {
        "iteration": {"id": it.id, "name": it.name, "start_date": it.start_date.isoformat(),
                      "end_date": it.end_date.isoformat()},
        "total_commits": total,
        "night_ratio": round(night_ratio, 2),
        "daily": [{"date": k, "commits": v} for k, v in sorted(daily.items())],
        "developers": [{"developer": s.developer, "commits": s.commits,
                        "estimated_hours": s.estimated_hours,
                        "metrics": json.loads(s.metrics_json)} for s in snapshots],
        "signals": [{"code": s.code, "level": s.level, "description": s.description} for s in signals],
    }
