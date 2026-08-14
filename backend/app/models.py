from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Team(Base):
    __tablename__ = "teams"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    admin_password_hash: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    repositories: Mapped[list["Repository"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    iterations: Mapped[list["Iteration"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    reports: Mapped[list["Report"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Repository(Base):
    __tablename__ = "repositories"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    platform: Mapped[str] = mapped_column(String(20))  # github|gitlab|gitee
    repo_path: Mapped[str] = mapped_column(String(200))
    token_encrypted: Mapped[str] = mapped_column(Text)
    token_last4: Mapped[str] = mapped_column(String(4))
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    project: Mapped[Project] = relationship(back_populates="repositories")
    commits: Mapped[list["Commit"]] = relationship(back_populates="repository", cascade="all, delete-orphan")
    sync_runs: Mapped[list["SyncRun"]] = relationship(back_populates="repository", cascade="all, delete-orphan")
    __table_args__ = (UniqueConstraint("project_id", "repo_path", name="uq_repo_path"),)


class Iteration(Base):
    __tablename__ = "iterations"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String(100))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    project: Mapped[Project] = relationship(back_populates="iterations")
    snapshots: Mapped[list["IterationMetricSnapshot"]] = relationship(back_populates="iteration", cascade="all, delete-orphan")


def iteration_overlaps(candidate: Iteration, existing: list[Iteration]) -> bool:
    """同项目内日期区间重叠校验（SPEC §6.2）"""
    for it in existing:
        if candidate.project_id != it.project_id:
            continue
        if candidate.start_date <= it.end_date and it.start_date <= candidate.end_date:
            return True
    return False


class Commit(Base):
    __tablename__ = "commits"
    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"))
    sha: Mapped[str] = mapped_column(String(64))
    author_name: Mapped[str] = mapped_column(String(200))
    author_email: Mapped[str] = mapped_column(String(200))
    committed_at: Mapped[datetime] = mapped_column(DateTime)  # UTC naive
    add_lines: Mapped[int] = mapped_column(Integer, default=0)
    del_lines: Mapped[int] = mapped_column(Integer, default=0)
    files_changed: Mapped[int] = mapped_column(Integer, default=0)
    repository: Mapped[Repository] = relationship(back_populates="commits")
    __table_args__ = (
        UniqueConstraint("repository_id", "sha", name="uq_repo_sha"),
    )


class SyncRun(Base):
    __tablename__ = "sync_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"))
    status: Mapped[str] = mapped_column(String(20))  # running|success|failed
    started_at: Mapped[datetime] = mapped_column(DateTime)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    commits_fetched: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    repository: Mapped[Repository] = relationship(back_populates="sync_runs")


class HoursEstimate(Base):
    __tablename__ = "hours_estimates"
    id: Mapped[int] = mapped_column(primary_key=True)
    developer: Mapped[str] = mapped_column(String(200))
    date: Mapped[date] = mapped_column(Date)
    estimated_hours: Mapped[float] = mapped_column(Float)
    is_corrected: Mapped[bool] = mapped_column(Boolean, default=False)
    corrected_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    correction_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    __table_args__ = (UniqueConstraint("developer", "date", name="uq_dev_date"),)


class WorkdayAggregate(Base):
    __tablename__ = "workday_aggregates"
    id: Mapped[int] = mapped_column(primary_key=True)
    developer: Mapped[str] = mapped_column(String(200))
    date: Mapped[date] = mapped_column(Date)
    commits: Mapped[int] = mapped_column(Integer, default=0)
    estimated_hours: Mapped[float] = mapped_column(Float, default=0.0)
    night_commit_ratio: Mapped[float] = mapped_column(Float, default=0.0)
    __table_args__ = (UniqueConstraint("developer", "date", name="uq_agg_dev_date"),)


class IterationMetricSnapshot(Base):
    __tablename__ = "iteration_metric_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    iteration_id: Mapped[int] = mapped_column(ForeignKey("iterations.id"))
    developer: Mapped[str] = mapped_column(String(200))
    commits: Mapped[int] = mapped_column(Integer, default=0)
    estimated_hours: Mapped[float] = mapped_column(Float, default=0.0)
    metrics_json: Mapped[str] = mapped_column(Text, default="{}")
    iteration: Mapped[Iteration] = relationship(back_populates="snapshots")


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    iteration_id: Mapped[int | None] = mapped_column(ForeignKey("iterations.id"), nullable=True)  # risk 必填
    type: Mapped[str] = mapped_column(String(20))  # weekly|risk
    scope: Mapped[str] = mapped_column(String(20))  # project|developer
    content_md: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft|final
    llm_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    project: Mapped[Project] = relationship(back_populates="reports")
    versions: Mapped[list["ReportVersion"]] = relationship(back_populates="report", cascade="all, delete-orphan")


class ReportVersion(Base):
    __tablename__ = "report_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id"))
    version: Mapped[int] = mapped_column(Integer)
    content_md: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(10))  # llm|human
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    report: Mapped[Report] = relationship(back_populates="versions")
    __table_args__ = (UniqueConstraint("report_id", "version", name="uq_report_version"),)


class CredentialMeta(Base):
    __tablename__ = "credential_meta"
    id: Mapped[int] = mapped_column(primary_key=True)
    key_name: Mapped[str] = mapped_column(String(100), unique=True)
    key_status: Mapped[str] = mapped_column(String(20), default="active")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last4: Mapped[str] = mapped_column(String(4), default="")
