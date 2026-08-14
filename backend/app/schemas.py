from datetime import date, datetime

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    password: str


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = ""


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime
    model_config = {"from_attributes": True}


class RepositoryCreate(BaseModel):
    platform: str = "github"
    repo_path: str = Field(min_length=1, max_length=200)
    token: str = Field(min_length=8)


class RepositoryOut(BaseModel):
    id: int
    project_id: int
    platform: str
    repo_path: str
    token_last4: str
    last_synced_at: datetime | None
    model_config = {"from_attributes": True}


class TokenStatusOut(BaseModel):
    key_name: str
    key_status: str
    last4: str
    updated_at: datetime


class TokenUpdateRequest(BaseModel):
    token: str = Field(min_length=8)


class IterationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    start_date: date
    end_date: date


class IterationOut(BaseModel):
    id: int
    project_id: int
    name: str
    start_date: date
    end_date: date
    model_config = {"from_attributes": True}
