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
