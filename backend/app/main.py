from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel

from .auth import AuthMiddleware, SESSION_COOKIE, expected_session


class _TempLoginBody(BaseModel):
    password: str


def create_app(secret: str | None = None) -> FastAPI:
    from .config import settings

    app = FastAPI(title="研发任务智能统计与工时分析平台")
    app.state.session_secret = secret or settings.session_secret
    app.add_middleware(AuthMiddleware, secret=app.state.session_secret)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    # T9 前临时最小 login 路由（PLAN.md:835 注释；T9 实现真实路由时删除）
    @app.post("/api/auth/login")
    def _temp_login(body: _TempLoginBody, response: Response):
        if body.password != settings.admin_password:
            raise HTTPException(status_code=401, detail="口令错误")
        response.set_cookie(
            SESSION_COOKIE,
            expected_session(app.state.session_secret),
            httponly=True, samesite="lax",
        )
        return {"ok": True}

    return app
