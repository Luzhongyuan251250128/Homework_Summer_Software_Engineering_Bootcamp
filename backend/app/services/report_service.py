from .. import models


def create_report(db, project_id: int, type_: str, scope: str, content_md: str,
                  llm_model: str | None = None, iteration_id: int | None = None) -> models.Report:
    report = models.Report(project_id=project_id, iteration_id=iteration_id, type=type_,
                           scope=scope, content_md=content_md, status="draft", llm_model=llm_model)
    db.add(report)
    db.flush()
    db.add(models.ReportVersion(report_id=report.id, version=1, content_md=content_md, source="llm"))
    db.commit()
    db.refresh(report)
    return report


def add_version(db, report_id: int, content_md: str, source: str) -> models.ReportVersion:
    max_v = db.query(models.ReportVersion).filter_by(report_id=report_id).count()
    v = models.ReportVersion(report_id=report_id, version=max_v + 1, content_md=content_md, source=source)
    db.add(v)
    report = db.query(models.Report).get(report_id)
    report.content_md = content_md
    db.commit()
    db.refresh(v)
    return v


def list_versions(db, report_id: int) -> list[models.ReportVersion]:
    return (db.query(models.ReportVersion)
            .filter_by(report_id=report_id)
            .order_by(models.ReportVersion.version.asc())
            .all())


def restore_version(db, report_id: int, version: int) -> models.ReportVersion:
    target = db.query(models.ReportVersion).filter_by(report_id=report_id, version=version).first()
    if target is None:
        raise ValueError(f"版本 {version} 不存在")
    return add_version(db, report_id, target.content_md, "human")


def export_markdown(report: models.Report, latest: models.ReportVersion) -> str:
    header = (
        f"# {report.type} 报告\n"
        f"- 范围: {report.scope}\n"
        f"- 状态: {report.status}\n"
        f"- 版本: v{latest.version}\n\n"
    )
    return header + latest.content_md
