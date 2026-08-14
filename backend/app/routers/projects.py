from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..models import iteration_overlaps
from ..schemas import (IterationCreate, IterationOut, ProjectCreate, ProjectOut,
                       RepositoryCreate, RepositoryOut, TokenStatusOut, TokenUpdateRequest)
from ..security import encrypt_token, ensure_master_key

router = APIRouter(prefix="/api", tags=["projects"])


def _get_project(db: Session, project_id: int) -> models.Project:
    p = db.get(models.Project, project_id)
    if p is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    return p


@router.get("/projects", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(models.Project).all()


@router.post("/projects", response_model=ProjectOut)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    p = models.Project(name=body.name, description=body.description)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/projects/{project_id}")
def delete_project(project_id: int, confirm: bool = False, db: Session = Depends(get_db)):
    if not confirm:
        raise HTTPException(status_code=400, detail="需二次确认（confirm=true）")
    p = _get_project(db, project_id)
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.get("/projects/{project_id}/repositories", response_model=list[RepositoryOut])
def list_repositories(project_id: int, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    return db.query(models.Repository).filter_by(project_id=project_id).all()


@router.post("/projects/{project_id}/repositories", response_model=RepositoryOut)
def create_repository(project_id: int, body: RepositoryCreate, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    dup = db.query(models.Repository).filter_by(project_id=project_id, repo_path=body.repo_path).first()
    if dup:
        raise HTTPException(status_code=400, detail="同一项目下仓库路径重复")
    master = ensure_master_key()
    repo = models.Repository(
        project_id=project_id, platform=body.platform, repo_path=body.repo_path,
        token_encrypted=encrypt_token(body.token, master),
        token_last4=body.token[-4:],
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)
    return repo


@router.delete("/repositories/{repository_id}")
def delete_repository(repository_id: int, db: Session = Depends(get_db)):
    repo = db.get(models.Repository, repository_id)
    if repo is None:
        raise HTTPException(status_code=404, detail="仓库不存在")
    db.delete(repo)
    db.commit()
    return {"ok": True}


@router.get("/repositories/{repository_id}/token-status", response_model=TokenStatusOut)
def token_status(repository_id: int, db: Session = Depends(get_db)):
    repo = db.get(models.Repository, repository_id)
    if repo is None:
        raise HTTPException(status_code=404, detail="仓库不存在")
    return TokenStatusOut(key_name=f"repo:{repo.id}", key_status="active",
                          last4=repo.token_last4, updated_at=repo.created_at)


@router.put("/repositories/{repository_id}/token")
def update_token(repository_id: int, body: TokenUpdateRequest, db: Session = Depends(get_db)):
    repo = db.get(models.Repository, repository_id)
    if repo is None:
        raise HTTPException(status_code=404, detail="仓库不存在")
    repo.token_encrypted = encrypt_token(body.token, ensure_master_key())
    repo.token_last4 = body.token[-4:]
    db.commit()
    return {"ok": True}


@router.delete("/repositories/{repository_id}/token")
def clear_token(repository_id: int, db: Session = Depends(get_db)):
    repo = db.get(models.Repository, repository_id)
    if repo is None:
        raise HTTPException(status_code=404, detail="仓库不存在")
    repo.token_encrypted = ""
    repo.token_last4 = ""
    db.commit()
    return {"ok": True}


@router.get("/projects/{project_id}/iterations", response_model=list[IterationOut])
def list_iterations(project_id: int, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    return db.query(models.Iteration).filter_by(project_id=project_id).all()


@router.post("/projects/{project_id}/iterations", response_model=IterationOut)
def create_iteration(project_id: int, body: IterationCreate, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    if body.start_date > body.end_date:
        raise HTTPException(status_code=400, detail="开始日期不能晚于结束日期")
    existing = db.query(models.Iteration).filter_by(project_id=project_id).all()
    candidate = models.Iteration(project_id=project_id, name=body.name,
                                 start_date=body.start_date, end_date=body.end_date)
    if iteration_overlaps(candidate, existing):
        raise HTTPException(status_code=400, detail="迭代日期与现有迭代重叠")
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate
