from datetime import datetime

from app import models
from app.services.estimate_service import estimate_day


def commit_at(h, m):
    return models.Commit(id=0, repository_id=1, sha="s", author_name="A", author_email="a@x.com",
                         committed_at=datetime(2026, 1, 5, h, m), add_lines=0, del_lines=0, files_changed=1)


def test_empty_returns_zero():
    assert estimate_day([]) == 0.0


def test_single_short_segment():
    # 09:00 与 09:30 同段：段时长 = 30min + 30min 边界 = 1.0h，代码量 0 → 系数 1.0
    commits = [commit_at(9, 0), commit_at(9, 30)]
    assert estimate_day(commits) == 1.0


def test_two_segments_summed():
    # 段1: 09:00-09:30 (1.0h)；段2: 14:00-14:30 (1.0h) → 2.0h
    commits = [commit_at(9, 0), commit_at(9, 30), commit_at(14, 0), commit_at(14, 30)]
    assert estimate_day(commits) == 2.0


def test_segment_cap_applies():
    # 09:00~16:30 每 90 分钟一个 commit → 同一活跃段：段长 7.5h + 0.5h = 8.0h，封顶 6h
    commits = [commit_at(9, 0), commit_at(10, 30), commit_at(12, 0),
               commit_at(13, 30), commit_at(15, 0), commit_at(16, 30)]
    assert estimate_day(commits) == 6.0


def test_volume_coefficient():
    # 09:00-09:30 (1.0h)，当日 add+del = 2000 行 → 系数 1.0 + clamp(2000/2000, -0.2, +0.5) = 1.5 → 1.5h
    c1, c2 = commit_at(9, 0), commit_at(9, 30)
    c1.add_lines, c2.add_lines = 1000, 1000
    assert estimate_day([c1, c2]) == 1.5


def test_daily_cap():
    # 三段：08:00-12:30 (5.0h)、14:30-19:00 (5.0h)、21:00-22:30 (2.0h) → 合计 12.0h → 日封顶 12h
    commits = [commit_at(8, 0), commit_at(9, 30), commit_at(11, 0), commit_at(12, 30),
               commit_at(14, 30), commit_at(16, 0), commit_at(17, 30), commit_at(19, 0),
               commit_at(21, 0), commit_at(22, 30)]
    assert estimate_day(commits) == 12.0


def test_weekend_factor():
    # 周六（2026-01-10）：09:00-09:30 → 1.0h × 0.5 = 0.5h
    c1 = commit_at(9, 0)
    c1.committed_at = datetime(2026, 1, 10, 9, 0)
    c2 = commit_at(9, 30)
    c2.committed_at = datetime(2026, 1, 10, 9, 30)
    assert estimate_day([c1, c2]) == 0.5


def test_config_params_affect_estimate(monkeypatch):
    # 口径参数可配（SPEC §9 M3 验收）：边界修正 30→60 分钟 → 段长 0.5h + 1.0h = 1.5h
    from app.config import settings
    monkeypatch.setattr(settings, "segment_boundary_minutes", 60)
    commits = [commit_at(9, 0), commit_at(9, 30)]
    assert estimate_day(commits) == 1.5


def test_recompute_hours_preserves_correction(db_session):
    # 人工校正（is_corrected=1）行不被重算覆盖（SPEC §3.3 步骤 5）
    from datetime import date

    from app.services.estimate_service import recompute_hours

    proj = models.Project(name="P")
    db_session.add(proj)
    db_session.commit()
    repo = models.Repository(project_id=proj.id, platform="github", repo_path="org/repo",
                             token_encrypted="x", token_last4="abcd")
    db_session.add(repo)
    db_session.commit()
    db_session.add_all([
        models.Commit(repository_id=repo.id, sha="a1", author_name="A", author_email="a@x.com",
                      committed_at=datetime(2026, 1, 5, 9, 0), add_lines=0, del_lines=0, files_changed=1),
        models.Commit(repository_id=repo.id, sha="a2", author_name="A", author_email="a@x.com",
                      committed_at=datetime(2026, 1, 5, 9, 30), add_lines=0, del_lines=0, files_changed=1),
    ])
    db_session.add(models.HoursEstimate(developer="a@x.com", date=date(2026, 1, 5), estimated_hours=7.0,
                                        is_corrected=True, corrected_hours=9.5, correction_note="人工"))
    db_session.commit()
    recompute_hours(db_session)
    row = db_session.query(models.HoursEstimate).filter_by(developer="a@x.com", date=date(2026, 1, 5)).first()
    assert row.estimated_hours == 7.0  # 原始估算保留，不被重算（1.0h）覆盖
    assert row.corrected_hours == 9.5
