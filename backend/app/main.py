from fastapi import FastAPI
from fastapi.responses import JSONResponse

from .auth import SESSION_COOKIE, AuthMiddleware, expected_session


def create_app(secret: str | None = None) -> FastAPI:
    from .config import settings

    app = FastAPI(title="研发任务智能统计与工时分析平台")
    effective_secret = secret or settings.session_secret
    # login stub 与中间件共用同一 secret（T9 前临时，防止登录抛 AttributeError）
    app.state.session_secret = effective_secret
    app.add_middleware(AuthMiddleware, secret=effective_secret)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    # T3 临时最小 login stub：T9 实现真实路由后删除
    @app.post("/api/auth/login")
    def login(payload: dict):
        if payload.get("password") != settings.admin_password:
            return JSONResponse({"detail": "invalid password"}, status_code=401)
        resp = JSONResponse({"ok": True})
        resp.set_cookie(SESSION_COOKIE, expected_session(effective_secret))
        return resp

    return app
