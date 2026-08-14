from app import models
from app.config import settings
from app.security import decrypt_token, ensure_master_key


def test_get_llm_settings_unconfigured(authed_client, monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", None)
    r = authed_client.get("/api/settings/llm")
    assert r.status_code == 200
    assert r.json() == {"configured": False, "source": None}


def test_env_key_reported_as_source_env(authed_client, monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "sk-env-123456")
    r = authed_client.get("/api/settings/llm")
    assert r.status_code == 200
    assert r.json() == {"configured": True, "source": "env"}


def test_put_then_get_llm_settings_from_db(authed_client, monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", None)
    r = authed_client.put("/api/settings/llm", json={"api_key": "sk-test-123456"})
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    r = authed_client.get("/api/settings/llm")
    assert r.status_code == 200
    assert r.json() == {"configured": True, "source": "db"}


def test_put_llm_key_rejects_short_key(authed_client):
    r = authed_client.put("/api/settings/llm", json={"api_key": "short"})
    assert r.status_code == 422


def test_put_stores_encrypted_last4(authed_client, monkeypatch, db_session):
    monkeypatch.setattr(settings, "llm_api_key", None)
    authed_client.put("/api/settings/llm", json={"api_key": "sk-test-123456"})
    row = db_session.query(models.CredentialMeta).filter_by(key_name="llm_api_key").first()
    assert row is not None
    assert row.last4 == "3456"
    assert row.value_encrypted
    assert "sk-test-123456" not in row.value_encrypted  # 密文不含明文
    assert decrypt_token(row.value_encrypted, ensure_master_key()) == "sk-test-123456"


def test_delete_llm_settings_clears(authed_client, monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", None)
    assert authed_client.put("/api/settings/llm", json={"api_key": "sk-test-123456"}).status_code == 200
    r = authed_client.delete("/api/settings/llm")
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    r = authed_client.get("/api/settings/llm")
    assert r.status_code == 200
    assert r.json() == {"configured": False, "source": None}
