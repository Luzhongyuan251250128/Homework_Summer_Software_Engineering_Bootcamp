from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models
from ..config import settings
from ..db import get_db
from ..security import encrypt_token, ensure_master_key

router = APIRouter(prefix="/api/settings", tags=["settings"])

LLM_KEY_NAME = "llm_api_key"


class LlmKeyRequest(BaseModel):
    api_key: str = Field(min_length=8, description="LLM API Key（至少 8 位）")


def _get_llm_credential(db: Session) -> models.CredentialMeta | None:
    return db.query(models.CredentialMeta).filter_by(key_name=LLM_KEY_NAME).first()


@router.get("/llm")
def get_llm_setting(db: Session = Depends(get_db)):
    """LLM Key 状态：环境变量优先；否则看 DB 密文（Web 录入）。"""
    if settings.llm_api_key:
        return {"configured": True, "source": "env"}
    row = _get_llm_credential(db)
    configured = bool(row and row.value_encrypted)
    return {"configured": configured, "source": "db" if configured else None}


@router.put("/llm")
def save_llm_setting(body: LlmKeyRequest, db: Session = Depends(get_db)):
    """Web 录入 LLM Key：主密钥 AES-GCM 加密入库（仅存密文 + last4）。"""
    row = _get_llm_credential(db)
    if row is None:
        row = models.CredentialMeta(key_name=LLM_KEY_NAME)
        db.add(row)
    row.value_encrypted = encrypt_token(body.api_key, ensure_master_key())
    row.last4 = body.api_key[-4:]
    row.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.delete("/llm")
def clear_llm_setting(db: Session = Depends(get_db)):
    """清除 Web 录入的 LLM Key（环境变量不受影响）。"""
    row = _get_llm_credential(db)
    if row is not None:
        db.delete(row)
        db.commit()
    return {"ok": True}
