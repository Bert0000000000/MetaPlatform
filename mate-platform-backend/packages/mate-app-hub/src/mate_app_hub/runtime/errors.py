"""Runtime error codes for APPHUB-RUNTIME-01 phase B."""
from __future__ import annotations

from enum import Enum


class RuntimeErrorCode(str, Enum):
    APP_NOT_FOUND = "APP_NOT_FOUND"
    MODULE_NOT_FOUND = "MODULE_NOT_FOUND"
    ACTION_NOT_SUPPORTED = "ACTION_NOT_SUPPORTED"
    ACCESS_DENIED = "ACCESS_DENIED"
    VERSION_CONFLICT = "VERSION_CONFLICT"
