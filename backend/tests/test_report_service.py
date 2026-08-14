from app import models
from app.services.report_service import (add_version, create_report, export_markdown,
                                         list_versions, restore_version)


def make_report(db, content="v1 内容"):
    proj = models.Project(name="P")
    db.add(proj)
    db.commit()
    return create_report(db, proj.id, "weekly", "project", content, llm_model="deepseek-chat")


def test_create_report_has_version_1(db_session):
    r = make_report(db_session)
    versions = list_versions(db_session, r.id)
    assert len(versions) == 1 and versions[0].version == 1
    assert versions[0].source == "llm"
    assert r.status == "draft"


def test_add_version_increments(db_session):
    r = make_report(db_session)
    add_version(db_session, r.id, "v2 内容", "human")
    versions = list_versions(db_session, r.id)
    assert [v.version for v in versions] == [1, 2]
    assert versions[1].source == "human"


def test_restore_creates_new_version(db_session):
    r = make_report(db_session)
    add_version(db_session, r.id, "v2 内容", "human")
    restored = restore_version(db_session, r.id, 1)
    assert restored.version == 3
    assert restored.content_md == "v1 内容"


def test_export_contains_latest(db_session):
    r = make_report(db_session)
    add_version(db_session, r.id, "最终稿", "human")
    md = export_markdown(r, list_versions(db_session, r.id)[-1])
    assert "最终稿" in md and r.type in md
