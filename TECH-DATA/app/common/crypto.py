"""AES-256-ECB credential encryption.

The encryption key is read from the ``DATA_ENCRYPTION_KEY`` environment
variable (default ``metaplatform-data-key-2026``). Because AES-256 requires a
32-byte key, the raw key string is run through SHA-256 to derive a stable
32-byte key. PKCS#7 padding is used.

Note: ECB mode is intentionally chosen per the S-DATA-02 spec for simplicity.
Each ``connection_config`` blob is encrypted as a whole unit, so identical
plaintexts across different data sources still produce the same ciphertext.
"""

from __future__ import annotations

import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.padding import PKCS7

_DEFAULT_KEY = "metaplatform-data-key-2026"


def _derive_key(raw: str) -> bytes:
    """Derive a 32-byte AES key from an arbitrary passphrase via SHA-256."""

    return hashlib.sha256(raw.encode("utf-8")).digest()


def _get_key() -> bytes:
    raw = os.environ.get("DATA_ENCRYPTION_KEY", _DEFAULT_KEY)
    return _derive_key(raw)


def encrypt(plaintext: str) -> str:
    """Encrypt ``plaintext`` and return a base64-encoded ciphertext string."""

    key = _get_key()
    cipher = Cipher(algorithms.AES(key), modes.ECB())
    encryptor = cipher.encryptor()
    padder = PKCS7(algorithms.AES.block_size).padder()
    padded = padder.update(plaintext.encode("utf-8")) + padder.finalize()
    ct = encryptor.update(padded) + encryptor.finalize()
    return base64.b64encode(ct).decode("ascii")


def decrypt(b64_ciphertext: str) -> str:
    """Decrypt a base64-encoded ciphertext string back to plaintext."""

    key = _get_key()
    raw = base64.b64decode(b64_ciphertext)
    cipher = Cipher(algorithms.AES(key), modes.ECB())
    decryptor = cipher.decryptor()
    padded = decryptor.update(raw) + decryptor.finalize()
    unpadder = PKCS7(algorithms.AES.block_size).unpadder()
    return (unpadder.update(padded) + unpadder.finalize()).decode("utf-8")
