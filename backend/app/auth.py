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
