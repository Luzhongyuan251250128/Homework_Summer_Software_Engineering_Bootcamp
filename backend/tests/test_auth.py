from fastapi.testclient import TestClient

from app.main import create_app


def make_client(secret: str = "test-secret"):
    return TestClient(create_app(secret=secret))


def test_unauthenticated_denied():
    client = make_client()
    resp = client.get("/api/projects")
    assert resp.status_code == 401


def test_health_is_public():
    client = make_client()
    assert client.get("/api/health").status_code == 200


def test_login_then_access(client):
    resp = client.post("/api/auth/login", json={"password": "changeme"})
    assert resp.status_code == 200
    # /api/projects 路由属 T9，T3 阶段不存在：
    # 404 = 已通过认证中间件（未认证同路径返回 401），以此验证放行
    assert client.get("/api/projects").status_code == 404
