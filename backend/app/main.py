from contextlib import asynccontextmanager
from pathlib import Path
from typing import Callable

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

from .auth import AuthMiddleware
from .db import engine, get_db, init_db
from .logging_config import setup_logging
from .routers import auth as auth_router
from .routers import projects as projects_router
from .routers import reports as reports_router
from .routers import settings as settings_router
from .routers import stats as stats_router
from .routers import sync as sync_router


def create_app(secret: str | None = None, db: Callable | None = None,
               static_dir: Path | None = None) -> FastAPI:
    from .config import settings

    setup_logging()

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
    app.include_router(settings_router.router)

    # SPA 托管：静态资源按文件返回，其余非 API 路径回退 index.html（前端路由直链/刷新）
    dist = static_dir or (Path(__file__).resolve().parent.parent / "static")
    if dist.exists():
        index_path = dist / "index.html"

        @app.get("/{full_path:path}", include_in_schema=False)
        def spa(full_path: str):
            if full_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="Not Found")
            file = dist / full_path
            if full_path and file.is_file():
                return FileResponse(file)
            return FileResponse(index_path)

    return app


app = create_app()
