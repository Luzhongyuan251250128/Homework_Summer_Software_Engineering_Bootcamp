import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.db import Base
from app.main import create_app

TEST_MASTER_KEY = "test-master-key-123456"


@pytest.fixture()
def db_engine():
    engine = create_engine("sqlite://",
                           connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture()
def db_session(db_engine):
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture()
def db_factory(db_engine):
    Session = sessionmaker(bind=db_engine)

    def factory():
        return Session()

    return factory


@pytest.fixture()
def client(db_factory, monkeypatch):
    monkeypatch.setattr(settings, "master_key", TEST_MASTER_KEY)
    return TestClient(create_app(secret="test-secret", db=db_factory))


@pytest.fixture()
def authed_client(client):
    resp = client.post("/api/auth/login", json={"password": "changeme"})
    assert resp.status_code == 200
    return client


@pytest.fixture()
def spa_static(tmp_path):
    """临时静态目录（SPA 回退测试用）：index.html + 一个静态资源文件"""
    (tmp_path / "index.html").write_text("<html>SPA</html>", encoding="utf-8")
    (tmp_path / "asset.js").write_text("console.log(1)", encoding="utf-8")
    return tmp_path
