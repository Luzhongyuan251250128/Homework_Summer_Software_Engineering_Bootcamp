import getpass

import pytest

from app.cli_setup import prompt_and_store_master_key
from app.security import KEYRING_SERVICE


def test_prompt_stores_key(monkeypatch):
    calls = {}

    def fake_getpass(prompt=""):
        return "super-master-key"

    def fake_set_password(service, username, password):
        calls["service"] = service
        calls["username"] = username
        calls["password"] = password

    monkeypatch.setattr(getpass, "getpass", fake_getpass)
    monkeypatch.setattr("keyring.set_password", fake_set_password)
    result = prompt_and_store_master_key()
    assert result == "super-master-key"
    assert calls == {"service": KEYRING_SERVICE, "username": "master_key",
                     "password": "super-master-key"}


def test_mismatch_raises_systemexit(monkeypatch):
    values = iter(["first", "second"])

    def fake_getpass(prompt=""):
        return next(values)

    monkeypatch.setattr(getpass, "getpass", fake_getpass)
    monkeypatch.setattr("keyring.set_password", lambda *a, **k: None)
    with pytest.raises(SystemExit):
        prompt_and_store_master_key()


def test_empty_raises_systemexit(monkeypatch):
    monkeypatch.setattr(getpass, "getpass", lambda prompt="": "")
    monkeypatch.setattr("keyring.set_password", lambda *a, **k: None)
    with pytest.raises(SystemExit):
        prompt_and_store_master_key()
