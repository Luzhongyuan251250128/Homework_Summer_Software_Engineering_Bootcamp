import json

import httpx

from ..config import settings
from .risk_engine import RiskSignal


class LLMError(Exception):
    pass


def build_weekly_prompt(metrics: dict, scope: str) -> str:
    return (
        "你是研发管理分析师。请基于以下指标快照生成一份研发周报，"
        "只依据给定数据，禁止编造任何数字或事实。\n"
        f"范围：{scope}\n指标快照：\n{json.dumps(metrics, ensure_ascii=False)}\n"
    )


def build_risk_prompt(metrics: dict, signals: list[RiskSignal]) -> str:
    signal_text = "\n".join(f"- [{s.code}] ({s.level}) {s.description}" for s in signals)
    return (
        "你是研发管理分析师。以下是迭代指标与规则引擎预计算的风险信号，"
        "请为每个风险信号撰写归因分析与缓解建议，只依据给定数据，禁止编造。\n"
        f"指标：\n{json.dumps(metrics, ensure_ascii=False)}\n风险信号：\n{signal_text}\n"
    )


def generate_report(prompt: str, schema_hint: str,
                    client: httpx.Client | None = None,
                    api_key: str | None = None) -> dict:
    effective = api_key or settings.llm_api_key
    if not effective:
        raise LLMError("LLM_API_KEY 未配置：无法生成报告，可降级使用纯统计视图")
    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system",
             "content": "你是研发管理分析师。只依据给定数据作答，禁止编造。输出必须为合法 JSON。"},
            {"role": "user", "content": prompt + f"\n输出 JSON 格式：{schema_hint}"},
        ],
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }
    own = client is None
    http = client or httpx.Client(timeout=settings.llm_timeout)
    try:
        resp = http.post(
            f"{settings.llm_base_url}/chat/completions",
            headers={"Authorization": f"Bearer {effective}"},
            json=payload,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
    except Exception as e:  # noqa: BLE001
        raise LLMError(f"LLM 调用失败: {e}") from e
    finally:
        if own:
            http.close()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {"raw": content, "unstructured": True}
