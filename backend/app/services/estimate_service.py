from datetime import date

from .. import models
from ..config import settings


def estimate_day(commits: list[models.Commit]) -> float:
    """SPEC §3.3 估算口径：活跃段聚类 + 代码量系数 + 日封顶 + 周末因子"""
    times = sorted(c.committed_at for c in commits)
    if not times:
        return 0.0
    segments = []
    seg_start = seg_end = times[0]
    for t in times[1:]:
        gap_min = (t - seg_end).total_seconds() / 60
        if gap_min <= settings.cluster_gap_minutes:
            seg_end = t
        else:
            segments.append((seg_start, seg_end))
            seg_start = seg_end = t
    segments.append((seg_start, seg_end))

    total = 0.0
    for s, e in segments:
        span_h = (e - s).total_seconds() / 3600 + settings.segment_boundary_minutes / 60
        total += min(span_h, settings.segment_cap_hours)

    add = sum(c.add_lines for c in commits)
    dele = sum(c.del_lines for c in commits)
    ratio = (add + dele) / settings.lines_per_unit
    coef = 1.0 + max(settings.volume_coef_min, min(settings.volume_coef_max, ratio))

    hours = min(total * coef, settings.daily_cap_hours)
    if commits[0].committed_at.weekday() >= 5:
        hours *= settings.weekend_factor
    return round(hours, 2)


def recompute_hours(db) -> None:
    """重算全部 HoursEstimate（按 developer+date 分组 upsert）。

    冷启动修订（SPEC §3.3 步骤 5）：跳过 is_corrected=1 的行——
    不覆盖原始估算（estimated_hours）与校正值（corrected_hours/note）。
    """
    from collections import defaultdict

    groups: dict[tuple[str, date], list[models.Commit]] = defaultdict(list)
    for c in db.query(models.Commit).all():
        groups[(c.author_email, c.committed_at.date())].append(c)

    for (developer, day), commits in groups.items():
        est = estimate_day(commits)
        row = db.query(models.HoursEstimate).filter_by(developer=developer, date=day).first()
        if row is None:
            db.add(models.HoursEstimate(developer=developer, date=day, estimated_hours=est))
        elif not row.is_corrected:
            row.estimated_hours = est
    db.commit()
