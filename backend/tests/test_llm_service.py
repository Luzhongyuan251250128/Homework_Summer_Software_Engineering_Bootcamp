import httpx
import pytest

from app.config import settings
from app.services.llm_service import LLMError, build_risk_prompt, build_weekly_prompt, generate_report
from app.services.risk_engine import RiskSignal


def mock_client(payload):
    def handler(request):
        return httpx.Response(200, json=payload)
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_no_key_raises(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", None)
    with pytest.raises(LLMError):
        generate_report("p", "schema")


def test_generate_parses_json(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "sk-fake")
    client = mock_client({"choices": [{"message": {"content": '{"summary": "本周进展正常"}'}}]})
    result = generate_report("p", "schema", client=client)
    assert result == {"summary": "本周进展正常"}


def test_generate_unstructured_fallback(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "sk-fake")
    client = mock_client({"choices": [{"message": {"content": "not json at all"}}]})
    result = generate_report("p", "schema", client=client)
    assert result["unstructured"] is True
    assert result["raw"] == "not json at all"


def test_http_error_raises(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "sk-fake")

    def handler(request):
        return httpx.Response(500, json={"error": "boom"})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(LLMError):
        generate_report("p", "schema", client=client)


def test_prompts_contain_data_and_constraints():
    weekly = build_weekly_prompt({"project": "P", "total_hours": 120.0}, "project")
    assert "120.0" in weekly and "禁止编造" in weekly
    risk = build_risk_prompt({"iteration": "I1"}, [RiskSignal("RS-1", "high", "提交骤降")])
    assert "RS-1" in risk and "提交骤降" in risk
