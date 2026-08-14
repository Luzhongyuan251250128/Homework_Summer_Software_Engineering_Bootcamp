def test_unauthenticated_denied(client):
    resp = client.get("/api/projects")
    assert resp.status_code == 401


def test_health_is_public(client):
    assert client.get("/api/health").status_code == 200


def test_login_then_access(client):
    resp = client.post("/api/auth/login", json={"password": "changeme"})
    assert resp.status_code == 200
    # T9 起 /api/projects 为真实路由：已认证返回 200（未认证同路径返回 401）
    assert client.get("/api/projects").status_code == 200
