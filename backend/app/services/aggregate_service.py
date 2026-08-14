import json
from datetime import datetime

from .. import models
from .estimate_service import estimate_day


def _effective_hours(db, developer, day, commits) -> float:
    """SPEC §3.3 步骤 5：is_corrected=1 时以 corrected_hours 为准，否则用估算值。

    冷启动修订：日聚合与迭代快照均以校正值为优先口径。
    """
    row = db.query(models.HoursEstimate).filter_by(developer=developer, date=day).first()
    if row is not None and row.is_corrected and row.corrected_hours is not None:
        return row.corrected_hours
    return estimate_day(commits)


def recompute_aggregates(db) -> None:
    """日聚合（WorkdayAggregate）+ 迭代快照（IterationMetricSnapshot），确定性重算"""
    from collections import defaultdict

    groups: dict[tuple[str, object], list[models.Commit]] = defaultdict(list)
    for c in db.query(models.Commit).all():
        groups[(c.author_email, c.committed_at.date())].append(c)

    for (developer, day), commits in groups.items():
        total = len(commits)
        night = sum(1 for c in commits if c.committed_at.hour < 6) / total
        est = _effective_hours(db, developer, day, commits)
        row = db.query(models.WorkdayAggregate).filter_by(developer=developer, date=day).first()
        if row is None:
            db.add(models.WorkdayAggregate(developer=developer, date=day, commits=total,
                                           estimated_hours=est, night_commit_ratio=round(night, 2)))
        else:
            row.commits = total
            row.estimated_hours = est
            row.night_commit_ratio = round(night, 2)
    db.commit()

    for it in db.query(models.Iteration).all():
        start = datetime.combine(it.start_date, datetime.min.time())
        end = datetime.combine(it.end_date, datetime.max.time())
        devs: dict[str, dict] = {}
        for c in db.query(models.Commit).filter(
                models.Commit.committed_at >= start,
                models.Commit.committed_at <= end).all():
            d = devs.setdefault(c.author_email, {"commits": 0, "lines": 0, "days": set()})
            d["commits"] += 1
            d["lines"] += c.add_lines + c.del_lines
            d["days"].add(c.committed_at.date())
        db.query(models.IterationMetricSnapshot).filter_by(iteration_id=it.id).delete()
        for dev, d in devs.items():
            # 迭代工时 = 窗口内按 (dev, date) 分组的日工时之和（校正值优先）
            daily: dict[object, list[models.Commit]] = defaultdict(list)
            for c in db.query(models.Commit).filter(
                    models.Commit.author_email == dev,
                    models.Commit.committed_at >= start,
                    models.Commit.committed_at <= end).all():
                daily[c.committed_at.date()].append(c)
            hours = round(sum(_effective_hours(db, dev, day, commits) for day, commits in daily.items()), 2)
            db.add(models.IterationMetricSnapshot(
                iteration_id=it.id, developer=dev, commits=d["commits"],
                estimated_hours=hours,
                metrics_json=json.dumps({"active_days": len(d["days"]), "lines": d["lines"]}),
            ))
    db.commit()
