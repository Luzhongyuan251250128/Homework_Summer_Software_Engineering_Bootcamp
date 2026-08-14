from datetime import date, timedelta

from app.services.risk_engine import evaluate_iteration_risk


def _days(start, counts):
    """start 起每天提交数 → {YYYY-MM-DD: n}"""
    out = {}
    d = start
    for n in counts:
        out[d.isoformat()] = n
        d += timedelta(days=1)
    return out


def test_rs1_commit_frequency_drop():
    # 前 4 周每天 10 次，本周每天 2 次 → 下降 80% ≥ 50%
    start = date(2026, 1, 5)  # 周一
    daily = _days(start - timedelta(days=28), [10] * 28)
    daily.update(_days(start, [2] * 5))
    signals = evaluate_iteration_risk(daily, start, start + timedelta(days=4), night_ratio=0.0)
    assert any(s.code == "RS-1" and s.level == "high" for s in signals)


def test_rs2_long_silence():
    start = date(2026, 1, 5)
    daily = {start.isoformat(): 1}  # 只有迭代首日有提交，后续 4 个工作日沉默
    signals = evaluate_iteration_risk(daily, start, start + timedelta(days=6), night_ratio=0.0)
    assert any(s.code == "RS-2" and s.level == "high" for s in signals)


def test_rs3_night_ratio():
    start = date(2026, 1, 5)
    daily = _days(start, [5] * 5)
    signals = evaluate_iteration_risk(daily, start, start, night_ratio=0.35)
    assert any(s.code == "RS-3" and s.level == "medium" for s in signals)


def test_rs4_single_day_spike():
    start = date(2026, 1, 5)
    daily = _days(start - timedelta(days=7), [1] * 7)
    daily.update(_days(start, [1, 1, 1, 50, 1]))  # 某日 50 ≥ 近4周日均(≈1) 的 3 倍
    signals = evaluate_iteration_risk(daily, start, start + timedelta(days=4), night_ratio=0.0)
    assert any(s.code == "RS-4" and s.level == "medium" for s in signals)


def test_rs5_tail_concentration():
    # 10 天迭代，后 1/3（第 8-10 天）占 80%
    start = date(2026, 1, 5)
    daily = _days(start, [0, 0, 0, 0, 0, 0, 0, 20, 20, 20])
    signals = evaluate_iteration_risk(daily, start, start + timedelta(days=9), night_ratio=0.0)
    assert any(s.code == "RS-5" and s.level == "medium" for s in signals)


def test_quiet_week_no_signals():
    start = date(2026, 1, 5)
    daily = _days(start, [3] * 5)
    assert evaluate_iteration_risk(daily, start, start + timedelta(days=4), night_ratio=0.1) == []
