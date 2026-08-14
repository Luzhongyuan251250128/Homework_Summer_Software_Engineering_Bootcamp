def test_login_wrong_password(client):
    resp = client.post("/api/auth/login", json={"password": "nope"})
    assert resp.status_code == 401


def test_crud_project(authed_client):
    r = authed_client.post("/api/projects", json={"name": "平台组", "description": "内部平台"})
    assert r.status_code == 200
    pid = r.json()["id"]
    lst = authed_client.get("/api/projects").json()
    assert len(lst) == 1 and lst[0]["name"] == "平台组"


def test_repo_token_stored_encrypted(authed_client, db_session):
    pid = authed_client.post("/api/projects", json={"name": "P"}).json()["id"]
    r = authed_client.post(f"/api/projects/{pid}/repositories",
                           json={"platform": "github", "repo_path": "org/repo", "token": "ghp_fake1234567890"})
    assert r.status_code == 200
    body = r.json()
    assert body["token_last4"] == "7890"
    assert "token" not in body
    from app import models
    repo = db_session.query(models.Repository).first()
    assert repo.token_encrypted != "ghp_fake1234567890"


def test_repo_duplicate_path_rejected(authed_client):
    pid = authed_client.post("/api/projects", json={"name": "P"}).json()["id"]
    body = {"platform": "github", "repo_path": "org/repo", "token": "ghp_fake1234567890"}
    assert authed_client.post(f"/api/projects/{pid}/repositories", json=body).status_code == 200
    assert authed_client.post(f"/api/projects/{pid}/repositories", json=body).status_code == 400


def test_token_status_shows_last4_only(authed_client):
    pid = authed_client.post("/api/projects", json={"name": "P"}).json()["id"]
    rid = authed_client.post(f"/api/projects/{pid}/repositories",
                             json={"platform": "github", "repo_path": "org/repo", "token": "ghp_fake1234567890"}).json()["id"]
    status = authed_client.get(f"/api/repositories/{rid}/token-status").json()
    assert status["last4"] == "7890"
    assert "token" not in status


def test_iteration_overlap_rejected(authed_client):
    pid = authed_client.post("/api/projects", json={"name": "P"}).json()["id"]
    first = {"name": "I1", "start_date": "2026-01-05", "end_date": "2026-01-16"}
    assert authed_client.post(f"/api/projects/{pid}/iterations", json=first).status_code == 200
    overlap = {"name": "I2", "start_date": "2026-01-12", "end_date": "2026-01-23"}
    assert authed_client.post(f"/api/projects/{pid}/iterations", json=overlap).status_code == 400


def test_delete_project_requires_confirm(authed_client):
    pid = authed_client.post("/api/projects", json={"name": "P"}).json()["id"]
    assert authed_client.delete(f"/api/projects/{pid}").status_code == 400
    assert authed_client.delete(f"/api/projects/{pid}?confirm=true").status_code == 200
