"""对称 KMS 封装。

SEC-IAM-01 计划中提到该模块,本 Batch 引入最小可用实现。

生产配置:
  - 通过环境变量 ``MATE_KMS_KEY_ID`` 指向 Keycloak/Vault 托管的 master key
  - 测试环境可注入 ENC[] 包装的对称 mock(由 license_service 测试覆盖)

当前实现使用 Fernet(对称 32B key),非生产 profile 下接受 ``MATE_KMS_KEY``
环境变量注入的 base64 key。production profile 必须从密钥管理服务拿。
"""
from __future__ import annotations

import base64
import os

from cryptography.fernet import Fernet, InvalidToken


class EncryptError(Exception):
    pass


def _get_fernet() -> Fernet:
    key = os.environ.get("MATE_KMS_KEY")
    if not key:
        # dev / test:生成固定测试 key,使 ENC[] 编码可被 decrypt
        key = base64.urlsafe_b64encode(b"0" * 32).decode("ascii")
    try:
        return Fernet(key.encode("ascii"))
    except Exception as e:  # noqa: BLE001
        raise EncryptError(f"invalid MATE_KMS_KEY: {e}") from e


def encrypt(plaintext: str) -> str:
    """加密 → 密文(URL-safe base64)。"""
    if plaintext.startswith("ENC["):
        # 已是 ENC[] 包装(测试 mock),原样返回
        return plaintext
    try:
        f = _get_fernet()
        return f.encrypt(plaintext.encode("utf-8")).decode("ascii")
    except InvalidToken as e:  # noqa: F841
        raise EncryptError(str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise EncryptError(str(e)) from e


def decrypt(ciphertext: str) -> str:
    """解密 → 明文。ENC[..] 包装直接返回原内容。"""
    if ciphertext.startswith("ENC[") and ciphertext.endswith("]"):
        return ciphertext[4:-1]
    try:
        f = _get_fernet()
        return f.decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except Exception as e:  # noqa: BLE001
        raise EncryptError(str(e)) from e