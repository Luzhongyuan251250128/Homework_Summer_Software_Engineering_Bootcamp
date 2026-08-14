def make_repo_via_api(authed_client):
    pid = authed_client.post("/api/projects", json={"name": "P"}).json()["id"]
    rid = authed_client.post(f"/api/projects/{pid}/repositories",
                             json={"platform": "github", "repo_path": "org/repo",
                                   "token": "ghp_fake1234567890"}).json()["id"]
    return pid, rid


def test_sync_failure_reported(authed_client):
    pid, rid = make_repo_via_api(authed_client)
    r = authed_client.post(f"/api/repositories/{rid}/sync")
    # 测试环境 master key 存在但 provider 会真实请求 GitHub → 网络错误 → failed
    assert r.status_code == 200
    assert r.json()["status"] == "failed"


def test_sync_runs_listed(authed_client):
    pid, rid = make_repo_via_api(authed_client)
    authed_client.post(f"/api/repositories/{rid}/sync")
    runs = authed_client.get(f"/api/repositories/{rid}/sync-runs").json()
    assert len(runs) == 1 and runs[0]["status"] == "failed"


def test_overview_empty_state(authed_client):
    body = authed_client.get("/api/stats/overview").json()
    assert body["total_commits"] == 0 and body["active_developers"] == 0


def test_iteration_stats_with_data(authed_client, db_session):
    from datetime import date, datetime
    from app import models
    proj = models.Project(name="P")
    db_session.add(proj)
    db_session.commit()
    repo = models.Repository(project_id=proj.id, platform="github", repo_path="org/repo",
                             token_encrypted="x", token_last4="abcd")
    db_session.add(repo)
    db_session.commit()
    it = models.Iteration(project_id=proj.id, name="I1", start_date=date(2026, 1, 5), end_date=date(2026, 1, 16))
    db_session.add(it)
    db_session.commit()
    db_session.add(models.Commit(repository_id=repo.id, sha="s1", author_name="A", author_email="a@x.com",
                                 committed_at=datetime(2026, 1, 5, 9, 0), add_lines=0, del_lines=0, files_changed=1))
    db_session.commit()
    body = authed_client.get(f"/api/stats/iterations/{it.id}").json()
    assert body["total_commits"] == 1
    assert any(s["code"] == "RS-2" for s in body["signals"])
