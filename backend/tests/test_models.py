from datetime import date, datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.db import Base


def make_engine():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return engine


def test_commit_sha_unique_per_repository():
    engine = make_engine()
    Session = sessionmaker(bind=engine)
    db = Session()
    repo = models.Repository(project_id=1, platform="github", repo_path="a/b",
                             token_encrypted="x", token_last4="abcd")
    db.add(repo)
    db.commit()
    db.add_all([
        models.Commit(repository_id=repo.id, sha="s1", author_name="A", author_email="a@x.com",
                      committed_at=datetime(2026, 1, 5, 9, 0), add_lines=10, del_lines=2, files_changed=3),
        models.Commit(repository_id=repo.id, sha="s1", author_name="A", author_email="a@x.com",
                      committed_at=datetime(2026, 1, 5, 9, 5), add_lines=1, del_lines=0, files_changed=1),
    ])
    try:
        db.commit()
        assert False, "duplicate sha must raise"
    except Exception:
        pass


def test_estimate_unique_per_developer_date():
    engine = make_engine()
    Session = sessionmaker(bind=engine)
    db = Session()
    db.add_all([
        models.HoursEstimate(developer="a@x.com", date=date(2026, 1, 5), estimated_hours=1.0),
        models.HoursEstimate(developer="a@x.com", date=date(2026, 1, 5), estimated_hours=2.0),
    ])
    try:
        db.commit()
        assert False, "duplicate developer+date must raise"
    except Exception:
        pass


def test_iteration_overlap_validation():
    it = models.Iteration(project_id=1, name="I1", start_date=date(2026, 1, 5), end_date=date(2026, 1, 16))
    assert models.iteration_overlaps(it, []) is False
    other = models.Iteration(project_id=1, name="I2", start_date=date(2026, 1, 12), end_date=date(2026, 1, 23))
    assert models.iteration_overlaps(other, [it]) is True
