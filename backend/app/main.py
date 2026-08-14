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
