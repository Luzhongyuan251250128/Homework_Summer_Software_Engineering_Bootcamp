def make_project(authed_client):
    return authed_client.post("/api/projects", json={"name": "P"}).json()["id"]


def test_generate_weekly_with_mock_llm(authed_client, monkeypatch):
    from app.services import llm_service

    def fake_generate(prompt, schema_hint, client=None):
        return {"summary": "本周进展正常", "highlights": ["完成登录模块"], "risks": [], "suggestions": ["继续"]}

    monkeypatch.setattr(llm_service, "generate_report", fake_generate)
    pid = make_project(authed_client)
    r = authed_client.post("/api/reports/generate", json={"project_id": pid, "type": "weekly", "scope": "project"})
    assert r.status_code == 200
    body = r.json()
    assert body["type"] == "weekly" and body["status"] == "draft"
    assert "本周进展正常" in body["content_md"]


def test_generate_without_llm_key_fails_clearly(authed_client, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "llm_api_key", None)
    pid = make_project(authed_client)
    r = authed_client.post("/api/reports/generate", json={"project_id": pid, "type": "weekly", "scope": "project"})
    assert r.status_code == 400
    assert "LLM" in r.json()["detail"]


def test_edit_saves_new_version(authed_client, monkeypatch):
    from app.services import llm_service
    monkeypatch.setattr(llm_service, "generate_report",
                        lambda p, s, client=None: {"summary": "草稿"})
    pid = make_project(authed_client)
    rid = authed_client.post("/api/reports/generate", json={"project_id": pid, "type": "weekly", "scope": "project"}).json()["id"]
    r = authed_client.put(f"/api/reports/{rid}", json={"content_md": "人工修订稿", "status": "final"})
    assert r.status_code == 200
    detail = authed_client.get(f"/api/reports/{rid}").json()
    assert len(detail["versions"]) == 2
    assert detail["status"] == "final"
    assert detail["content_md"] == "人工修订稿"


def test_export_returns_markdown(authed_client, monkeypatch):
    from app.services import llm_service
    monkeypatch.setattr(llm_service, "generate_report",
                        lambda p, s, client=None: {"summary": "草稿"})
    pid = make_project(authed_client)
    rid = authed_client.post("/api/reports/generate", json={"project_id": pid, "type": "weekly", "scope": "project"}).json()["id"]
    r = authed_client.get(f"/api/reports/{rid}/export")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/markdown")
    assert "weekly" in r.text
