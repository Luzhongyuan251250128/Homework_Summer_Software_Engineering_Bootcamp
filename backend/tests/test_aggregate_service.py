from datetime import date, datetime

from app import models
from app.services.aggregate_service import recompute_aggregates


def seed(db):
    proj = models.Project(name="P")
    db.add(proj)
    db.commit()
    repo = models.Repository(project_id=proj.id, platform="github", repo_path="org/repo",
                             token_encrypted="x", token_last4="abcd")
    db.add(repo)
    db.commit()
    it = models.Iteration(project_id=proj.id, name="I1", start_date=date(2026, 1, 5), end_date=date(2026, 1, 16))
    db.add(it)
    db.commit()
    day = date(2026, 1, 5)
    db.add_all([
        models.Commit(repository_id=repo.id, sha="a1", author_name="A", author_email="a@x.com",
                      committed_at=datetime(2026, 1, 5, 9, 0), add_lines=0, del_lines=0, files_changed=1),
        models.Commit(repository_id=repo.id, sha="a2", author_name="A", author_email="a@x.com",
                      committed_at=datetime(2026, 1, 5, 9, 30), add_lines=0, del_lines=0, files_changed=1),
        models.Commit(repository_id=repo.id, sha="b1", author_name="B", author_email="b@x.com",
                      committed_at=datetime(2026, 1, 5, 1, 0), add_lines=0, del_lines=0, files_changed=1),  # 凌晨
    ])
    db.commit()
    return repo, it


def test_recompute_aggregates(db_session):
    _repo, it = seed(db_session)
    recompute_aggregates(db_session)
    day_agg = db_session.query(models.WorkdayAggregate).filter_by(developer="a@x.com").first()
    assert day_agg.commits == 2
    assert day_agg.estimated_hours == 1.0
    night = db_session.query(models.WorkdayAggregate).filter_by(developer="b@x.com").first()
    assert night.night_commit_ratio == 1.0
    snap = db_session.query(models.IterationMetricSnapshot).filter_by(iteration_id=it.id).all()
    assert {s.developer for s in snap} == {"a@x.com", "b@x.com"}
