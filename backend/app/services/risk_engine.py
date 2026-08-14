from dataclasses import dataclass
from datetime import date, datetime, timedelta


@dataclass
class RiskSignal:
    code: str
    level: str  # high|medium|low
    description: str


def _parse(d: str) -> date:
    return datetime.fromisoformat(d).date()


def evaluate_iteration_risk(daily_commits: dict[str, int],
                            start: date, end: date,
                            night_ratio: float) -> list[RiskSignal]:
    """SPEC §3 M4 RS-1~RS-5。daily_commits 键为 YYYY-MM-DD，可含迭代前数据。"""
    signals: list[RiskSignal] = []
    days = sorted(daily_commits)
    total_in_range = sum(v for k, v in daily_commits.items() if start <= _parse(k) <= end)
    if total_in_range == 0:
        return signals

    # RS-1 提交频率骤降：最近 7 天 vs 前 4 周均值
    today = end
    recent = [k for k in days if (today - timedelta(days=7)) < _parse(k) <= today]
    prev = [k for k in days if (today - timedelta(days=35)) < _parse(k) <= (today - timedelta(days=7))]
    if prev:
        recent_avg = sum(daily_commits[k] for k in recent) / max(len(recent), 1)
        prev_avg = sum(daily_commits[k] for k in prev) / len(prev)
        if prev_avg > 0 and recent_avg < prev_avg * 0.5:
            signals.append(RiskSignal("RS-1", "high",
                                      f"提交频率骤降：近 7 天日均 {recent_avg:.1f}，较前 4 周均值 {prev_avg:.1f} 下降超 50%"))

    # RS-2 长沉默期：迭代内连续 ≥3 个工作日无提交
    d = start
    silence = 0
    while d <= end:
        if d.weekday() < 5 and daily_commits.get(d.isoformat(), 0) == 0:
            silence += 1
            if silence >= 3:
                signals.append(RiskSignal("RS-2", "high", f"连续 {silence} 个工作日无提交（截至 {d.isoformat()}）"))
                break
        else:
            silence = 0
        d += timedelta(days=1)

    # RS-3 凌晨赶工
    if night_ratio >= 0.3:
        signals.append(RiskSignal("RS-3", "medium", f"凌晨（0–6 点）提交占比 {night_ratio:.0%}，存在赶工迹象"))

    # RS-4 单日爆量：迭代内某日 ≥ 基线日均 3 倍
    baseline_days = [k for k in days if _parse(k) < start]
    if baseline_days:
        base_avg = sum(daily_commits[k] for k in baseline_days) / len(baseline_days)
        for k in days:
            if start <= _parse(k) <= end and base_avg > 0 and daily_commits[k] >= base_avg * 3:
                signals.append(RiskSignal("RS-4", "medium",
                                          f"单日爆量：{k} 提交 {daily_commits[k]} 次，达基线日均 {base_avg:.1f} 的 3 倍以上"))
                break

    # RS-5 迭代末期集中：后 1/3 时间窗提交占比 ≥ 60%
    span = (end - start).days + 1
    if span >= 3:
        tail_start = end - timedelta(days=span // 3 - 1)
        tail = sum(v for k, v in daily_commits.items() if tail_start <= _parse(k) <= end)
        if tail / total_in_range >= 0.6:
            signals.append(RiskSignal("RS-5", "medium",
                                      f"迭代末期集中：后 {span // 3} 天提交占比 {tail / total_in_range:.0%} ≥ 60%"))

    return signals
