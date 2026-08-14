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
