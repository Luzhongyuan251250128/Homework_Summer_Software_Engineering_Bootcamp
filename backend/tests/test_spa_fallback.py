from fastapi.testclient import TestClient

from app.main import create_app


def test_spa_serves_index_at_root(spa_static):
    client = TestClient(create_app(static_dir=spa_static))
    r = client.get("/")
    assert r.status_code == 200 and "SPA" in r.text


def test_spa_fallback_for_client_route(spa_static):
    client = TestClient(create_app(static_dir=spa_static))
    r = client.get("/developers")
    assert r.status_code == 200 and "SPA" in r.text


def test_spa_serves_asset_file(spa_static):
    client = TestClient(create_app(static_dir=spa_static))
    r = client.get("/asset.js")
    assert r.status_code == 200 and r.text == "console.log(1)"


def test_api_routes_take_precedence(spa_static):
    client = TestClient(create_app(static_dir=spa_static))
    assert client.get("/api/health").json() == {"status": "ok"}


def test_unknown_api_returns_json_404(authed_client):
    r = authed_client.get("/api/does-not-exist")
    assert r.status_code == 404
    assert r.json() == {"detail": "Not Found"}
