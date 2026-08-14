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
