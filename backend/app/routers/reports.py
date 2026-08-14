from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..config import settings
from ..db import get_db
from ..security import decrypt_token, ensure_master_key
from ..services import llm_service, report_service
from ..services.llm_service import LLMError
from .stats import iteration_stats

router = APIRouter(prefix="/api/reports", tags=["reports"])


class GenerateRequest(BaseModel):
    project_id: int
    type: str  # weekly|risk
    scope: str = "project"  # project|developer
    iteration_id: int | None = None


class EditRequest(BaseModel):
    content_md: str
    status: str | None = None


class RestoreRequest(BaseModel):
    version: int


def _render_weekly_markdown(result: dict) -> str:
    lines = [f"## 摘要\n{result.get('summary', '')}\n",
             "## 本周亮点\n" + "\n".join(f"- {h}" for h in result.get("highlights", [])) + "\n",
             "## 风险与阻塞\n" + "\n".join(f"- {r}" for r in result.get("risks", [])) + "\n",
             "## 下周建议\n" + "\n".join(f"- {s}" for s in result.get("suggestions", [])) + "\n"]
    return "\n".join(lines)


def _render_risk_markdown(result: dict) -> str:
    lines = [f"- [{item.get('level', 'medium')}] {item.get('description', '')}：{item.get('analysis', '')}"
             for item in result.get("risks", [])]
    return "## 风险分析\n" + ("\n".join(lines) if lines else "（无风险信号）") + "\n"


def _weekly_metrics(db: Session, project_id: int, scope: str) -> dict:
    rows = db.query(models.WorkdayAggregate).all()
    total = sum(r.estimated_hours for r in rows)
    commits = sum(r.commits for r in rows)
    devs = sorted({r.developer for r in rows})
    return {"project_id": project_id, "scope": scope, "developers": devs,
            "total_hours": round(total, 2), "total_commits": commits}


def _resolve_llm_api_key(db: Session) -> str | None:
    """LLM Key 解析：环境变量优先，其次 Web 录入的 DB 密文（SPEC §7.1）。"""
    if settings.llm_api_key:
        return settings.llm_api_key
    row = db.query(models.CredentialMeta).filter_by(key_name="llm_api_key").first()
    if row and row.value_encrypted:
        return decrypt_token(row.value_encrypted, ensure_master_key())
    return None


def _call_llm(db: Session, prompt: str, schema_hint: str) -> dict:
    api_key = _resolve_llm_api_key(db)
    kwargs = {"api_key": api_key} if api_key is not None else {}
    return llm_service.generate_report(prompt, schema_hint, **kwargs)


@router.post("/generate")
def generate(body: GenerateRequest, db: Session = Depends(get_db)):
    project = db.get(models.Project, body.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    if body.type == "risk" and body.iteration_id is None:
        raise HTTPException(status_code=400, detail="风险分析必须指定迭代")
    try:
        if body.type == "weekly":
            metrics = _weekly_metrics(db, body.project_id, body.scope)
            result = _call_llm(
                db,
                llm_service.build_weekly_prompt(metrics, body.scope),
                '{"summary": "string", "highlights": ["string"], "risks": ["string"], "suggestions": ["string"]}',
            )
            content = _render_weekly_markdown(result)
        else:
            it = db.get(models.Iteration, body.iteration_id)
            if it is None:
                raise HTTPException(status_code=404, detail="迭代不存在")
            stats = iteration_stats(body.iteration_id, db)
            from ..services.risk_engine import RiskSignal
            signals = [RiskSignal(s["code"], s["level"], s["description"]) for s in stats["signals"]]
            metrics = {"iteration": stats["iteration"]["name"],
                       "total_commits": stats["total_commits"]}
            result = _call_llm(
                db,
                llm_service.build_risk_prompt(metrics, signals),
                '{"risks": [{"level": "high|medium|low", "description": "string", "analysis": "string"}]}',
            )
            content = _render_risk_markdown(result)
    except LLMError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if result.get("unstructured"):
        content = result["raw"]
    report = report_service.create_report(
        db, body.project_id, body.type, body.scope, content,
        llm_model=None, iteration_id=body.iteration_id)
    return {"id": report.id, "type": report.type, "scope": report.scope,
            "status": report.status, "content_md": report.content_md, "created_at": report.created_at}


@router.get("")
def list_reports(project_id: int, db: Session = Depends(get_db)):
    rows = db.query(models.Report).filter_by(project_id=project_id).order_by(models.Report.id.desc()).all()
    return [{"id": r.id, "type": r.type, "scope": r.scope, "status": r.status,
             "created_at": r.created_at} for r in rows]


@router.get("/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db)):
    r = db.get(models.Report, report_id)
    if r is None:
        raise HTTPException(status_code=404, detail="报告不存在")
    versions = report_service.list_versions(db, report_id)
    return {"id": r.id, "type": r.type, "scope": r.scope, "status": r.status,
            "content_md": r.content_md, "llm_model": r.llm_model, "created_at": r.created_at,
            "versions": [{"version": v.version, "content_md": v.content_md,
                          "source": v.source, "created_at": v.created_at} for v in versions]}


@router.put("/{report_id}")
def edit_report(report_id: int, body: EditRequest, db: Session = Depends(get_db)):
    r = db.get(models.Report, report_id)
    if r is None:
        raise HTTPException(status_code=404, detail="报告不存在")
    report_service.add_version(db, report_id, body.content_md, "human")
    if body.status:
        r.status = body.status
        db.commit()
    return {"ok": True}


@router.post("/{report_id}/restore")
def restore(report_id: int, body: RestoreRequest, db: Session = Depends(get_db)):
    r = db.get(models.Report, report_id)
    if r is None:
        raise HTTPException(status_code=404, detail="报告不存在")
    try:
        report_service.restore_version(db, report_id, body.version)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@router.get("/{report_id}/export", response_class=PlainTextResponse)
def export(report_id: int, db: Session = Depends(get_db)):
    r = db.get(models.Report, report_id)
    if r is None:
        raise HTTPException(status_code=404, detail="报告不存在")
    latest = report_service.list_versions(db, report_id)[-1]
    return PlainTextResponse(report_service.export_markdown(r, latest),
                             media_type="text/markdown; charset=utf-8")
