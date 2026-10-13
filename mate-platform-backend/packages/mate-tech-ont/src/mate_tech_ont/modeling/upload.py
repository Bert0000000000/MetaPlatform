"""Compatibility for filenames emitted by browser and .NET multipart clients."""

from __future__ import annotations

import base64
import quopri
import re


def workbook_filename(filename: str | None) -> str:
    name = filename or ""
    if name.startswith("=?"):
        # .NET emits a single MIME encoded-word in the authoritative filename.
        # Do not use filename* as a fallback: multipart parsers intentionally
        # ignore extended parameters, and a conflicting extension must not win.
        word = re.fullmatch(r"=\?([^?\s]+)\?([bBqQ])\?([^?\s]*)\?=", name)
        try:
            if word is None:
                raise ValueError("Incomplete encoded filename")
            charset, encoding, payload = word.groups()
            encoded = payload.encode("ascii")
            if encoding.lower() == "b":
                decoded = base64.b64decode(encoded, validate=True)
            else:
                if re.search(r"=(?![0-9A-Fa-f]{2})", payload):
                    raise ValueError("Invalid quoted-printable filename")
                decoded = quopri.decodestring(encoded.replace(b"_", b" "))
            name = decoded.decode(charset, errors="strict")
            if any(ord(char) < 32 or ord(char) == 127 for char in name):
                raise ValueError("Control character in filename")
        except (LookupError, UnicodeError, ValueError) as exc:
            raise ValueError("文件名编码无效，请使用 UTF-8 文件名") from exc
    if not name.lower().endswith(".xlsx"):
        raise ValueError("请上传 .xlsx 工作簿")
    return name
