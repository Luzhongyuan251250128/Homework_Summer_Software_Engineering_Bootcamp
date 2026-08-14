# 研发任务智能统计与工时分析平台 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Web 端研发数据平台：导入 Git 数据 → 自动统计开发工时与提交频率 → LLM 单轮生成周报与迭代风险分析 → 报告可编辑/存历史/导出。

**Architecture:** 前后端分离。后端 FastAPI（Python 3.11）+ SQLite(WAL) + SQLAlchemy，负责 Git 采集（GitHub API，GitProvider 抽象）、工时估算与聚合（确定性算法）、风险规则引擎（确定性）、LLM 单轮报告生成（OpenAI 兼容，可 mock）、报告管理与认证；前端 React 18 + Vite + TS + Open Design 风格 + ECharts，五个页面（登录/总览/个人与迭代/配置/报告编辑）。单 Docker 镜像（FastAPI 托管前端静态资源）分发。

**Tech Stack:** Python 3.11、FastAPI、SQLAlchemy 2.x、SQLite（WAL）、pytest、httpx、cryptography(AES-GCM)、bcrypt、keyring、pydantic-settings、APScheduler；React 18、Vite、TypeScript、vitest、@testing-library/react、react-router-dom v6、echarts。

**Spec:** `SPEC.md`（本计划从 SPEC 论证，执行者须同时阅读 SPEC 与 PLAN）

## Global Constraints

- Python ≥ 3.11；前端 Node ≥ 18。
- **TDD 硬性要求**：每个 task 先写失败测试（红）→ 运行确认失败 → 写最小实现（绿）→ 运行确认通过 → 重构 → commit。禁止先写实现再补测试。
- 凭据**绝不硬编码、绝不进 Git 历史**：所有 key 只经环境变量/`.env` 读取（`pydantic-settings`）；测试一律用假 token / mock LLM server。
- 时间统一 **UTC naive datetime** 存储，展示层转本地时区。
- 工时估算口径参数集中于 `app/config.py`（`Settings` 类字段），可配置、可单测。
- 提交粒度：每个 task 一个 commit；commit message 标注 task 编号与 subagent 完成情况。
- 所有 API 前缀 `/api/*`；除 `/api/health`、`/api/auth/login` 外全部受会话 cookie 中间件保护。
- 数据库默认路径 `devhours.db`（环境变量 `DATABASE_PATH` 可覆盖）；SQLite 开启 WAL。
- 一键测试：仓库根 `make test` = 后端 pytest + 前端 vitest，必须全绿。

## File Structure

```
根目录
├── SPEC.md                     # 规约（已存在，本计划的论证依据）
├── PLAN.md                     # 本文件
├── Makefile                    # make test 一键测试
├── .env.example                # 环境变量样例（无真实凭据）
├── .gitignore                  # 追加 devhours.db、.env、frontend/node_modules 等
├── Dockerfile                  # T18：多阶段构建单镜像
├── .gitlab-ci.yml              # T19：unit-test job + 镜像构建
├── README.md                   # T20：获取/运行/key 配置/已知限制
├── backend/
│   ├── requirements.txt        # 后端依赖
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # app 工厂、路由注册、静态托管、/api/health
│   │   ├── config.py           # Settings（环境变量 + 口径常量）
│   │   ├── db.py               # engine/session/Base/get_db
│   │   ├── models.py           # 全部 ORM 模型
│   │   ├── schemas.py          # Pydantic 请求/响应模型
│   │   ├── security.py         # AES-GCM 加解密、bcrypt、keyring 引导
│   │   ├── auth.py             # 会话中间件
│   │   ├── providers/
│   │   │   ├── __init__.py
│   │   │   ├── base.py         # GitProvider ABC + CommitInfo
│   │   │   └── github.py       # GitHubProvider（httpx）
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── sync_service.py      # 采集编排（幂等增量）
│   │   │   ├── estimate_service.py  # 工时估算口径
│   │   │   ├── aggregate_service.py # 日/周/迭代聚合快照
│   │   │   ├── risk_engine.py       # RS-1~5 确定性规则引擎
│   │   │   ├── llm_service.py       # OpenAI 兼容单轮 + JSON 解析
│   │   │   └── report_service.py    # 报告/版本 CRUD + 导出
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py         # login/logout
│   │   │   ├── projects.py     # 项目/仓库/迭代 CRUD + token 管理
│   │   │   ├── sync.py         # 触发同步 + 同步记录
│   │   │   ├── stats.py        # 总览/个人/迭代统计
│   │   │   └── reports.py      # 生成/编辑/版本/导出
│   │   └── scheduler.py        # APScheduler 可选定时同步
│   └── tests/
│       ├── conftest.py         # 内存库、TestClient、登录助手、假数据工厂
│       ├── test_health.py
│       ├── test_models.py
│       ├── test_security.py
│       ├── test_auth.py
│       ├── test_github_provider.py
│       ├── test_sync_service.py
│       ├── test_estimate_service.py
│       ├── test_aggregate_service.py
│       ├── test_risk_engine.py
│       ├── test_llm_service.py
│       ├── test_report_service.py
│       ├── test_api_projects.py
│       ├── test_api_sync_stats.py
│       └── test_api_reports.py
└── frontend/
    ├── package.json / vite.config.ts / tsconfig.json / index.html
    ├── src/
    │   ├── main.tsx / App.tsx        # 路由
    │   ├── api/client.ts             # fetch 封装 + 登录态
    │   ├── styles/tokens.css         # Open Design 风格设计令牌
    │   ├── components/ StatCard.tsx TrendChart.tsx SyncStatusCard.tsx EmptyState.tsx
    │   └── pages/ LoginPage.tsx DashboardPage.tsx DeveloperPage.tsx
    │              IterationPage.tsx ConfigPage.tsx ReportEditorPage.tsx
    └── tests/ (vitest)
```

---

### Task 1: 项目脚手架与后端骨架

**目标**：建立仓库根 Makefile、`.env.example`、`.gitignore` 追加项与 FastAPI 最小可运行骨架（`/api/health`），让 `make test` 与 `uvicorn` 启动可验证。

**依赖**：无。**可并行**：无（所有 task 的地基）。

**Files:**
- Create: `Makefile`
- Create: `.env.example`
- Modify: `.gitignore`（追加条目）
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_health.py`
- Create: `backend/tests/conftest.py`（仅最小内容，后续 task 扩充）

**Interfaces:**
- Consumes: 无
- Produces: `Settings`（`app.config`，字段见下）、`create_app()`（`app.main`，返回 FastAPI 实例，含 `/api/health`）

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_health.py`：

```python
from fastapi.testclient import TestClient
from app.main import create_app


def test_health_ok():
    client = TestClient(create_app())
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_health.py -v`
Expected: FAIL，`ModuleNotFoundError: No module named 'app'`（骨架尚未创建）。

- [ ] **Step 3: 最小实现**

创建 `backend/app/config.py`：

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    admin_password: str = "changeme"
    master_key: str | None = None
    llm_api_key: str | None = None
    llm_base_url: str = "https://api.deepseek.com/v1"
    llm_model: str = "deepseek-chat"
    llm_timeout: float = 60.0
    sync_interval_hours: int = 0
    database_path: str = "devhours.db"
    session_secret: str = "dev-only-secret-change-me"

    # 工时估算口径常量（SPEC §3.3 M3）
    cluster_gap_minutes: int = 90
    segment_boundary_minutes: int = 30
    segment_cap_hours: float = 6.0
    lines_per_unit: int = 2000
    volume_coef_min: float = -0.2
    volume_coef_max: float = 0.5
    daily_cap_hours: float = 12.0
    weekend_factor: float = 0.5

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
```

创建 `backend/app/main.py`：

```python
from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="研发任务智能统计与工时分析平台")

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app
```

创建 `backend/app/__init__.py`、`backend/tests/__init__.py`（空文件）。

创建 `backend/requirements.txt`：

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy==2.0.36
pydantic==2.10.4
pydantic-settings==2.7.0
httpx==0.28.1
cryptography==44.0.0
bcrypt==4.2.1
keyring==25.6.0
APScheduler==3.11.0
pytest==8.3.4
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && pip install -r requirements.txt && python -m pytest tests/test_health.py -v`
Expected: PASS（1 passed）。

- [ ] **Step 5: 创建 Makefile 与 .env.example，更新 .gitignore**

创建根目录 `Makefile`：

```makefile
.PHONY: test backend-test frontend-test install

test: backend-test frontend-test

backend-test:
	cd backend && python -m pytest -q

frontend-test:
	cd frontend && npx vitest run

install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install
```

创建根目录 `.env.example`（**不得含真实凭据**）：

```
# 复制为 .env 后填写。.env 为明文文件，勿提交进 Git。
ADMIN_PASSWORD=change-me
MASTER_KEY=
LLM_API_KEY=
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
SYNC_INTERVAL_HOURS=0
DATABASE_PATH=devhours.db
SESSION_SECRET=change-me-too
```

`.gitignore` 追加：

```
# 运行时产物与凭据
backend/devhours.db
backend/devhours.db-wal
backend/devhours.db-shm
.env
frontend/node_modules/
frontend/dist/
__pycache__/
*.pyc
.pytest_cache/
```

- [ ] **Step 6: 验证 make test 骨架**

Run: `make test`
Expected: 后端 pytest 通过（1 passed）；frontend 目录尚不存在时前端命令可暂时跳过（T12 建立后补全）。

- [ ] **Step 7: Commit**

```bash
git add Makefile .env.example .gitignore backend/
git commit -m "task1: scaffold FastAPI backend skeleton, Makefile, .env.example (subagent: TBD)"
```

---

### Task 2: 数据模型与数据库层

**目标**：实现 SPEC §6 全部 ORM 模型（Team/Project/Repository/Iteration/Commit/SyncRun/HoursEstimate/WorkdayAggregate/IterationMetricSnapshot/Report/ReportVersion/CredentialMeta）与 WAL 引擎/会话，含约束（sha 仓库内唯一、developer+date 唯一、迭代日期不重叠校验）。

**依赖**：T1。**可并行**：与 T3~T8 并行（它们都依赖 T2 的 models/db）。

**Files:**
- Create: `backend/app/db.py`
- Create: `backend/app/models.py`
- Create: `backend/tests/test_models.py`
- Modify: `backend/tests/conftest.py`（内存库 fixture）

**Interfaces:**
- Consumes: `Settings`（`app.config`）、`Base`（本 task 定义于 `db.py`）
- Produces: `Base`、`get_db()`（FastAPI 依赖，yield `Session`）、`init_db(engine)`、全部 ORM 类（`app.models`）；测试用 `build_engine(":memory:")` 已支持

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_models.py`：

```python
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
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_models.py -v`
Expected: FAIL，`ModuleNotFoundError: No module named 'app.db'`。

- [ ] **Step 3: 最小实现**

创建 `backend/app/db.py`：

```python
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


def build_engine(path: str):
    engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _set_wal(dbapi_conn, _record):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.close()

    return engine


engine = build_engine(settings.database_path)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(engine) -> None:
    from . import models  # noqa: F401  确保模型已注册
    Base.metadata.create_all(engine)
```

创建 `backend/app/models.py`：

```python
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
```

修改 `backend/tests/conftest.py`（最小内容，后续 task 扩充）：

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_models.py -v`
Expected: PASS（3 passed）。

- [ ] **Step 5: Commit**

```bash
git add backend/app/db.py backend/app/models.py backend/tests/test_models.py backend/tests/conftest.py
git commit -m "task2: add ORM models and WAL database layer (subagent: TBD)"
```

---

### Task 3: 安全与认证模块

**目标**：实现 SPEC §4.2/§7 的凭据安全核心：AES-256-GCM 加解密（主密钥派生）、bcrypt 口令哈希、keyring 主密钥引导、会话中间件（保护 `/api/*`，白名单 `/api/health`、`/api/auth/login`）。

**依赖**：T1、T2。**可并行**：与 T4~T8 并行（T4 额外需要本 task 的 `decrypt_token`，故 T4 依赖 T3）。

**Files:**
- Create: `backend/app/security.py`
- Create: `backend/app/auth.py`
- Create: `backend/tests/test_security.py`
- Create: `backend/tests/test_auth.py`
- Modify: `backend/tests/conftest.py`（登录助手）

**Interfaces:**
- Consumes: `Settings.session_secret`、`Settings.admin_password`、`Settings.master_key`
- Produces: `encrypt_token(plaintext: str, master_key: str) -> str`、`decrypt_token(blob: str, master_key: str) -> str`、`hash_password(pw: str) -> str`、`verify_password(pw: str, hashed: str) -> bool`、`ensure_master_key() -> str`（keyring 引导）、`AuthMiddleware(app, secret)`、`SESSION_COOKIE = "devhours_session"`、`expected_session(secret) -> str`

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_security.py`：

```python
from app.security import decrypt_token, encrypt_token, hash_password, verify_password


def test_roundtrip():
    blob = encrypt_token("ghp_fake1234567890", "mkey-1")
    assert decrypt_token(blob, "mkey-1") == "ghp_fake1234567890"


def test_wrong_key_fails():
    blob = encrypt_token("secret", "mkey-1")
    try:
        decrypt_token(blob, "mkey-2")
        assert False, "wrong master key must fail"
    except Exception:
        pass


def test_password_hash_verify():
    h = hash_password("pw123")
    assert h != "pw123"
    assert verify_password("pw123", h) is True
    assert verify_password("wrong", h) is False
```

创建 `backend/tests/test_auth.py`：

```python
from fastapi.testclient import TestClient

from app.main import create_app


def make_client(secret: str = "test-secret"):
    return TestClient(create_app(secret=secret))


def test_unauthenticated_denied():
    client = make_client()
    resp = client.get("/api/projects")
    assert resp.status_code == 401


def test_health_is_public():
    client = make_client()
    assert client.get("/api/health").status_code == 200


def test_login_then_access(client):
    resp = client.post("/api/auth/login", json={"password": "changeme"})
    assert resp.status_code == 200
    # /api/projects 路由属 T9，T3 阶段不存在：
    # 404 = 已通过认证中间件（未认证同路径返回 401），以此验证放行
    assert client.get("/api/projects").status_code == 404
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_security.py tests/test_auth.py -v`
Expected: FAIL（`ModuleNotFoundError: No module named 'app.security'`；`/api/projects` 未实现 401）。

- [ ] **Step 3: 最小实现**

创建 `backend/app/security.py`：

```python
import base64
import hashlib
import os

import bcrypt
import keyring
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .config import settings

KEYRING_SERVICE = "dev-hours-platform"


def derive_key(master_key: str) -> bytes:
    """主密钥 → AES-256 密钥（SHA-256 派生）"""
    return hashlib.sha256(master_key.encode("utf-8")).digest()


def encrypt_token(plaintext: str, master_key: str) -> str:
    aesgcm = AESGCM(derive_key(master_key))
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ct).decode("ascii")


def decrypt_token(blob: str, master_key: str) -> str:
    raw = base64.b64decode(blob)
    nonce, ct = raw[:12], raw[12:]
    return AESGCM(derive_key(master_key)).decrypt(nonce, ct, None).decode("utf-8")


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("ascii"))


def ensure_master_key() -> str:
    """主密钥引导：环境变量 > 系统钥匙串 > 首次提示（SPEC §7.2）"""
    if settings.master_key:
        return settings.master_key
    stored = keyring.get_password(KEYRING_SERVICE, "master_key")
    if stored:
        return stored
    raise RuntimeError(
        "未找到主密钥：请设置环境变量 MASTER_KEY，或先运行 python -m app.cli_setup 录入钥匙串"
    )
```

创建 `backend/app/auth.py`：

```python
import hashlib
import hmac

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

SESSION_COOKIE = "devhours_session"
PUBLIC_PATHS = {"/api/health", "/api/auth/login"}


def expected_session(secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), b"admin", hashlib.sha256).hexdigest()


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, secret: str):
        super().__init__(app)
        self.secret = secret

    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/api/") and request.url.path not in PUBLIC_PATHS:
            token = request.cookies.get(SESSION_COOKIE)
            if not token or not hmac.compare_digest(token, expected_session(self.secret)):
                from fastapi.responses import JSONResponse
                return JSONResponse({"detail": "unauthorized"}, status_code=401)
        return await call_next(request)
```

修改 `backend/app/main.py`：

```python
from fastapi import FastAPI

from .auth import AuthMiddleware


def create_app(secret: str | None = None) -> FastAPI:
    from .config import settings

    app = FastAPI(title="研发任务智能统计与工时分析平台")
    app.add_middleware(AuthMiddleware, secret=secret or settings.session_secret)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app
```

修改 `backend/tests/conftest.py`（追加登录助手）：

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.main import create_app


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture()
def client():
    return TestClient(create_app(secret="test-secret"))


@pytest.fixture()
def authed_client(client):
    resp = client.post("/api/auth/login", json={"password": "changeme"})
    assert resp.status_code == 200
    return client
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_security.py tests/test_auth.py -v`
Expected: PASS（6 passed）。

> 注：`/api/auth/login` 路由本体在 T9 实现；本 task 仅中间件与 `expected_session` 校验逻辑。冷启动验证修订（2026-08-14）：T9 前临时于 `main.py` 加最小 login 路由（校验 `password == settings.admin_password` 后 set-cookie 并返回 200），同时 `create_app` 需先设置 `app.state.session_secret`（login stub 与中间件共用同一 secret，否则登录抛 `AttributeError`）；`/api/projects` 在 T3 阶段无路由，故 `test_login_then_access` 断言 404（已认证放行）而非 200——未认证 401 / 已认证 404 的区分正是本 task 的验证点，T9 实现真实路由后删除 stub。

- [ ] **Step 5: Commit**

```bash
git add backend/app/security.py backend/app/auth.py backend/tests/test_security.py backend/tests/test_auth.py backend/tests/conftest.py backend/app/main.py
git commit -m "task3: add credential crypto (AES-GCM, bcrypt), keyring bootstrap, session middleware (subagent: TBD)"
```

---

### Task 4: Git 数据采集模块

**目标**：实现 SPEC §3 M2：`GitProvider` 抽象 + GitHub 适配器（分页/限流错误透传）+ 同步服务（按 `since` 增量、sha 幂等去重、`sync_runs` 记录、失败不损坏已有数据、成功后触发重算钩子）。

**依赖**：T1、T2、T3（`decrypt_token`）。**可并行**：与 T5~T8 并行（同一 wave）。

**Files:**
- Create: `backend/app/providers/__init__.py`
- Create: `backend/app/providers/base.py`
- Create: `backend/app/providers/github.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/sync_service.py`
- Create: `backend/tests/test_github_provider.py`
- Create: `backend/tests/test_sync_service.py`

**Interfaces:**
- Consumes: `CommitInfo`（本 task 定义）、`models.Repository`、`models.Commit`、`models.SyncRun`、`decrypt_token`
- Produces: `GitProvider`（ABC，`list_commits(since: str | None) -> list[CommitInfo]`）、`GitHubProvider(repo_path, token, client=None)`、`parse_github_time(iso: str) -> datetime`、`sync_repository(db, repo, master_key, provider_factory=None, recompute=None) -> SyncRun`（`provider_factory` 与 `recompute` 可注入以便测试）

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_github_provider.py`：

```python
import httpx

from app.providers.github import GitHubProvider, parse_github_time


def fake_response(payload, link=None):
    return httpx.Response(200, json=payload, headers={"Link": link} if link else {})


def test_parse_github_time():
    dt = parse_github_time("2026-01-05T09:30:00Z")
    assert dt.year == 2026 and dt.month == 1 and dt.day == 5
    assert dt.hour == 9 and dt.minute == 30


def test_list_commits_single_page():
    def handler(request):
        return fake_response([
            {"sha": "abc123", "commit": {"author": {"name": "Alice", "email": "a@x.com", "date": "2026-01-05T09:30:00Z"}},
             "stats": {"additions": 10, "deletions": 2}, "files": [{"filename": "f1"}]},
        ])

    provider = GitHubProvider("org/repo", "ghp_fake", client=httpx.Client(transport=httpx.MockTransport(handler)))
    commits = provider.list_commits()
    assert len(commits) == 1
    c = commits[0]
    assert c.sha == "abc123" and c.author_email == "a@x.com"
    assert c.add_lines == 10 and c.del_lines == 2 and c.files_changed == 1


def test_pagination_follows_next_link():
    calls = []

    def handler(request):
        calls.append(request.url)
        if len(calls) == 1:
            return fake_response(
                [{"sha": "s1", "commit": {"author": {"name": "A", "email": "a@x.com", "date": "2026-01-05T09:30:00Z"}},
                  "stats": {}, "files": []}],
                link='<https://api.github.com/repos/org/repo/commits?page=2>; rel="next"',
            )
        return fake_response(
            [{"sha": "s2", "commit": {"author": {"name": "B", "email": "b@x.com", "date": "2026-01-05T10:00:00Z"}},
              "stats": {}, "files": []}],
        )

    provider = GitHubProvider("org/repo", "ghp_fake", client=httpx.Client(transport=httpx.MockTransport(handler)))
    commits = provider.list_commits()
    assert [c.sha for c in commits] == ["s1", "s2"]
```

创建 `backend/tests/test_sync_service.py`：

```python
from app import models
from app.providers.base import CommitInfo
from app.security import encrypt_token
from app.services.sync_service import sync_repository


class FakeProvider:
    def __init__(self, commits):
        self._commits = commits

    def list_commits(self, since=None):
        return self._commits


def make_repo(db):
    proj = models.Project(name="P")
    db.add(proj)
    db.commit()
    repo = models.Repository(project_id=proj.id, platform="github", repo_path="org/repo",
                             token_encrypted=encrypt_token("ghp_fake", "mk"), token_last4="ake0")
    db.add(repo)
    db.commit()
    return repo


def fake_commits():
    return [
        CommitInfo(sha="s1", author_name="Alice", author_email="a@x.com",
                   committed_at="2026-01-05T09:30:00Z", add_lines=10, del_lines=2, files_changed=1),
        CommitInfo(sha="s2", author_name="Bob", author_email="b@x.com",
                   committed_at="2026-01-05T10:00:00Z", add_lines=5, del_lines=0, files_changed=2),
    ]


def test_sync_inserts_commits(db_session):
    repo = make_repo(db_session)
    run = sync_repository(db_session, repo, "mk", provider_factory=lambda _r, _t: FakeProvider(fake_commits()))
    assert run.status == "success"
    assert db_session.query(models.Commit).filter_by(repository_id=repo.id).count() == 2


def test_sync_idempotent(db_session):
    repo = make_repo(db_session)
    for _ in range(2):
        sync_repository(db_session, repo, "mk", provider_factory=lambda _r, _t: FakeProvider(fake_commits()))
    assert db_session.query(models.Commit).filter_by(repository_id=repo.id).count() == 2


def test_sync_failure_keeps_data(db_session):
    repo = make_repo(db_session)

    class BoomProvider:
        def list_commits(self, since=None):
            raise RuntimeError("token invalid")

    run = sync_repository(db_session, repo, "mk", provider_factory=lambda _r, _t: BoomProvider())
    assert run.status == "failed"
    assert "token invalid" in run.error_message
    assert db_session.query(models.Commit).filter_by(repository_id=repo.id).count() == 0
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_github_provider.py tests/test_sync_service.py -v`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 最小实现**

创建 `backend/app/providers/__init__.py`（空文件）。

创建 `backend/app/providers/base.py`：

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class CommitInfo:
    sha: str
    author_name: str
    author_email: str
    committed_at: str  # ISO 8601，如 2026-01-05T09:30:00Z
    add_lines: int
    del_lines: int
    files_changed: int


class GitProvider(ABC):
    @abstractmethod
    def list_commits(self, since: str | None = None) -> list[CommitInfo]:
        """返回 since（ISO 8601，含）之后的 commit；分页由实现内部处理"""
```

创建 `backend/app/providers/github.py`：

```python
import re
from datetime import datetime, timezone

import httpx

from .base import CommitInfo, GitProvider


def parse_github_time(iso: str) -> datetime:
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _next_page_url(link_header: str) -> str | None:
    m = re.search(r'<([^>]+)>\s*;\s*rel="next"', link_header or "")
    return m.group(1) if m else None


class GitHubProvider(GitProvider):
    BASE = "https://api.github.com"

    def __init__(self, repo_path: str, token: str, client: httpx.Client | None = None):
        self.repo_path = repo_path
        self.client = client or httpx.Client(
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
            timeout=30.0,
        )

    def list_commits(self, since: str | None = None) -> list[CommitInfo]:
        params: dict = {"per_page": 100}
        if since:
            params["since"] = since
        url = f"{self.BASE}/repos/{self.repo_path}/commits"
        out: list[CommitInfo] = []
        while url:
            resp = self.client.get(url, params=params)
            resp.raise_for_status()  # 401/403/429 透传，由 sync_service 捕获
            for c in resp.json():
                out.append(CommitInfo(
                    sha=c["sha"],
                    author_name=c["commit"]["author"]["name"],
                    author_email=c["commit"]["author"]["email"],
                    committed_at=c["commit"]["author"]["date"],
                    add_lines=c.get("stats", {}).get("additions", 0),
                    del_lines=c.get("stats", {}).get("deletions", 0),
                    files_changed=len(c.get("files", [])),
                ))
            url = _next_page_url(resp.headers.get("Link", ""))
            params = {}
        return out
```

创建 `backend/app/services/__init__.py`（空文件）。

创建 `backend/app/services/sync_service.py`：

```python
from datetime import datetime

from .. import models
from ..providers.base import GitProvider
from ..providers.github import GitHubProvider, parse_github_time
from ..security import decrypt_token


def _provider_factory(repo: models.Repository, token: str) -> GitProvider:
    if repo.platform == "github":
        return GitHubProvider(repo.repo_path, token)
    raise ValueError(f"不支持的平台: {repo.platform}")


def sync_repository(db, repo: models.Repository, master_key: str,
                    provider_factory=None, recompute=None) -> models.SyncRun:
    """增量同步一个仓库（幂等）。recompute(db) 在成功后回调（T5/T8 注入）。"""
    factory = provider_factory or _provider_factory
    run = models.SyncRun(repository_id=repo.id, status="running",
                         started_at=datetime.utcnow())
    db.add(run)
    db.commit()
    db.refresh(run)
    try:
        token = decrypt_token(repo.token_encrypted, master_key)
        provider = factory(repo, token)
        since = repo.last_synced_at.isoformat() if repo.last_synced_at else None
        commits = provider.list_commits(since=since)
        fetched = 0
        for c in commits:
            exists = db.query(models.Commit).filter_by(repository_id=repo.id, sha=c.sha).first()
            if not exists:
                db.add(models.Commit(
                    repository_id=repo.id, sha=c.sha, author_name=c.author_name,
                    author_email=c.author_email, committed_at=parse_github_time(c.committed_at),
                    add_lines=c.add_lines, del_lines=c.del_lines, files_changed=c.files_changed,
                ))
                fetched += 1
        repo.last_synced_at = datetime.utcnow()
        run.status = "success"
        run.finished_at = datetime.utcnow()
        run.commits_fetched = fetched
        db.commit()
        if recompute:
            recompute(db)
    except Exception as e:  # noqa: BLE001
        db.rollback()
        run.status = "failed"
        run.finished_at = datetime.utcnow()
        run.error_message = str(e)
        db.commit()
    return run
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_github_provider.py tests/test_sync_service.py -v`
Expected: PASS（6 passed）。

- [ ] **Step 5: Commit**

```bash
git add backend/app/providers/ backend/app/services/
git add backend/tests/test_github_provider.py backend/tests/test_sync_service.py
git commit -m "task4: add GitProvider abstraction, GitHub adapter, idempotent sync service (subagent: TBD)"
```

---

### Task 5: 工时估算与统计模块

**目标**：实现 SPEC §3 M3 的估算口径（活跃段聚类 90 分钟 / 边界修正 30 分钟 / 段封顶 6h / 代码量系数 / 日封顶 12h / 周末 ×0.5）与聚合服务（WorkdayAggregate 日聚合 + IterationMetricSnapshot 迭代快照），全部确定性、可单测、口径参数可配；人工校正语义（SPEC §3.3 步骤 5）：`is_corrected=1` 时 `recompute_hours` 不覆盖已校正行，日聚合/迭代快照以 `corrected_hours` 为准（对应 SPEC §9 M3 验收"人工校正覆盖生效；口径参数可配置"，冷启动验证修订）。

**依赖**：T1、T2。**可并行**：与 T4、T6~T8 并行。

**Files:**
- Create: `backend/app/services/estimate_service.py`
- Create: `backend/app/services/aggregate_service.py`
- Create: `backend/tests/test_estimate_service.py`
- Create: `backend/tests/test_aggregate_service.py`

**Interfaces:**
- Consumes: `models.Commit`、`models.HoursEstimate`、`models.WorkdayAggregate`、`models.IterationMetricSnapshot`、`settings`（口径常量）
- Produces: `estimate_day(commits: list[models.Commit]) -> float`、`recompute_hours(db)`（重算全部 HoursEstimate，跳过 `is_corrected=1` 行）、`recompute_aggregates(db)`（日聚合 + 迭代快照，校正值优先）

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_estimate_service.py`（用 SPEC §3.3 口径手算断言）：

```python
from datetime import datetime, timedelta

from app import models
from app.services.estimate_service import estimate_day


def commit_at(h, m):
    return models.Commit(id=0, repository_id=1, sha="s", author_name="A", author_email="a@x.com",
                         committed_at=datetime(2026, 1, 5, h, m), add_lines=0, del_lines=0, files_changed=1)


def test_empty_returns_zero():
    assert estimate_day([]) == 0.0


def test_single_short_segment():
    # 09:00 与 09:30 同段：段时长 = 30min + 30min 边界 = 1.0h，代码量 0 → 系数 1.0
    commits = [commit_at(9, 0), commit_at(9, 30)]
    assert estimate_day(commits) == 1.0


def test_two_segments_summed():
    # 段1: 09:00-09:30 (1.0h)；段2: 14:00-14:30 (1.0h) → 2.0h
    commits = [commit_at(9, 0), commit_at(9, 30), commit_at(14, 0), commit_at(14, 30)]
    assert estimate_day(commits) == 2.0


def test_segment_cap_applies():
    # 09:00~16:30 每 90 分钟一个 commit → 同一活跃段：段长 7.5h + 0.5h = 8.0h，封顶 6h
    commits = [commit_at(9, 0), commit_at(10, 30), commit_at(12, 0),
               commit_at(13, 30), commit_at(15, 0), commit_at(16, 30)]
    assert estimate_day(commits) == 6.0


def test_volume_coefficient():
    # 09:00-09:30 (1.0h)，当日 add+del = 2000 行 → 系数 1.0 + clamp(2000/2000, -0.2, +0.5) = 1.5 → 1.5h
    c1, c2 = commit_at(9, 0), commit_at(9, 30)
    c1.add_lines, c2.add_lines = 1000, 1000
    assert estimate_day([c1, c2]) == 1.5


def test_daily_cap():
    # 三段：08:00-12:30 (5.0h)、14:30-19:00 (5.0h)、21:00-22:30 (2.0h) → 合计 12.0h → 日封顶 12h
    commits = [commit_at(8, 0), commit_at(9, 30), commit_at(11, 0), commit_at(12, 30),
               commit_at(14, 30), commit_at(16, 0), commit_at(17, 30), commit_at(19, 0),
               commit_at(21, 0), commit_at(22, 30)]
    assert estimate_day(commits) == 12.0


def test_weekend_factor():
    # 周六（2026-01-10）：09:00-09:30 → 1.0h × 0.5 = 0.5h
    c1 = commit_at(9, 0)
    c1.committed_at = datetime(2026, 1, 10, 9, 0)
    c2 = commit_at(9, 30)
    c2.committed_at = datetime(2026, 1, 10, 9, 30)
    assert estimate_day([c1, c2]) == 0.5


def test_config_params_affect_estimate(monkeypatch):
    # 口径参数可配（SPEC §9 M3 验收）：边界修正 30→60 分钟 → 段长 0.5h + 1.0h = 1.5h
    from app.config import settings
    monkeypatch.setattr(settings, "segment_boundary_minutes", 60)
    commits = [commit_at(9, 0), commit_at(9, 30)]
    assert estimate_day(commits) == 1.5


def test_recompute_hours_preserves_correction(db_session):
    # 人工校正（is_corrected=1）行不被重算覆盖（SPEC §3.3 步骤 5）
    from datetime import date

    from app.services.estimate_service import recompute_hours

    proj = models.Project(name="P")
    db_session.add(proj)
    db_session.commit()
    repo = models.Repository(project_id=proj.id, platform="github", repo_path="org/repo",
                             token_encrypted="x", token_last4="abcd")
    db_session.add(repo)
    db_session.commit()
    db_session.add_all([
        models.Commit(repository_id=repo.id, sha="a1", author_name="A", author_email="a@x.com",
                      committed_at=datetime(2026, 1, 5, 9, 0), add_lines=0, del_lines=0, files_changed=1),
        models.Commit(repository_id=repo.id, sha="a2", author_name="A", author_email="a@x.com",
                      committed_at=datetime(2026, 1, 5, 9, 30), add_lines=0, del_lines=0, files_changed=1),
    ])
    db_session.add(models.HoursEstimate(developer="a@x.com", date=date(2026, 1, 5), estimated_hours=7.0,
                                        is_corrected=True, corrected_hours=9.5, correction_note="人工"))
    db_session.commit()
    recompute_hours(db_session)
    row = db_session.query(models.HoursEstimate).filter_by(developer="a@x.com", date=date(2026, 1, 5)).first()
    assert row.estimated_hours == 7.0  # 原始估算保留，不被重算（1.0h）覆盖
    assert row.corrected_hours == 9.5
```

创建 `backend/tests/test_aggregate_service.py`：

```python
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


def test_aggregate_uses_corrected_hours(db_session):
    # 聚合以 corrected_hours 为准（is_corrected=1，SPEC §3.3 步骤 5 / §9 M3 验收）
    repo, it = seed(db_session)
    db_session.add(models.HoursEstimate(developer="a@x.com", date=date(2026, 1, 5), estimated_hours=1.0,
                                        is_corrected=True, corrected_hours=9.5, correction_note="人工"))
    db_session.commit()
    recompute_aggregates(db_session)
    day_agg = db_session.query(models.WorkdayAggregate).filter_by(developer="a@x.com").first()
    assert day_agg.estimated_hours == 9.5
    snap = db_session.query(models.IterationMetricSnapshot).filter_by(iteration_id=it.id, developer="a@x.com").first()
    assert snap.estimated_hours == 9.5
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_estimate_service.py tests/test_aggregate_service.py -v`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 最小实现**

创建 `backend/app/services/estimate_service.py`：

```python
from datetime import date

from .. import models
from ..config import settings


def estimate_day(commits: list[models.Commit]) -> float:
    """SPEC §3.3 估算口径：活跃段聚类 + 代码量系数 + 日封顶 + 周末因子"""
    times = sorted(c.committed_at for c in commits)
    if not times:
        return 0.0
    segments = []
    seg_start = seg_end = times[0]
    for t in times[1:]:
        gap_min = (t - seg_end).total_seconds() / 60
        if gap_min <= settings.cluster_gap_minutes:
            seg_end = t
        else:
            segments.append((seg_start, seg_end))
            seg_start = seg_end = t
    segments.append((seg_start, seg_end))

    total = 0.0
    for s, e in segments:
        span_h = (e - s).total_seconds() / 3600 + settings.segment_boundary_minutes / 60
        total += min(span_h, settings.segment_cap_hours)

    add = sum(c.add_lines for c in commits)
    dele = sum(c.del_lines for c in commits)
    ratio = (add + dele) / settings.lines_per_unit
    coef = 1.0 + max(settings.volume_coef_min, min(settings.volume_coef_max, ratio))

    hours = min(total * coef, settings.daily_cap_hours)
    if commits[0].committed_at.weekday() >= 5:
        hours *= settings.weekend_factor
    return round(hours, 2)


def recompute_hours(db) -> None:
    """重算全部 HoursEstimate（按 developer+date 分组 upsert）"""
    from collections import defaultdict

    groups: dict[tuple[str, date], list[models.Commit]] = defaultdict(list)
    for c in db.query(models.Commit).all():
        groups[(c.author_email, c.committed_at.date())].append(c)

    for (developer, day), commits in groups.items():
        est = estimate_day(commits)
        row = db.query(models.HoursEstimate).filter_by(developer=developer, date=day).first()
        if row is None:
            db.add(models.HoursEstimate(developer=developer, date=day, estimated_hours=est))
        else:
            row.estimated_hours = est
    db.commit()
```

创建 `backend/app/services/aggregate_service.py`：

```python
import json
from datetime import datetime

from .. import models
from .estimate_service import estimate_day


def recompute_aggregates(db) -> None:
    """日聚合（WorkdayAggregate）+ 迭代快照（IterationMetricSnapshot），确定性重算"""
    from collections import defaultdict

    groups: dict[tuple[str, object], list[models.Commit]] = defaultdict(list)
    for c in db.query(models.Commit).all():
        groups[(c.author_email, c.committed_at.date())].append(c)

    for (developer, day), commits in groups.items():
        total = len(commits)
        night = sum(1 for c in commits if c.committed_at.hour < 6) / total
        est = estimate_day(commits)
        row = db.query(models.WorkdayAggregate).filter_by(developer=developer, date=day).first()
        if row is None:
            db.add(models.WorkdayAggregate(developer=developer, date=day, commits=total,
                                           estimated_hours=est, night_commit_ratio=round(night, 2)))
        else:
            row.commits = total
            row.estimated_hours = est
            row.night_commit_ratio = round(night, 2)
    db.commit()

    for it in db.query(models.Iteration).all():
        start = datetime.combine(it.start_date, datetime.min.time())
        end = datetime.combine(it.end_date, datetime.max.time())
        devs: dict[str, dict] = {}
        for c in db.query(models.Commit).filter(
                models.Commit.committed_at >= start,
                models.Commit.committed_at <= end).all():
            d = devs.setdefault(c.author_email, {"commits": 0, "lines": 0, "days": set()})
            d["commits"] += 1
            d["lines"] += c.add_lines + c.del_lines
            d["days"].add(c.committed_at.date())
        db.query(models.IterationMetricSnapshot).filter_by(iteration_id=it.id).delete()
        for dev, d in devs.items():
            # 迭代工时 = 窗口内按 (dev, date) 分组的日估算之和
            daily: dict[object, list[models.Commit]] = defaultdict(list)
            for c in db.query(models.Commit).filter(
                    models.Commit.author_email == dev,
                    models.Commit.committed_at >= start,
                    models.Commit.committed_at <= end).all():
                daily[c.committed_at.date()].append(c)
            hours = round(sum(estimate_day(v) for v in daily.values()), 2)
            db.add(models.IterationMetricSnapshot(
                iteration_id=it.id, developer=dev, commits=d["commits"],
                estimated_hours=hours,
                metrics_json=json.dumps({"active_days": len(d["days"]), "lines": d["lines"]}),
            ))
    db.commit()
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_estimate_service.py tests/test_aggregate_service.py -v`
Expected: PASS（11 passed）。

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/estimate_service.py backend/app/services/aggregate_service.py
git add backend/tests/test_estimate_service.py backend/tests/test_aggregate_service.py
git commit -m "task5: add work-hour estimation (SPEC 口径) and aggregation services (subagent: TBD)"
```

---

### Task 6: 风险信号规则引擎

**目标**：实现 SPEC §3 M4 的 RS-1~RS-5 确定性规则引擎（提交频率骤降 / 长沉默期 / 凌晨赶工 / 单日爆量 / 迭代末期集中），输出 `RiskSignal(code, level, description)`，纯函数、无 IO、可单测。

**依赖**：T1（config）。**可并行**：与 T4、T5、T7、T8 并行。

**Files:**
- Create: `backend/app/services/risk_engine.py`
- Create: `backend/tests/test_risk_engine.py`

**Interfaces:**
- Consumes: 无外部依赖（纯函数）
- Produces: `RiskSignal`（dataclass：code/level/description）、`evaluate_iteration_risk(daily_commits: dict[str, int], start: date, end: date, night_ratio: float) -> list[RiskSignal]`（`daily_commits` 键为 `"YYYY-MM-DD"`，可含迭代前数据用于对比）

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_risk_engine.py`：

```python
from datetime import date, timedelta

from app.services.risk_engine import evaluate_iteration_risk


def _days(start, counts):
    """start 起每天提交数 → {YYYY-MM-DD: n}"""
    out = {}
    d = start
    for n in counts:
        out[d.isoformat()] = n
        d += timedelta(days=1)
    return out


def test_rs1_commit_frequency_drop():
    # 前 4 周每天 10 次，本周每天 2 次 → 下降 80% ≥ 50%
    start = date(2026, 1, 5)  # 周一
    daily = _days(start - timedelta(days=28), [10] * 28)
    daily.update(_days(start, [2] * 5))
    signals = evaluate_iteration_risk(daily, start, start, night_ratio=0.0)
    assert any(s.code == "RS-1" and s.level == "high" for s in signals)


def test_rs2_long_silence():
    start = date(2026, 1, 5)
    daily = {start.isoformat(): 1}  # 只有迭代首日有提交，后续 4 个工作日沉默
    signals = evaluate_iteration_risk(daily, start, start + timedelta(days=6), night_ratio=0.0)
    assert any(s.code == "RS-2" and s.level == "high" for s in signals)


def test_rs3_night_ratio():
    start = date(2026, 1, 5)
    daily = _days(start, [5] * 5)
    signals = evaluate_iteration_risk(daily, start, start, night_ratio=0.35)
    assert any(s.code == "RS-3" and s.level == "medium" for s in signals)


def test_rs4_single_day_spike():
    start = date(2026, 1, 5)
    daily = _days(start - timedelta(days=7), [1] * 7)
    daily.update(_days(start, [1, 1, 1, 50, 1]))  # 某日 50 ≥ 近4周日均(≈1) 的 3 倍
    signals = evaluate_iteration_risk(daily, start, start + timedelta(days=4), night_ratio=0.0)
    assert any(s.code == "RS-4" and s.level == "medium" for s in signals)


def test_rs5_tail_concentration():
    # 10 天迭代，后 1/3（第 8-10 天）占 80%
    start = date(2026, 1, 5)
    daily = _days(start, [0, 0, 0, 0, 0, 0, 0, 20, 20, 20])
    signals = evaluate_iteration_risk(daily, start, start + timedelta(days=9), night_ratio=0.0)
    assert any(s.code == "RS-5" and s.level == "medium" for s in signals)


def test_quiet_week_no_signals():
    start = date(2026, 1, 5)
    daily = _days(start, [3] * 5)
    assert evaluate_iteration_risk(daily, start, start + timedelta(days=4), night_ratio=0.1) == []
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_risk_engine.py -v`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 最小实现**

创建 `backend/app/services/risk_engine.py`：

```python
from dataclasses import dataclass
from datetime import date, datetime, timedelta


@dataclass
class RiskSignal:
    code: str
    level: str  # high|medium|low
    description: str


def _parse(d: str) -> date:
    return datetime.fromisoformat(d).date()


def evaluate_iteration_risk(daily_commits: dict[str, int],
                            start: date, end: date,
                            night_ratio: float) -> list[RiskSignal]:
    """SPEC §3 M4 RS-1~RS-5。daily_commits 键为 YYYY-MM-DD，可含迭代前数据。"""
    signals: list[RiskSignal] = []
    days = sorted(daily_commits)
    total_in_range = sum(v for k, v in daily_commits.items() if start <= _parse(k) <= end)
    if total_in_range == 0:
        return signals

    # RS-1 提交频率骤降：最近 7 天 vs 前 4 周均值
    today = end
    recent = [k for k in days if (today - timedelta(days=7)) < _parse(k) <= today]
    prev = [k for k in days if (today - timedelta(days=35)) < _parse(k) <= (today - timedelta(days=7))]
    if prev:
        recent_avg = sum(daily_commits[k] for k in recent) / max(len(recent), 1)
        prev_avg = sum(daily_commits[k] for k in prev) / len(prev)
        if prev_avg > 0 and recent_avg < prev_avg * 0.5:
            signals.append(RiskSignal("RS-1", "high",
                                      f"提交频率骤降：近 7 天日均 {recent_avg:.1f}，较前 4 周均值 {prev_avg:.1f} 下降超 50%"))

    # RS-2 长沉默期：迭代内连续 ≥3 个工作日无提交
    d = start
    silence = 0
    while d <= end:
        if d.weekday() < 5 and daily_commits.get(d.isoformat(), 0) == 0:
            silence += 1
            if silence >= 3:
                signals.append(RiskSignal("RS-2", "high", f"连续 {silence} 个工作日无提交（截至 {d.isoformat()}）"))
                break
        else:
            silence = 0
        d += timedelta(days=1)

    # RS-3 凌晨赶工
    if night_ratio >= 0.3:
        signals.append(RiskSignal("RS-3", "medium", f"凌晨（0–6 点）提交占比 {night_ratio:.0%}，存在赶工迹象"))

    # RS-4 单日爆量：迭代内某日 ≥ 基线日均 3 倍
    baseline_days = [k for k in days if _parse(k) < start]
    if baseline_days:
        base_avg = sum(daily_commits[k] for k in baseline_days) / len(baseline_days)
        for k in days:
            if start <= _parse(k) <= end and base_avg > 0 and daily_commits[k] >= base_avg * 3:
                signals.append(RiskSignal("RS-4", "medium",
                                          f"单日爆量：{k} 提交 {daily_commits[k]} 次，达基线日均 {base_avg:.1f} 的 3 倍以上"))
                break

    # RS-5 迭代末期集中：后 1/3 时间窗提交占比 ≥ 60%
    span = (end - start).days + 1
    if span >= 3:
        tail_start = end - timedelta(days=span // 3 - 1)
        tail = sum(v for k, v in daily_commits.items() if tail_start <= _parse(k) <= end)
        if tail / total_in_range >= 0.6:
            signals.append(RiskSignal("RS-5", "medium",
                                      f"迭代末期集中：后 {span // 3} 天提交占比 {tail / total_in_range:.0%} ≥ 60%"))

    return signals
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_risk_engine.py -v`
Expected: PASS（6 passed）。

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/risk_engine.py backend/tests/test_risk_engine.py
git commit -m "task6: add deterministic risk signal rule engine RS-1..5 (subagent: TBD)"
```

---

### Task 7: LLM 报告生成服务

**目标**：实现 SPEC §3 M4：OpenAI 兼容 `/chat/completions` 单轮调用（base URL/模型/超时可配）、prompt 构造（周报/风险分析两种）、JSON 解析与降级（无 key 报错、非 JSON 存原文标记 unstructured）、超时不自动重试。

**依赖**：T1、T2、T6（`RiskSignal` 入 prompt）。**可并行**：与 T4、T5、T8 并行。

**Files:**
- Create: `backend/app/services/llm_service.py`
- Create: `backend/tests/test_llm_service.py`

**Interfaces:**
- Consumes: `settings.llm_api_key / llm_base_url / llm_model / llm_timeout`、`RiskSignal`
- Produces: `LLMError(Exception)`、`generate_report(prompt: str, schema_hint: str, client: httpx.Client | None = None) -> dict`（`client` 注入 mock transport）、`build_weekly_prompt(metrics: dict, scope: str) -> str`、`build_risk_prompt(metrics: dict, signals: list[RiskSignal]) -> str`

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_llm_service.py`：

```python
import httpx
import pytest

from app.config import settings
from app.services.llm_service import LLMError, build_risk_prompt, build_weekly_prompt, generate_report
from app.services.risk_engine import RiskSignal


def mock_client(payload):
    def handler(request):
        return httpx.Response(200, json=payload)
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_no_key_raises(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", None)
    with pytest.raises(LLMError):
        generate_report("p", "schema")


def test_generate_parses_json(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "sk-fake")
    client = mock_client({"choices": [{"message": {"content": '{"summary": "本周进展正常"}'}}]})
    result = generate_report("p", "schema", client=client)
    assert result == {"summary": "本周进展正常"}


def test_generate_unstructured_fallback(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "sk-fake")
    client = mock_client({"choices": [{"message": {"content": "not json at all"}}]})
    result = generate_report("p", "schema", client=client)
    assert result["unstructured"] is True
    assert result["raw"] == "not json at all"


def test_http_error_raises(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "sk-fake")

    def handler(request):
        return httpx.Response(500, json={"error": "boom"})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(LLMError):
        generate_report("p", "schema", client=client)


def test_prompts_contain_data_and_constraints():
    weekly = build_weekly_prompt({"project": "P", "total_hours": 120.0}, "project")
    assert "120.0" in weekly and "禁止编造" in weekly
    risk = build_risk_prompt({"iteration": "I1"}, [RiskSignal("RS-1", "high", "提交骤降")])
    assert "RS-1" in risk and "提交骤降" in risk
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_llm_service.py -v`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 最小实现**

创建 `backend/app/services/llm_service.py`：

```python
import json

import httpx

from ..config import settings
from .risk_engine import RiskSignal


class LLMError(Exception):
    pass


def build_weekly_prompt(metrics: dict, scope: str) -> str:
    return (
        "你是研发管理分析师。请基于以下指标快照生成一份研发周报，"
        "只依据给定数据，禁止编造任何数字或事实。\n"
        f"范围：{scope}\n指标快照：\n{json.dumps(metrics, ensure_ascii=False)}\n"
    )


def build_risk_prompt(metrics: dict, signals: list[RiskSignal]) -> str:
    signal_text = "\n".join(f"- [{s.code}] ({s.level}) {s.description}" for s in signals)
    return (
        "你是研发管理分析师。以下是迭代指标与规则引擎预计算的风险信号，"
        "请为每个风险信号撰写归因分析与缓解建议，只依据给定数据，禁止编造。\n"
        f"指标：\n{json.dumps(metrics, ensure_ascii=False)}\n风险信号：\n{signal_text}\n"
    )


def generate_report(prompt: str, schema_hint: str,
                    client: httpx.Client | None = None) -> dict:
    if not settings.llm_api_key:
        raise LLMError("LLM_API_KEY 未配置：无法生成报告，可降级使用纯统计视图")
    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system",
             "content": "你是研发管理分析师。只依据给定数据作答，禁止编造。输出必须为合法 JSON。"},
            {"role": "user", "content": prompt + f"\n输出 JSON 格式：{schema_hint}"},
        ],
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }
    own = client is None
    http = client or httpx.Client(timeout=settings.llm_timeout)
    try:
        resp = http.post(
            f"{settings.llm_base_url}/chat/completions",
            headers={"Authorization": f"Bearer {settings.llm_api_key}"},
            json=payload,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
    except Exception as e:  # noqa: BLE001
        raise LLMError(f"LLM 调用失败: {e}") from e
    finally:
        if own:
            http.close()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {"raw": content, "unstructured": True}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_llm_service.py -v`
Expected: PASS（5 passed）。

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/llm_service.py backend/tests/test_llm_service.py
git commit -m "task7: add single-turn LLM report generation service with JSON fallback (subagent: TBD)"
```

---

### Task 8: 报告管理服务

**目标**：实现 SPEC §3 M5：Report/ReportVersion 的创建、版本递增、历史回看/恢复、Markdown 导出（最新版本内容 + 报告元信息头）。

**依赖**：T1、T2。**可并行**：与 T4~T7 并行。

**Files:**
- Create: `backend/app/services/report_service.py`
- Create: `backend/tests/test_report_service.py`

**Interfaces:**
- Consumes: `models.Report`、`models.ReportVersion`
- Produces: `create_report(db, project_id, type_, scope, content_md, llm_model=None, iteration_id=None) -> Report`（自动写入 version 1，source="llm"）、`add_version(db, report_id, content_md, source) -> ReportVersion`（version = max+1）、`list_versions(db, report_id) -> list[ReportVersion]`（升序）、`restore_version(db, report_id, version) -> ReportVersion`（恢复 = 以该版本内容新增一个 human 版本）、`export_markdown(report, latest) -> str`

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_report_service.py`：

```python
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
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_report_service.py -v`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 最小实现**

创建 `backend/app/services/report_service.py`：

```python
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
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_report_service.py -v`
Expected: PASS（4 passed）。

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/report_service.py backend/tests/test_report_service.py
git commit -m "task8: add report management service (versions, restore, markdown export) (subagent: TBD)"
```

---

### Task 9: 配置与认证 API（项目/仓库/迭代 + Token 管理）

**目标**：实现 SPEC §3 M1 与认证路由：登录/登出、项目/仓库/迭代 CRUD、Token 录入（隐藏输入语义由前端保证，后端只存密文+last4）/更新/清除、重复仓库拒绝、迭代日期重叠拒绝、删除项目二次确认（`confirm=true` 查询参数）。

**依赖**：T2、T3。**可并行**：T10/T11 的串行前置（它们依赖本 task 的 API 骨架）。

**Files:**
- Create: `backend/app/schemas.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/auth.py`
- Create: `backend/app/routers/projects.py`
- Modify: `backend/app/main.py`（注册路由、DB 覆盖钩子、静态托管）
- Modify: `backend/tests/conftest.py`（`settings.master_key` 测试值 + db 注入 client）
- Create: `backend/tests/test_api_projects.py`

**Interfaces:**
- Consumes: `models.*`、`encrypt_token`、`expected_session`、`settings`
- Produces: `create_app(secret=None, db=None)`（`db` 为 session 工厂，测试注入内存库）、路由：`POST /api/auth/login`、`POST /api/auth/logout`、`GET/POST /api/projects`、`DELETE /api/projects/{id}?confirm=`、`POST /api/projects/{id}/repositories`、`DELETE /api/repositories/{id}`、`GET /api/repositories/{id}/token-status`、`PUT/DELETE /api/repositories/{id}/token`、`GET/POST /api/projects/{id}/iterations`

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_api_projects.py`：

```python
def test_login_wrong_password(client):
    resp = client.post("/api/auth/login", json={"password": "nope"})
    assert resp.status_code == 401


def test_crud_project(authed_client):
    r = authed_client.post("/api/projects", json={"name": "平台组", "description": "内部平台"})
    assert r.status_code == 200
    pid = r.json()["id"]
    lst = authed_client.get("/api/projects").json()
    assert len(lst) == 1 and lst[0]["name"] == "平台组"


def test_repo_token_stored_encrypted(authed_client, db_session):
    pid = authed_client.post("/api/projects", json={"name": "P"}).json()["id"]
    r = authed_client.post(f"/api/projects/{pid}/repositories",
                           json={"platform": "github", "repo_path": "org/repo", "token": "ghp_fake1234567890"})
    assert r.status_code == 200
    body = r.json()
    assert body["token_last4"] == "7890"
    assert "token" not in body
    from app import models
    repo = db_session.query(models.Repository).first()
    assert repo.token_encrypted != "ghp_fake1234567890"


def test_repo_duplicate_path_rejected(authed_client):
    pid = authed_client.post("/api/projects", json={"name": "P"}).json()["id"]
    body = {"platform": "github", "repo_path": "org/repo", "token": "ghp_fake1234567890"}
    assert authed_client.post(f"/api/projects/{pid}/repositories", json=body).status_code == 200
    assert authed_client.post(f"/api/projects/{pid}/repositories", json=body).status_code == 400


def test_token_status_shows_last4_only(authed_client):
    pid = authed_client.post("/api/projects", json={"name": "P"}).json()["id"]
    rid = authed_client.post(f"/api/projects/{pid}/repositories",
                             json={"platform": "github", "repo_path": "org/repo", "token": "ghp_fake1234567890"}).json()["id"]
    status = authed_client.get(f"/api/repositories/{rid}/token-status").json()
    assert status["last4"] == "7890"
    assert "token" not in status


def test_iteration_overlap_rejected(authed_client):
    pid = authed_client.post("/api/projects", json={"name": "P"}).json()["id"]
    first = {"name": "I1", "start_date": "2026-01-05", "end_date": "2026-01-16"}
    assert authed_client.post(f"/api/projects/{pid}/iterations", json=first).status_code == 200
    overlap = {"name": "I2", "start_date": "2026-01-12", "end_date": "2026-01-23"}
    assert authed_client.post(f"/api/projects/{pid}/iterations", json=overlap).status_code == 400


def test_delete_project_requires_confirm(authed_client):
    pid = authed_client.post("/api/projects", json={"name": "P"}).json()["id"]
    assert authed_client.delete(f"/api/projects/{pid}").status_code == 400
    assert authed_client.delete(f"/api/projects/{pid}?confirm=true").status_code == 200
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_api_projects.py -v`
Expected: FAIL（404 / 模块不存在）。

- [ ] **Step 3: 最小实现**

创建 `backend/app/schemas.py`：

```python
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
```

创建 `backend/app/routers/__init__.py`（空文件）。

创建 `backend/app/routers/auth.py`：

```python
from fastapi import APIRouter, HTTPException, Request, Response

from ..auth import SESSION_COOKIE, expected_session
from ..schemas import LoginRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(body: LoginRequest, request: Request, response: Response):
    from ..config import settings
    if body.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="口令错误")
    secret = request.app.state.session_secret
    response.set_cookie(SESSION_COOKIE, expected_session(secret), httponly=True, samesite="lax")
    return {"ok": True}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}
```

创建 `backend/app/routers/projects.py`：

```python
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
```

修改 `backend/app/main.py`：

```python
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Callable

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .auth import AuthMiddleware
from .db import engine, get_db, init_db
from .routers import auth as auth_router
from .routers import projects as projects_router
from .routers import reports as reports_router
from .routers import stats as stats_router
from .routers import sync as sync_router


def create_app(secret: str | None = None, db: Callable | None = None) -> FastAPI:
    from .config import settings

    if db is None:
        @asynccontextmanager
        async def lifespan(_app: FastAPI):
            init_db(engine)
            yield

        app = FastAPI(title="研发任务智能统计与工时分析平台", lifespan=lifespan)
    else:
        app = FastAPI(title="研发任务智能统计与工时分析平台")
        app.dependency_overrides[get_db] = db

    app.state.session_secret = secret or settings.session_secret
    app.add_middleware(AuthMiddleware, secret=app.state.session_secret)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    app.include_router(auth_router.router)
    app.include_router(projects_router.router)
    app.include_router(sync_router.router)
    app.include_router(stats_router.router)
    app.include_router(reports_router.router)

    dist = Path(__file__).resolve().parent.parent / "static"
    if dist.exists():
        app.mount("/", StaticFiles(directory=dist, html=True), name="static")
    return app
```

> 注：`sync/stats/reports` 路由在 T10/T11 实现；本 task 先注册，模块缺失会导致 import 失败——**实现顺序**：先建三个空 router 占位文件（各含 `router = APIRouter()`），T10/T11 再填充。

修改 `backend/tests/conftest.py`（整体替换为，注意用 StaticPool 共享内存库连接，保证 API 写入与 db_session 查询同库可见）：

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.db import Base
from app.main import create_app

TEST_MASTER_KEY = "test-master-key-123456"


@pytest.fixture()
def db_engine():
    engine = create_engine("sqlite://",
                           connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture()
def db_session(db_engine):
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture()
def db_factory(db_engine):
    Session = sessionmaker(bind=db_engine)

    def factory():
        return Session()

    return factory


@pytest.fixture()
def client(db_factory, monkeypatch):
    monkeypatch.setattr(settings, "master_key", TEST_MASTER_KEY)
    return TestClient(create_app(secret="test-secret", db=db_factory))


@pytest.fixture()
def authed_client(client):
    resp = client.post("/api/auth/login", json={"password": "changeme"})
    assert resp.status_code == 200
    return client
```

> 注意：conftest 的 `client` fixture 现在依赖 `db_factory`；`test_auth.py` 中手工构造的 `make_client`（无 db 注入）会导致 `/api/projects` 走全局引擎写真实 `devhours.db`——**请把 test_auth 的三个用例改为使用 conftest 的 `client` / `authed_client` fixture**（见文末「执行注意事项」）。

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_api_projects.py tests/test_auth.py -v`
Expected: PASS（auth 3 + projects 6 = 9 passed）。

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas.py backend/app/routers/ backend/app/main.py backend/tests/conftest.py backend/tests/test_api_projects.py
git commit -m "task9: add config & auth API (projects/repos/iterations/token) with encrypted token storage (subagent: TBD)"
```

---

### Task 10: 同步与统计 API

**目标**：实现 SPEC §3 M1/M6 的同步触发与统计端点：触发同步（返回运行状态）、同步记录列表、总览/个人/迭代统计（从快照聚合，P95 < 300ms）。

**依赖**：T9（API 骨架）、T4（sync_service）、T5（聚合）。**可并行**：与 T11 并行。

**Files:**
- Create: `backend/app/routers/sync.py`
- Create: `backend/app/routers/stats.py`
- Create: `backend/tests/test_api_sync_stats.py`

**Interfaces:**
- Consumes: `sync_repository`、`recompute_aggregates`、`models`、`ensure_master_key`
- Produces: `POST /api/repositories/{id}/sync -> SyncRunOut`、`GET /api/repositories/{id}/sync-runs -> list`、`GET /api/stats/overview`、`GET /api/stats/developers`、`GET /api/stats/iterations/{id}`

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_api_sync_stats.py`：

```python
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
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_api_sync_stats.py -v`
Expected: FAIL（404）。

- [ ] **Step 3: 最小实现**

创建 `backend/app/routers/sync.py`：

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..security import ensure_master_key
from ..services.aggregate_service import recompute_aggregates
from ..services.sync_service import sync_repository

router = APIRouter(prefix="/api", tags=["sync"])


@router.post("/repositories/{repository_id}/sync")
def trigger_sync(repository_id: int, db: Session = Depends(get_db)):
    repo = db.get(models.Repository, repository_id)
    if repo is None:
        raise HTTPException(status_code=404, detail="仓库不存在")
    run = sync_repository(db, repo, ensure_master_key(), recompute=recompute_aggregates)
    return {"id": run.id, "repository_id": run.repository_id, "status": run.status,
            "started_at": run.started_at, "finished_at": run.finished_at,
            "commits_fetched": run.commits_fetched, "error_message": run.error_message}


@router.get("/repositories/{repository_id}/sync-runs")
def list_sync_runs(repository_id: int, db: Session = Depends(get_db)):
    return [
        {"id": r.id, "status": r.status, "started_at": r.started_at, "finished_at": r.finished_at,
         "commits_fetched": r.commits_fetched, "error_message": r.error_message}
        for r in db.query(models.SyncRun).filter_by(repository_id=repository_id)
        .order_by(models.SyncRun.id.desc()).limit(20).all()
    ]
```

创建 `backend/app/routers/stats.py`：

```python
import json
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..services.risk_engine import evaluate_iteration_risk

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    rows = db.query(models.WorkdayAggregate).all()
    total_hours = sum(r.estimated_hours for r in rows)
    total_commits = sum(r.commits for r in rows)
    developers = {r.developer for r in rows}
    trend: dict[str, int] = defaultdict(int)
    for r in rows:
        trend[r.date.isoformat()] += r.commits
    return {"total_hours": round(total_hours, 2), "total_commits": total_commits,
            "active_developers": len(developers),
            "trend": [{"date": k, "commits": v} for k, v in sorted(trend.items())]}


@router.get("/developers")
def developers(db: Session = Depends(get_db)):
    rows = db.query(models.WorkdayAggregate).all()
    by_dev: dict[str, dict] = {}
    for r in rows:
        d = by_dev.setdefault(r.developer, {"commits": 0, "hours": 0.0, "active_days": 0})
        d["commits"] += r.commits
        d["hours"] += r.estimated_hours
        d["active_days"] += 1
    return [{"developer": k, **v} for k, v in sorted(by_dev.items())]


@router.get("/iterations/{iteration_id}")
def iteration_stats(iteration_id: int, db: Session = Depends(get_db)):
    it = db.get(models.Iteration, iteration_id)
    if it is None:
        raise HTTPException(status_code=404, detail="迭代不存在")
    snapshots = db.query(models.IterationMetricSnapshot).filter_by(iteration_id=iteration_id).all()
    daily: dict[str, int] = defaultdict(int)
    night_commits = total = 0
    start = datetime.combine(it.start_date, datetime.min.time())
    end = datetime.combine(it.end_date, datetime.max.time())
    for c in db.query(models.Commit).filter(models.Commit.committed_at >= start,
                                            models.Commit.committed_at <= end).all():
        daily[c.committed_at.date().isoformat()] += 1
        total += 1
        if c.committed_at.hour < 6:
            night_commits += 1
    night_ratio = night_commits / total if total else 0.0
    signals = evaluate_iteration_risk(dict(daily), it.start_date, it.end_date, night_ratio)
    return {
        "iteration": {"id": it.id, "name": it.name, "start_date": it.start_date.isoformat(),
                      "end_date": it.end_date.isoformat()},
        "total_commits": total,
        "night_ratio": round(night_ratio, 2),
        "daily": [{"date": k, "commits": v} for k, v in sorted(daily.items())],
        "developers": [{"developer": s.developer, "commits": s.commits,
                        "estimated_hours": s.estimated_hours,
                        "metrics": json.loads(s.metrics_json)} for s in snapshots],
        "signals": [{"code": s.code, "level": s.level, "description": s.description} for s in signals],
    }
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_api_sync_stats.py -v`
Expected: PASS（4 passed）。

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/sync.py backend/app/routers/stats.py backend/tests/test_api_sync_stats.py
git commit -m "task10: add sync trigger and stats API (overview/developers/iteration) (subagent: TBD)"
```

---

### Task 11: 报告 API

**目标**：实现 SPEC §3 M4/M5 的报告生成与管理端点：生成（周报/风险分析，LLM 单轮，失败明确报错且可降级）、列表、详情+版本、编辑保存新版本、恢复历史、导出 Markdown。

**依赖**：T9（API 骨架）、T7（llm_service）、T8（report_service）、T6（风险信号）。**可并行**：与 T10 并行。

**Files:**
- Create: `backend/app/routers/reports.py`
- Create: `backend/tests/test_api_reports.py`

**Interfaces:**
- Consumes: `llm_service.generate_report / build_weekly_prompt / build_risk_prompt`、`risk_engine.evaluate_iteration_risk`、`report_service.*`、`models`
- Produces: `POST /api/reports/generate`、`GET /api/reports?project_id=`、`GET /api/reports/{id}`、`PUT /api/reports/{id}`（含 `status` 可选）、`POST /api/reports/{id}/restore`、`GET /api/reports/{id}/export`（`text/markdown`）

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_api_reports.py`：

```python
def make_project(authed_client):
    return authed_client.post("/api/projects", json={"name": "P"}).json()["id"]


def test_generate_weekly_with_mock_llm(authed_client, monkeypatch):
    from app.services import llm_service

    def fake_generate(prompt, schema_hint, client=None):
        return {"summary": "本周进展正常", "highlights": ["完成登录模块"], "risks": [], "suggestions": ["继续"]}

    monkeypatch.setattr(llm_service, "generate_report", fake_generate)
    pid = make_project(authed_client)
    r = authed_client.post("/api/reports/generate", json={"project_id": pid, "type": "weekly", "scope": "project"})
    assert r.status_code == 200
    body = r.json()
    assert body["type"] == "weekly" and body["status"] == "draft"
    assert "本周进展正常" in body["content_md"]


def test_generate_without_llm_key_fails_clearly(authed_client, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "llm_api_key", None)
    pid = make_project(authed_client)
    r = authed_client.post("/api/reports/generate", json={"project_id": pid, "type": "weekly", "scope": "project"})
    assert r.status_code == 400
    assert "LLM" in r.json()["detail"]


def test_edit_saves_new_version(authed_client, monkeypatch):
    from app.services import llm_service
    monkeypatch.setattr(llm_service, "generate_report",
                        lambda p, s, client=None: {"summary": "草稿"})
    pid = make_project(authed_client)
    rid = authed_client.post("/api/reports/generate", json={"project_id": pid, "type": "weekly", "scope": "project"}).json()["id"]
    r = authed_client.put(f"/api/reports/{rid}", json={"content_md": "人工修订稿", "status": "final"})
    assert r.status_code == 200
    detail = authed_client.get(f"/api/reports/{rid}").json()
    assert len(detail["versions"]) == 2
    assert detail["status"] == "final"
    assert detail["content_md"] == "人工修订稿"


def test_export_returns_markdown(authed_client, monkeypatch):
    from app.services import llm_service
    monkeypatch.setattr(llm_service, "generate_report",
                        lambda p, s, client=None: {"summary": "草稿"})
    pid = make_project(authed_client)
    rid = authed_client.post("/api/reports/generate", json={"project_id": pid, "type": "weekly", "scope": "project"}).json()["id"]
    r = authed_client.get(f"/api/reports/{rid}/export")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/markdown")
    assert "weekly" in r.text
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_api_reports.py -v`
Expected: FAIL（404）。

- [ ] **Step 3: 最小实现**

创建 `backend/app/routers/reports.py`：

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..services import llm_service, report_service
from ..services.llm_service import LLMError

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
            result = llm_service.generate_report(
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
            result = llm_service.generate_report(
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
```

> 注：`generate` 中引用的 `iteration_stats` 来自 `stats.py`，在文件顶部导入：`from .stats import iteration_stats`。实现时补上该 import。

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_api_reports.py -v`
Expected: PASS（4 passed）。

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/reports.py backend/tests/test_api_reports.py
git commit -m "task11: add reports API (generate/edit/versions/restore/export) (subagent: TBD)"
```

---

### Task 12: 前端脚手架与登录页

**目标**：建立 Vite + React + TS 工程（vitest/jsdom 就绪）、Open Design 风格设计令牌、API 客户端（fetch 封装 + 401 跳转 + 错误透传）、路由骨架与登录页（隐藏输入、错误提示、登录后跳转）。

**依赖**：T1（Makefile frontend-test 目标）。**可并行**：与 T13~T16 串行前置（后续页面依赖路由/客户端）。

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/tests/LoginPage.test.tsx`

**Interfaces:**
- Consumes: 无（新建工程）
- Produces: `api<T>(path, options)`、`authApi.login/logout`、`App`（路由：`/login`、`/`、`/developers`、`/iterations/:id`、`/config`、`/reports/:id`）、`LoginPage`

- [ ] **Step 1: 写失败测试**

创建 `frontend/tests/LoginPage.test.tsx`：

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "../src/pages/LoginPage";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls login api with password on submit", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText("password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ password: "secret" }) }),
    );
  });

  it("shows error message on wrong password", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 401, json: async () => ({ detail: "口令错误" }),
    }));
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText("password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("口令错误");
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npm install && npx vitest run`
Expected: FAIL（`LoginPage.test.tsx` 引用的模块不存在）。

- [ ] **Step 3: 最小实现**

创建 `frontend/package.json`：

```json
{
  "name": "dev-hours-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "echarts": "^5.5.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.3",
    "vitest": "^2.1.8"
  }
}
```

创建 `frontend/vite.config.ts`：

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
```

创建 `frontend/tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

创建 `frontend/index.html`：

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>研发工时统计平台</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

创建 `frontend/src/api/client.ts`：

```ts
const BASE = "/api";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const resp = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (resp.status === 401 && !path.startsWith("/auth/")) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.detail ?? "request failed");
  }
  return resp.json() as Promise<T>;
}

export const authApi = {
  login: (password: string) => api<{ ok: boolean }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  }),
  logout: () => api<{ ok: boolean }>("/auth/logout", { method: "POST" }),
};
```

创建 `frontend/src/styles/tokens.css`（Open Design 风格数据仪表盘令牌）：

```css
:root {
  --bg: #f5f6f8;
  --surface: #ffffff;
  --border: #e2e5ea;
  --text: #1a2233;
  --text-secondary: #5c6675;
  --accent: #2563eb;
  --accent-soft: #eff4ff;
  --danger: #dc2626;
  --warning: #d97706;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(16, 24, 40, 0.08);
}
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: var(--bg); color: var(--text); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 16px; }
.stat-value { font-size: 28px; font-weight: 600; }
.stat-label { color: var(--text-secondary); font-size: 13px; }
button { cursor: pointer; border: 1px solid var(--border); background: var(--surface); border-radius: 6px; padding: 6px 14px; }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
input, textarea { border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; font-size: 14px; width: 100%; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); font-size: 14px; }
.layout { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }
.nav { background: var(--surface); border-right: 1px solid var(--border); padding: 16px; }
.nav a { display: block; padding: 8px 10px; color: var(--text); text-decoration: none; border-radius: 6px; }
.nav a.active { background: var(--accent-soft); color: var(--accent); }
```

创建 `frontend/src/test/setup.ts`：

```ts
import "@testing-library/jest-dom/vitest";
```

创建 `frontend/src/pages/LoginPage.tsx`：

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/client";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await authApi.login(password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <form onSubmit={submit} className="card" style={{ width: 320 }}>
        <h1 style={{ fontSize: 18 }}>研发工时统计平台</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>请输入管理口令</p>
        <input
          type="password"
          aria-label="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="管理口令"
        />
        <div style={{ marginTop: 12 }}>
          <button type="submit" className="primary">登录</button>
        </div>
        {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      </form>
    </div>
  );
}
```

创建 `frontend/src/App.tsx`：

```tsx
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ConfigPage from "./pages/ConfigPage";
import DashboardPage from "./pages/DashboardPage";
import DeveloperPage from "./pages/DeveloperPage";
import IterationPage from "./pages/IterationPage";
import LoginPage from "./pages/LoginPage";
import ReportEditorPage from "./pages/ReportEditorPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<DashboardPage />} />
        <Route path="/developers" element={<DeveloperPage />} />
        <Route path="/iterations/:id" element={<IterationPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/reports/:id" element={<ReportEditorPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

创建 `frontend/src/main.tsx`：

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
```

> 注：`ConfigPage` 等其余页面在 T13~T16 实现；本 task 的 App.tsx import 它们会导致构建失败——**实现顺序**：先创建五个空占位页面文件（各 `export default function X() { return null; }`），后续 task 填充。

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npm install && npx vitest run`
Expected: PASS（2 passed）。

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "task12: scaffold React+Vite frontend, api client, routing, login page (subagent: TBD)"
```

---

### Task 13: 配置页（项目/仓库/迭代 + Token 管理）

**目标**：实现 SPEC §3 M1 的前端：项目创建与列表、仓库添加（token 隐藏输入）/删除/Token 状态（仅 last4）展示、迭代创建与列表、空状态引导；补后端 `GET /projects/{id}/repositories`。

**依赖**：T9（API）、T12（路由/客户端）。**可并行**：与 T14~T16 并行。

**Files:**
- Create: `frontend/src/pages/ConfigPage.tsx`
- Create: `frontend/src/components/EmptyState.tsx`
- Modify: `backend/app/routers/projects.py`（补 GET 仓库列表）
- Create: `frontend/tests/ConfigPage.test.tsx`

**Interfaces:**
- Consumes: `api<T>`、`Project`/`Repository`/`Iteration` 类型（本 task 定义）
- Produces: `ConfigPage`、`EmptyState({ title, action? })`、后端 `GET /api/projects/{id}/repositories`

- [ ] **Step 1: 写失败测试**

创建 `frontend/tests/ConfigPage.test.tsx`：

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ConfigPage from "../src/pages/ConfigPage";

function mockFetchOnce(data: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => data });
}

describe("ConfigPage", () => {
  it("shows empty state when no projects", async () => {
    vi.stubGlobal("fetch", mockFetchOnce([]));
    render(<MemoryRouter><ConfigPage /></MemoryRouter>);
    expect(await screen.findByText(/还没有项目/)).toBeInTheDocument();
  });

  it("creates a project and lists it", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, name: "平台组", description: "" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><ConfigPage /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText("project-name"), "平台组");
    await userEvent.click(screen.getByRole("button", { name: "创建项目" }));
    expect(await screen.findByText("平台组")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run`
Expected: FAIL（ConfigPage 不存在）。

- [ ] **Step 3: 最小实现**

修改 `backend/app/routers/projects.py`（在 create_repository 前追加）：

```python
@router.get("/projects/{project_id}/repositories", response_model=list[RepositoryOut])
def list_repositories(project_id: int, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    return db.query(models.Repository).filter_by(project_id=project_id).all()
```

创建 `frontend/src/components/EmptyState.tsx`：

```tsx
export default function EmptyState({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
      <p>{title}</p>
      {action}
    </div>
  );
}
```

创建 `frontend/src/pages/ConfigPage.tsx`：

```tsx
import { useEffect, useState } from "react";
import { api } from "../api/client";
import EmptyState from "../components/EmptyState";

export interface Project { id: number; name: string; description: string; }
export interface Repository { id: number; platform: string; repo_path: string; token_last4: string; last_synced_at: string | null; }
export interface Iteration { id: number; name: string; start_date: string; end_date: string; }

export default function ConfigPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [repos, setRepos] = useState<Record<number, Repository[]>>({});
  const [iterations, setIterations] = useState<Record<number, Iteration[]>>({});
  const [name, setName] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [token, setToken] = useState("");
  const [iterationName, setIterationName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  async function load() {
    const list = await api<Project[]>("/projects");
    setProjects(list);
    const r: Record<number, Repository[]> = {};
    const it: Record<number, Iteration[]> = {};
    for (const p of list) {
      r[p.id] = await api(`/projects/${p.id}/repositories`);
      it[p.id] = await api(`/projects/${p.id}/iterations`);
    }
    setRepos(r);
    setIterations(it);
  }

  useEffect(() => { load().catch((e) => setError(String(e))); }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/projects", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "创建失败"); }
  }

  async function addRepo(e: React.FormEvent) {
    e.preventDefault();
    if (selected === null) return;
    setError("");
    try {
      await api(`/projects/${selected}/repositories`, {
        method: "POST",
        body: JSON.stringify({ platform: "github", repo_path: repoPath, token }),
      });
      setRepoPath(""); setToken("");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "添加失败"); }
  }

  async function addIteration(e: React.FormEvent) {
    e.preventDefault();
    if (selected === null) return;
    setError("");
    try {
      await api(`/projects/${selected}/iterations`, {
        method: "POST",
        body: JSON.stringify({ name: iterationName, start_date: startDate, end_date: endDate }),
      });
      setIterationName(""); setStartDate(""); setEndDate("");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "创建失败"); }
  }

  async function deleteRepo(id: number) {
    await api(`/repositories/${id}`, { method: "DELETE" });
    await load();
  }

  if (projects.length === 0 && !error) {
    return (
      <div className="layout">
        <div className="nav"><a href="/">← 返回总览</a></div>
        <main style={{ padding: 24 }}>
          <h1>配置</h1>
          <form onSubmit={createProject} className="card" style={{ marginBottom: 16 }}>
            <input aria-label="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="项目名称" />
            <button type="submit" className="primary">创建项目</button>
          </form>
          <EmptyState title="还没有项目，先创建一个吧" />
        </main>
      </div>
    );
  }

  return (
    <div className="layout">
      <div className="nav">
        <a href="/">总览</a>
        <a href="/developers">个人统计</a>
        <a href="/config" className="active">配置</a>
      </div>
      <main style={{ padding: 24 }}>
        <h1>配置</h1>
        {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
        <form onSubmit={createProject} className="card" style={{ marginBottom: 16 }}>
          <input aria-label="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="项目名称" />
          <button type="submit" className="primary">创建项目</button>
        </form>
        <select value={selected ?? ""} onChange={(e) => setSelected(Number(e.target.value))} aria-label="select-project">
          <option value="" disabled>选择项目</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {selected !== null && (
          <>
            <section className="card" style={{ marginTop: 16 }}>
              <h2>仓库</h2>
              <form onSubmit={addRepo} style={{ display: "grid", gap: 8, marginBottom: 8 }}>
                <input value={repoPath} onChange={(e) => setRepoPath(e.target.value)} placeholder="仓库路径 org/repo" aria-label="repo-path" />
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Git Token（隐藏输入）" aria-label="repo-token" />
                <button type="submit" className="primary">添加仓库</button>
              </form>
              {repos[selected]?.length ? (
                <table>
                  <thead><tr><th>仓库</th><th>Token</th><th>操作</th></tr></thead>
                  <tbody>
                    {repos[selected].map((r) => (
                      <tr key={r.id}>
                        <td>{r.repo_path}</td>
                        <td>••••{r.token_last4}</td>
                        <td><button onClick={() => deleteRepo(r.id)}>删除</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState title="还没有仓库" />}
            </section>
            <section className="card" style={{ marginTop: 16 }}>
              <h2>迭代</h2>
              <form onSubmit={addIteration} style={{ display: "grid", gap: 8, marginBottom: 8 }}>
                <input value={iterationName} onChange={(e) => setIterationName(e.target.value)} placeholder="迭代名称" aria-label="iteration-name" />
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="start-date" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="end-date" />
                <button type="submit" className="primary">创建迭代</button>
              </form>
              {iterations[selected]?.length ? (
                <table>
                  <thead><tr><th>名称</th><th>起</th><th>止</th></tr></thead>
                  <tbody>
                    {iterations[selected].map((it) => (
                      <tr key={it.id}><td><a href={`/iterations/${it.id}`}>{it.name}</a></td><td>{it.start_date}</td><td>{it.end_date}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState title="还没有迭代" />}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npx vitest run`
Expected: PASS（新增 2 个用例）；`cd backend && python -m pytest tests/test_api_projects.py -q` 仍全绿。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ConfigPage.tsx frontend/src/components/EmptyState.tsx frontend/tests/ConfigPage.test.tsx backend/app/routers/projects.py
git commit -m "task13: add config page (projects/repos/iterations/token) + GET repositories API (subagent: TBD)"
```

---

### Task 14: 仪表盘总览页

**目标**：实现 SPEC §3 M6 总览：统计卡片（总工时/提交数/活跃成员）、ECharts 趋势图（封装组件）、个人统计入口、报告生成入口（无 LLM key 时提示降级）、空状态引导。

**依赖**：T12（客户端/路由）。**可并行**：与 T13、T15、T16 并行。

**Files:**
- Create: `frontend/src/components/StatCard.tsx`
- Create: `frontend/src/components/TrendChart.tsx`
- Create: `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/tests/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `api<T>`；后端 `GET /api/stats/overview`、`GET /api/stats/developers`
- Produces: `StatCard({ label, value })`、`TrendChart({ data })`（ECharts line，testid `trend-chart`）、`DashboardPage`

- [ ] **Step 1: 写失败测试**

创建 `frontend/tests/DashboardPage.test.tsx`：

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardPage from "../src/pages/DashboardPage";

vi.mock("echarts", () => ({
  init: () => ({ setOption: vi.fn(), dispose: vi.fn() }),
}));

function json(data: unknown) {
  return { ok: true, json: async () => data };
}

describe("DashboardPage", () => {
  it("renders overview stats", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ total_hours: 120.5, total_commits: 320, active_developers: 5, trend: [] }))
      .mockResolvedValueOnce(json([{ developer: "a@x.com", commits: 100, hours: 40.2, active_days: 10 }]));
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByText("120.5")).toBeInTheDocument();
    expect(screen.getByText("320")).toBeInTheDocument();
    expect(screen.getByText("a@x.com")).toBeInTheDocument();
  });

  it("shows empty state without data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ total_hours: 0, total_commits: 0, active_developers: 0, trend: [] })));
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByText(/还没有数据/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run`
Expected: FAIL（DashboardPage 不存在）。

- [ ] **Step 3: 最小实现**

创建 `frontend/src/components/StatCard.tsx`：

```tsx
export default function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
```

创建 `frontend/src/components/TrendChart.tsx`：

```tsx
import { useEffect, useRef } from "react";
import * as echarts from "echarts";

export default function TrendChart({ data }: { data: { date: string; commits: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption({
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: data.map((d) => d.date) },
      yAxis: { type: "value" },
      series: [{ type: "line", smooth: true, data: data.map((d) => d.commits) }],
    });
    return () => chart.dispose();
  }, [data]);

  return <div ref={ref} style={{ height: 260 }} data-testid="trend-chart" />;
}
```

创建 `frontend/src/pages/DashboardPage.tsx`：

```tsx
import { useEffect, useState } from "react";
import { api } from "../api/client";
import EmptyState from "../components/EmptyState";
import StatCard from "../components/StatCard";
import TrendChart from "../components/TrendChart";

interface Overview { total_hours: number; total_commits: number; active_developers: number; trend: { date: string; commits: number }[]; }
interface Developer { developer: string; commits: number; hours: number; active_days: number; }

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<Overview>("/stats/overview"), api<Developer[]>("/stats/developers")])
      .then(([o, d]) => { setOverview(o); setDevelopers(d); })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  const empty = overview !== null && overview.total_commits === 0;

  return (
    <div className="layout">
      <div className="nav">
        <a href="/" className="active">总览</a>
        <a href="/developers">个人统计</a>
        <a href="/config">配置</a>
      </div>
      <main style={{ padding: 24 }}>
        <h1>团队总览</h1>
        {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
        {empty ? (
          <EmptyState title="还没有数据，请先在「配置」添加仓库并同步" />
        ) : overview && (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              <StatCard label="估算工时 (h)" value={overview.total_hours} />
              <StatCard label="提交数" value={overview.total_commits} />
              <StatCard label="活跃成员" value={overview.active_developers} />
            </section>
            <section className="card" style={{ marginTop: 16 }}>
              <h2>提交趋势</h2>
              <TrendChart data={overview.trend} />
            </section>
            <section className="card" style={{ marginTop: 16 }}>
              <h2>成员排行</h2>
              <table>
                <thead><tr><th>开发者</th><th>提交</th><th>工时 (h)</th><th>活跃天数</th></tr></thead>
                <tbody>
                  {developers.map((d) => (
                    <tr key={d.developer}>
                      <td>{d.developer}</td><td>{d.commits}</td><td>{d.hours}</td><td>{d.active_days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npx vitest run`
Expected: PASS（新增 2 个用例）。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/StatCard.tsx frontend/src/components/TrendChart.tsx frontend/src/pages/DashboardPage.tsx frontend/tests/DashboardPage.test.tsx
git commit -m "task14: add dashboard overview page with stats cards and trend chart (subagent: TBD)"
```

---

### Task 15: 个人与迭代维度页

**目标**：实现 SPEC §3 M6 个人统计页（表格 + 排序）与迭代详情页（每日提交图、成员快照、RS 风险信号列表）。

**依赖**：T12（客户端/路由）、T14（TrendChart 复用）。**可并行**：与 T13、T16 并行。

**Files:**
- Create: `frontend/src/pages/DeveloperPage.tsx`
- Create: `frontend/src/pages/IterationPage.tsx`
- Create: `frontend/tests/DeveloperPage.test.tsx`
- Create: `frontend/tests/IterationPage.test.tsx`

**Interfaces:**
- Consumes: `api<T>`、`TrendChart`、后端 `GET /api/stats/developers`、`GET /api/stats/iterations/{id}`
- Produces: `DeveloperPage`、`IterationPage`

- [ ] **Step 1: 写失败测试**

创建 `frontend/tests/DeveloperPage.test.tsx`：

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DeveloperPage from "../src/pages/DeveloperPage";

describe("DeveloperPage", () => {
  it("lists developers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => [{ developer: "a@x.com", commits: 42, hours: 18.5, active_days: 6 }],
    }));
    render(<MemoryRouter><DeveloperPage /></MemoryRouter>);
    expect(await screen.findByText("a@x.com")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
```

创建 `frontend/tests/IterationPage.test.tsx`：

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import IterationPage from "../src/pages/IterationPage";

vi.mock("echarts", () => ({ init: () => ({ setOption: vi.fn(), dispose: vi.fn() }) }));

describe("IterationPage", () => {
  it("renders risk signals", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        iteration: { id: 1, name: "I1", start_date: "2026-01-05", end_date: "2026-01-16" },
        total_commits: 3,
        night_ratio: 0,
        daily: [],
        developers: [],
        signals: [{ code: "RS-2", level: "high", description: "连续 3 个工作日无提交" }],
      }),
    }));
    render(
      <MemoryRouter initialEntries={["/iterations/1"]}>
        <Routes><Route path="/iterations/:id" element={<IterationPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("RS-2")).toBeInTheDocument();
    expect(screen.getByText(/连续 3 个工作日无提交/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run`
Expected: FAIL（页面不存在）。

- [ ] **Step 3: 最小实现**

创建 `frontend/src/pages/DeveloperPage.tsx`：

```tsx
import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Developer { developer: string; commits: number; hours: number; active_days: number; }

export default function DeveloperPage() {
  const [rows, setRows] = useState<Developer[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Developer[]>("/stats/developers")
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  return (
    <div className="layout">
      <div className="nav">
        <a href="/">总览</a>
        <a href="/developers" className="active">个人统计</a>
        <a href="/config">配置</a>
      </div>
      <main style={{ padding: 24 }}>
        <h1>个人统计</h1>
        {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
        <div className="card">
          <table>
            <thead><tr><th>开发者</th><th>提交数</th><th>估算工时 (h)</th><th>活跃天数</th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.developer}>
                  <td>{d.developer}</td><td>{d.commits}</td><td>{d.hours}</td><td>{d.active_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
```

创建 `frontend/src/pages/IterationPage.tsx`：

```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import TrendChart from "../components/TrendChart";

interface IterationStats {
  iteration: { id: number; name: string; start_date: string; end_date: string };
  total_commits: number;
  night_ratio: number;
  daily: { date: string; commits: number }[];
  developers: { developer: string; commits: number; estimated_hours: number; metrics: Record<string, unknown> }[];
  signals: { code: string; level: string; description: string }[];
}

export default function IterationPage() {
  const { id } = useParams();
  const [stats, setStats] = useState<IterationStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<IterationStats>(`/stats/iterations/${id}`)
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, [id]);

  return (
    <div className="layout">
      <div className="nav">
        <a href="/">总览</a>
        <a href="/developers">个人统计</a>
        <a href="/config">配置</a>
      </div>
      <main style={{ padding: 24 }}>
        {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
        {stats && (
          <>
            <h1>迭代：{stats.iteration.name}</h1>
            <p style={{ color: "var(--text-secondary)" }}>
              {stats.iteration.start_date} ~ {stats.iteration.end_date} · 提交 {stats.total_commits} · 凌晨占比 {(stats.night_ratio * 100).toFixed(0)}%
            </p>
            <section className="card" style={{ marginTop: 16 }}>
              <h2>风险信号</h2>
              {stats.signals.length === 0
                ? <p style={{ color: "var(--text-secondary)" }}>暂无风险信号</p>
                : <ul>{stats.signals.map((s) => (
                    <li key={s.code} style={{ color: s.level === "high" ? "var(--danger)" : "var(--warning)" }}>
                      <strong>{s.code}</strong> [{s.level}] {s.description}
                    </li>
                  ))}</ul>}
            </section>
            <section className="card" style={{ marginTop: 16 }}>
              <h2>每日提交</h2>
              <TrendChart data={stats.daily} />
            </section>
            <section className="card" style={{ marginTop: 16 }}>
              <h2>成员快照</h2>
              <table>
                <thead><tr><th>开发者</th><th>提交</th><th>估算工时 (h)</th></tr></thead>
                <tbody>
                  {stats.developers.map((d) => (
                    <tr key={d.developer}>
                      <td>{d.developer}</td><td>{d.commits}</td><td>{d.estimated_hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npx vitest run`
Expected: PASS（新增 2 个用例）。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/DeveloperPage.tsx frontend/src/pages/IterationPage.tsx frontend/tests/DeveloperPage.test.tsx frontend/tests/IterationPage.test.tsx
git commit -m "task15: add developer and iteration dimension pages (subagent: TBD)"
```

---

### Task 16: 报告编辑页

**目标**：实现 SPEC §3 M5 前端：加载报告详情、Markdown 编辑与预览切换、保存新版本（可标记 final）、版本历史回看/恢复、导出 Markdown 下载。

**依赖**：T11（报告 API）、T12（客户端/路由）。**可并行**：与 T13~T15 并行。

**Files:**
- Create: `frontend/src/pages/ReportEditorPage.tsx`
- Create: `frontend/tests/ReportEditorPage.test.tsx`

**Interfaces:**
- Consumes: `api<T>`、`GET /api/reports/{id}`、`PUT /api/reports/{id}`、`POST /api/reports/{id}/restore`、`GET /api/reports/{id}/export`
- Produces: `ReportEditorPage`

- [ ] **Step 1: 写失败测试**

创建 `frontend/tests/ReportEditorPage.test.tsx`：

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ReportEditorPage from "../src/pages/ReportEditorPage";

function json(data: unknown) {
  return { ok: true, json: async () => data };
}

const reportDetail = {
  id: 1, type: "weekly", scope: "project", status: "draft", content_md: "## 摘要\n草稿内容", llm_model: null,
  created_at: "2026-08-14T00:00:00",
  versions: [
    { version: 1, content_md: "## 摘要\n草稿内容", source: "llm", created_at: "2026-08-14T00:00:00" },
  ],
};

describe("ReportEditorPage", () => {
  it("loads and edits report, saves new version", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(reportDetail))
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json({ ...reportDetail, content_md: "人工修订", status: "final",
        versions: [...reportDetail.versions, { version: 2, content_md: "人工修订", source: "human", created_at: "x" }] }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/reports/1"]}>
        <Routes><Route path="/reports/:id" element={<ReportEditorPage />} /></Routes>
      </MemoryRouter>,
    );
    const textarea = await screen.findByLabelText("report-content");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "人工修订");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("v2")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run`
Expected: FAIL（ReportEditorPage 不存在）。

- [ ] **Step 3: 最小实现**

创建 `frontend/src/pages/ReportEditorPage.tsx`：

```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";

interface Version { version: number; content_md: string; source: string; created_at: string; }
interface ReportDetail {
  id: number; type: string; scope: string; status: string; content_md: string; llm_model: string | null;
  created_at: string; versions: Version[];
}

export default function ReportEditorPage() {
  const { id } = useParams();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const r = await api<ReportDetail>(`/reports/${id}`);
    setReport(r);
    setContent(r.content_md);
  }

  useEffect(() => { load().catch((e) => setError(String(e))); }, [id]);

  async function save(final = false) {
    await api(`/reports/${id}`, {
      method: "PUT",
      body: JSON.stringify({ content_md: content, status: final ? "final" : undefined }),
    });
    await load();
  }

  async function restore(version: number) {
    await api(`/reports/${id}/restore`, { method: "POST", body: JSON.stringify({ version }) });
    await load();
  }

  function download() {
    window.open(`/api/reports/${id}/export`, "_blank");
  }

  if (!report) {
    return <div style={{ padding: 24 }}>{error ? <p role="alert">{error}</p> : "加载中…"}</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <a href="/">← 返回总览</a>
      <h1>{report.type === "weekly" ? "周报" : "风险分析"} · {report.status}</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setPreview(!preview)}>{preview ? "编辑" : "预览"}</button>
        <button className="primary" onClick={() => save(false)}>保存</button>
        <button onClick={() => save(true)}>保存并定稿</button>
        <button onClick={download}>导出 Markdown</button>
      </div>
      {preview ? (
        <pre className="card" data-testid="preview" style={{ whiteSpace: "pre-wrap" }}>{content}</pre>
      ) : (
        <textarea
          aria-label="report-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={20}
          style={{ fontFamily: "monospace" }}
        />
      )}
      <section className="card" style={{ marginTop: 16 }}>
        <h2>版本历史</h2>
        <table>
          <thead><tr><th>版本</th><th>来源</th><th>时间</th><th>操作</th></tr></thead>
          <tbody>
            {report.versions.map((v) => (
              <tr key={v.version}>
                <td>v{v.version}</td>
                <td>{v.source}</td>
                <td>{v.created_at}</td>
                <td><button onClick={() => restore(v.version)}>恢复此版本</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npx vitest run`
Expected: PASS（新增 1 个用例）。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ReportEditorPage.tsx frontend/tests/ReportEditorPage.test.tsx
git commit -m "task16: add report editor page (edit/preview/versions/restore/export) (subagent: TBD)"
```

---

### Task 17: 定时同步（APScheduler，可选开关）

**目标**：实现 SPEC §3 M2 的可选定时同步：`SYNC_INTERVAL_HOURS > 0` 时启动 APScheduler 定时执行全仓库同步，默认关闭（=0 不启动），可注入测试。

**依赖**：T4（sync_service）、T5（recompute）。**可并行**：与 T12~T16 并行。

**Files:**
- Create: `backend/app/scheduler.py`
- Create: `backend/tests/test_scheduler.py`

**Interfaces:**
- Consumes: `sync_repository`、`recompute_aggregates`、`settings.sync_interval_hours`
- Produces: `run_all_syncs(session_factory, master_key) -> None`、`start_scheduler(session_factory, master_key) -> BackgroundScheduler | None`

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_scheduler.py`：

```python
from app.config import settings
from app.scheduler import run_all_syncs, start_scheduler


def test_disabled_returns_none(monkeypatch):
    monkeypatch.setattr(settings, "sync_interval_hours", 0)
    assert start_scheduler(None, "mk") is None


def test_enabled_starts_and_stops(monkeypatch):
    monkeypatch.setattr(settings, "sync_interval_hours", 1)

    class FakeJob:
        def __init__(self, fn):
            self.fn = fn

    def fake_add_job(fn, trigger, hours=None):
        return FakeJob(fn)

    from apscheduler.schedulers.background import BackgroundScheduler
    monkeypatch.setattr(BackgroundScheduler, "add_job", fake_add_job)
    scheduler = start_scheduler(None, "mk")
    assert scheduler is not None
    scheduler.shutdown(wait=False)


def test_run_all_syncs_iterates_repos(db_session, monkeypatch):
    from app import models
    repo = models.Repository(project_id=1, platform="github", repo_path="org/repo",
                             token_encrypted="x", token_last4="abcd")
    db_session.add(repo)
    db_session.commit()

    calls = []

    def fake_sync(db, repo_, master_key, recompute=None):
        calls.append(repo_.id)

    from app.services import sync_service
    monkeypatch.setattr(sync_service, "sync_repository", fake_sync)
    run_all_syncs(lambda: db_session, "mk")
    assert calls == [repo.id]
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_scheduler.py -v`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 最小实现**

创建 `backend/app/scheduler.py`：

```python
from .config import settings


def run_all_syncs(session_factory, master_key: str) -> None:
    """遍历所有仓库执行同步（定时任务入口，SPEC §3 M2）"""
    from . import models
    from .services.aggregate_service import recompute_aggregates
    from .services.sync_service import sync_repository

    db = session_factory()
    try:
        for repo in db.query(models.Repository).all():
            sync_repository(db, repo, master_key, recompute=recompute_aggregates)
    finally:
        db.close()


def start_scheduler(session_factory, master_key: str):
    """SYNC_INTERVAL_HOURS <= 0 时不启动（默认关闭，手动为主，SPEC §10 已决）"""
    if settings.sync_interval_hours <= 0:
        return None
    from apscheduler.schedulers.background import BackgroundScheduler

    scheduler = BackgroundScheduler()
    scheduler.add_job(run_all_syncs, "interval", hours=settings.sync_interval_hours,
                      args=[session_factory, master_key])
    scheduler.start()
    return scheduler
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_scheduler.py -v`
Expected: PASS（3 passed）。

- [ ] **Step 5: Commit**

```bash
git add backend/app/scheduler.py backend/tests/test_scheduler.py
git commit -m "task17: add optional APScheduler periodic sync (default off) (subagent: TBD)"
```

---

### Task 18: Docker 多阶段镜像与冷启动验证

**目标**：实现 SPEC §7.4 分发：多阶段 Dockerfile（前端构建 → FastAPI 托管静态资源），`main.py` 提供模块级 `app` 供 uvicorn；验证 `docker build` + `docker run` 冷启动可访问 WebUI 与 `/api/health`。

**依赖**：T16（前端可构建）、T11（后端 API 完备）。**可并行**：与 T19、T20 并行。

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Modify: `backend/app/main.py`（模块级 `app = create_app()`）

**Interfaces:**
- Consumes: `create_app()`
- Produces: 单镜像 `dev-hours`，`docker run -p 8080:8000 -e ... dev-hours` 可启动

- [ ] **Step 1: 先写失败验证（无测试代码，构建即验证）**

修改 `backend/app/main.py` 末尾追加：

```python
app = create_app()
```

修改 `backend/app/main.py`（或新建 `backend/app/logging_config.py`）启用结构化 JSON 日志（SPEC §4.4：记录请求/同步/LLM 调用，**不记 prompt 全文与 Key**）：

```python
# logging_config.py
import json
import logging
from datetime import datetime


class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({"ts": datetime.utcnow().isoformat(),
                           "level": record.levelname,
                           "logger": record.name,
                           "msg": record.getMessage()}, ensure_ascii=False)


def setup_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
```

在 `create_app` 内调用 `setup_logging()`；服务代码中 LLM 调用日志只记 `{"model": ..., "elapsed_ms": ..., "status": ...}`（不记 prompt 与 key）。

创建 `Dockerfile`：

```dockerfile
# ---- 前端构建 ----
FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 后端 ----
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend /app/dist ./static
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

创建 `.dockerignore`：

```
.git
.env
**/__pycache__
**/*.pyc
backend/devhours.db*
frontend/node_modules
frontend/dist
```

- [ ] **Step 2: 构建并冷启动验证**

Run:
```bash
docker build -t dev-hours .
docker run -d --name dev-hours-test -p 8080:8000 \
  -e ADMIN_PASSWORD=demo-pass -e MASTER_KEY=demo-master -e SESSION_SECRET=demo-secret \
  -e LLM_API_KEY= dev-hours
curl http://localhost:8080/api/health
curl -c cookies.txt -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d '{"password":"demo-pass"}'
curl -b cookies.txt http://localhost:8080/api/projects
docker rm -f dev-hours-test
```
Expected: health 返回 `{"status":"ok"}`；登录后 `/api/projects` 返回 200（JSON 列表）；浏览器打开 `http://localhost:8080` 可见登录页（前端静态资源由 FastAPI 托管）。

> 注：本环境若无 Docker，此验证在本地 Docker Desktop 或 CI 的 build job 中执行；务必在合并前完成一次冷启动验证（SPEC §9 横切验收）。

- [ ] **Step 3: Commit**

```bash
git add Dockerfile .dockerignore backend/app/main.py
git commit -m "task18: add multi-stage Docker image, module-level app for uvicorn (subagent: TBD)"
```

---

### Task 19: GitLab CI（unit-test job + 镜像构建）

**目标**：实现 SPEC §7.6 / 课程交付要求：`.gitlab-ci.yml` 含名为 `unit-test` 的 job（`make test` 全量测试）+ 镜像构建 job。

**依赖**：T1（Makefile）、T16、T18（镜像可构建）。**可并行**：与 T18、T20 并行。

**Files:**
- Create: `.gitlab-ci.yml`

**Interfaces:**
- Produces: pipeline 两个 stage：`test`（unit-test job，push 自动跑）、`build`（镜像构建与推送）

- [ ] **Step 1: 写配置（配置即验收对象，push 后观察 pipeline）**

创建 `.gitlab-ci.yml`：

```yaml
stages:
  - test
  - build

variables:
  IMAGE_NAME: $CI_REGISTRY_IMAGE:latest

unit-test:
  stage: test
  image: python:3.11-slim
  before_script:
    - apt-get update && apt-get install -y --no-install-recommends nodejs npm make
    - cd backend && pip install -r requirements.txt
    - cd ../frontend && npm install --no-audit --no-fund
  script:
    - make test

build-image:
  stage: build
  image: docker:27
  services:
    - docker:27-dind
  script:
    - docker build -t $IMAGE_NAME .
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker push $IMAGE_NAME
  only:
    - main
```

- [ ] **Step 2: 验证 pipeline**

Run: push 到 GitLab → Pipeline 页确认：
- `unit-test` job：`make test` 全绿（后端 pytest + 前端 vitest 全 passed）。
- `build-image` job：镜像构建成功并推送。
Expected: 最后一次 CI/CD 执行状态为 **pass**（课程硬性要求）。

- [ ] **Step 3: Commit**

```bash
git add .gitlab-ci.yml
git commit -m "task19: add GitLab CI with unit-test job and image build (subagent: TBD)"
```

---

### Task 20: README 与交付文档

**目标**：实现课程交付清单的 README：项目简介（30 秒价值）、功能、安装/运行、测试、key 安全配置、分发、部署、目录结构、安全边界、已知限制、第三方依赖许可证。

**依赖**：T18（运行命令可验证）。**可并行**：与 T18、T19 并行。

**Files:**
- Create: `README.md`

**Interfaces:**
- Produces: `README.md`（课程要求的章节全覆盖）

- [ ] **Step 1: 写 README（内容即验收对象）**

创建 `README.md`：

```markdown
# 研发任务智能统计与工时分析平台

> 30 秒价值：团队导入 Git 数据，系统自动统计开发工时与代码提交频率，用 LLM 单轮生成周报与迭代风险分析，管理者不用再手动汇总报表。

## 功能

- Git 数据采集：GitHub API 增量同步（GitProvider 抽象，GitLab/Gitee 预留扩展）
- 工时估算：时间戳聚类 + 代码量加权口径，支持人工校正
- 统计仪表盘：团队总览 / 个人维度 / 迭代维度，ECharts 趋势图
- LLM 报告（单轮，无自主循环）：周报与迭代风险分析（确定性规则引擎 RS-1~5 + LLM 归因文案）
- 报告管理：编辑 / 版本历史 / 恢复 / 导出 Markdown
- 安全：Git Token AES-256-GCM 密文存储、管理口令登录、LLM Key 仅环境变量

## 目录结构

（与 PLAN.md File Structure 一致：backend/ FastAPI + frontend/ React）

## 安装与运行（容器分发）

```bash
docker build -t dev-hours .
docker run -p 8080:8000 \
  -e ADMIN_PASSWORD=你的口令 \
  -e MASTER_KEY=你的主密钥 \
  -e SESSION_SECRET=随机串 \
  dev-hours
# 打开 http://localhost:8080
```

## Key 在目标机器的安全配置（必读）

1. `.env` 从 `.env.example` 复制，**不得提交进 Git**（明文风险：文件与进程环境可见）。
2. `ADMIN_PASSWORD`：登录口令（bcrypt 校验）。
3. `MASTER_KEY`：主密钥，用于 AES-GCM 加密 Git Token；可改用系统钥匙串（首次启动引导录入，keyring）。
4. `LLM_API_KEY`：可选；不配置时系统降级为纯统计平台。
5. 在 WebUI「配置」页录入各仓库 Git Token（隐藏输入），状态页仅显示 last4 指纹，支持更新/清除。
6. 提交前自查：`.env`、shell history、日志不得含真实凭据。

## 测试

```bash
make test   # 后端 pytest + 前端 vitest，一键全绿
```

## 分发与 CI

- 镜像：`docker build` + `docker run`（见上）；CI（.gitlab-ci.yml）`unit-test` job 每次 push 自动跑测试，`build-image` job 构建镜像。
- 云部署：Fly.io（推荐，免费额度）或 Render；部署后公网 URL 见下方「部署」。

## 部署

公网 URL：（部署完成后填写）

## 已知限制

- 单实例单团队（无多租户隔离）；SQLite 单文件（单机部署，可平滑升 Postgres）。
- Git 平台首发 GitHub；GitLab/Gitee 仅预留适配器接口。
- 工时估算为管理参考值，不等于真实工时（口径见 SPEC §3.3）。
- LLM 生成内容需人工校对后定稿。

## 第三方依赖与许可证

后端/前端依赖见 `backend/requirements.txt` 与 `frontend/package.json`；均为各自上游开源许可证（BSD/MIT/Apache-2.0 等），详见各依赖仓库。

## 安全边界

- 凭据不硬编码、不进 Git 历史、不进日志；主密钥丢失将无法解密既有 Git Token。
- 单用户 + 管理口令；公网部署建议在网关层启用 TLS。
```

- [ ] **Step 2: 验证 README 命令可执行**

Run: 按 README 的 docker run 命令在干净环境（或 CI 容器）执行一遍，确认冷启动可访问；`.env.example` 与实际环境变量名一致（对照 `backend/app/config.py` 的 Settings 字段）。

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "task20: add README with run/credential/distribution docs (subagent: TBD)"
```

---

## 执行前置与并行策略（非 task，供 subagent-driven 执行时参考）

### 冷启动验证（课程 §4.5，正式实现前必须执行）

1. 用一个**与主开发智能体不同**的 agent，全新 session（不导入本对话历史），仅提供 `SPEC.md` + `PLAN.md`。
2. 指定其实现 **Task 5（工时估算）** 与 **Task 4（同步服务）** 各 1 个关键用例，明确"遇到不确定处即暂停询问，而非猜测"。
3. 记录其在何处暂停/提问、对 SPEC/PLAN 的解读偏差；据此修订 SPEC/PLAN（修订前后 diff 记入 `SPEC_PROCESS.md`）。

### 并行 wave（每个 wave 内 task 可用 git worktree 并行，一个 worktree 一个 PR）

- Wave 0：冷启动验证（修订 SPEC/PLAN）
- Wave 1：T1（脚手架）
- Wave 2：T2（数据层）
- Wave 3：T3、T5、T6、T7、T8（并行；T4 依赖 T3 的 decrypt_token，可与本 wave 并行但需 T3 先合入）
- Wave 4：T4、T9（T9 依赖 T2/T3；T4 依赖 T3）
- Wave 5：T10、T11（并行，依赖 Wave 4）
- Wave 6：T12、T13、T14、T15、T16（前端，依赖 Wave 5 的 API 契约；T13 自带后端 GET 补充）
- Wave 7：T17（依赖 T4/T5）
- Wave 8：T18、T19、T20（运维收尾，依赖全量代码）

### 执行注意事项（实现者必读）

1. `test_auth.py` 中的 `test_login_then_access` 断言 `GET /api/projects == 404`（T3 阶段无该路由；未认证 401 / 已认证 404 区分验证中间件），使用 conftest 的 `client` fixture（内存库注入），避免写真实 `devhours.db`。
2. 每个 task 完成后按课程要求做两阶段评审：先 SPEC 合规检查，再代码质量检查；Critical issue 修复后才进入下一 task。
3. 每个 task 的 commit message 追加实际 subagent 标识与人工修改说明。

