import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.main import create_app


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture()
def client():
    return TestClient(create_app(secret="test-secret"))


@pytest.fixture()
def authed_client(client):
    resp = client.post("/api/auth/login", json={"password": "changeme"})
    assert resp.status_code == 200
    return client
