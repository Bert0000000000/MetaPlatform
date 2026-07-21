"""Pydantic schemas for the code module (V12-02)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


SUPPORTED_LANGUAGES = ("python", "typescript", "sql")


class CodeLanguage(str, Enum):
    PYTHON = "python"
    TYPESCRIPT = "typescript"
    SQL = "sql"


# --------------------------------------------------------------- REQ-038 code


class CodeGenerateRequest(BaseModel):
    """Natural-language -> code request."""

    description: str = Field(..., min_length=1, max_length=4096)
    language: str = Field(default="python")
    context: Optional[str] = Field(default=None, max_length=8192)
    modelId: Optional[str] = Field(default=None)


class CodeGenResult(BaseModel):
    language: str
    code: str
    description: str
    dependencies: List[str] = Field(default_factory=list)


# ---------------------------------------------------- REQ-041 / REQ-042 sandbox


class CodeExecuteRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=65536)
    language: str = Field(default="python")
    timeoutMs: int = Field(default=5000, ge=100, le=30000)


class ExecutionResult(BaseModel):
    success: bool
    stdout: str = ""
    stderr: str = ""
    durationMs: int = 0
    resultType: str = "text"  # text | table | error
    text: Optional[str] = None
    columns: List[str] = Field(default_factory=list)
    rows: List[Dict[str, Any]] = Field(default_factory=list)
    rowCount: int = 0
    errorName: Optional[str] = None
    errorMessage: Optional[str] = None


# ----------------------------------------------------- REQ-043 template library


class CodeTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = None
    language: str = Field(..., min_length=1)
    category: Optional[str] = None
    code: str = Field(..., min_length=1)
    tags: List[str] = Field(default_factory=list)


class CodeTemplateCreateRequest(CodeTemplateBase):
    pass


class CodeTemplateUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    description: Optional[str] = None
    category: Optional[str] = None
    code: Optional[str] = Field(default=None, min_length=1)
    tags: Optional[List[str]] = None


class CodeTemplateRecord(BaseModel):
    template_id: str
    tenant_id: str
    name: str
    description: Optional[str] = None
    language: str
    category: Optional[str] = None
    code: str
    tags: List[str] = Field(default_factory=list)
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# -------------------------------------------------- REQ-040 / REQ-044 snippets


class CodeSnippetBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    language: str = Field(..., min_length=1)
    code: str = Field(..., min_length=1)
    tags: List[str] = Field(default_factory=list)


class CodeSnippetCreateRequest(CodeSnippetBase):
    pass


class CodeSnippetUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    code: Optional[str] = Field(default=None, min_length=1)
    tags: Optional[List[str]] = None
    changeLog: Optional[str] = Field(default=None, max_length=512)


class CodeSnippetRecord(BaseModel):
    snippet_id: str
    tenant_id: str
    title: str
    description: Optional[str] = None
    language: str
    code: str
    tags: List[str] = Field(default_factory=list)
    version: int = 1
    change_log: Optional[str] = None
    created_by: str
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CodeSnippetVersionRecord(CodeSnippetRecord):
    previous_version: Optional[int] = None


class CodeSnippetDiffRequest(BaseModel):
    versionA: int = Field(..., ge=1)
    versionB: int = Field(..., ge=1)


class CodeSnippetDiffResult(BaseModel):
    snippetId: str
    versionA: int
    versionB: int
    addedLines: List[str] = Field(default_factory=list)
    removedLines: List[str] = Field(default_factory=list)
    unifiedDiff: str = ""


# --------------------------------------------------------------- REQ-045 share


class CodeShareRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=65536)
    language: str = Field(..., min_length=1)
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = None


class CodeShareRecord(BaseModel):
    share_id: str
    tenant_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    language: str
    code: str
    share_url: str
    export_content: str
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None


# ----------------------------------------------------------------- helpers


def normalize_language(language: str) -> str:
    lowered = (language or "").lower().strip()
    if lowered in {"ts", "tsx", "typescript"}:
        return "typescript"
    if lowered in {"py", "python3"}:
        return "python"
    if lowered in {"pgsql", "postgres", "sqlite"}:
        return "sql"
    return lowered


def is_supported(language: str) -> bool:
    return normalize_language(language) in SUPPORTED_LANGUAGES
