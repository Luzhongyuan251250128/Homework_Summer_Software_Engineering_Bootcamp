"""主密钥首次引导：隐藏输入并存入系统钥匙串（SPEC §7.2）。

用法：python -m app.cli_setup
流程：隐藏输入（getpass）→ 二次确认 → keyring.set_password 持久化。
"""
import getpass

import keyring

from .security import KEYRING_SERVICE


def prompt_and_store_master_key() -> str:
    master = getpass.getpass("请输入主密钥（Master Key，用于加密 Git Token）：")
    if not master:
        raise SystemExit("主密钥不能为空")
    confirm = getpass.getpass("再次输入确认：")
    if master != confirm:
        raise SystemExit("两次输入不一致")
    keyring.set_password(KEYRING_SERVICE, "master_key", master)
    return master


if __name__ == "__main__":
    prompt_and_store_master_key()
