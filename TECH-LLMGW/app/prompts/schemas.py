"""Pydantic schemas for the Prompt template domain."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, model_validator


_VARIABLE_PATTERN = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


class PromptStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class PromptVariableDef(BaseModel):
    """Variable definition attached to a prompt template."""

    name: str = Field(..., min_length=1)
    type: str = Field(default="string")
    required: bool = Field(default=True)
    defaultValue: Any = Field(default=None)
    description: Optional[str] = Field(default=None)


class PromptDefaultParams(BaseModel):
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    maxTokens: Optional[int] = Field(default=None, ge=1, le=8192)


class PromptBase(BaseModel):
    promptKey: str = Field(..., min_length=1, max_length=128)
    name: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = Field(default=None)
    category: Optional[str] = Field(default=None)
    template: str = Field(..., min_length=1)
    variables: List[PromptVariableDef] = Field(default_factory=list)
    defaultModel: Optional[str] = Field(default=None)
    defaultParams: Optional[PromptDefaultParams] = Field(default=None)
    tags: List[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _extract_variables(self) -> "PromptBase":
        """Ensure variables list covers every placeholder found in template."""

        if self.template:
            found = set(_VARIABLE_PATTERN.findall(self.template))
            defined = {v.name for v in self.variables}
            missing = found - defined
            if missing:
                raise ValueError(
                    f"模板变量未定义: {sorted(missing)}"
                )
        return self


class PromptCreateRequest(PromptBase):
    pass


class PromptUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    description: Optional[str] = Field(default=None)
    category: Optional[str] = Field(default=None)
    template: Optional[str] = Field(default=None, min_length=1)
    variables: Optional[List[PromptVariableDef]] = Field(default=None)
    defaultModel: Optional[str] = Field(default=None)
    defaultParams: Optional[PromptDefaultParams] = Field(default=None)
    tags: Optional[List[str]] = Field(default=None)
    changeLog: Optional[str] = Field(default=None)



class PromptRenderRequest(BaseModel):
    variables: Dict[str, Any] = Field(..., min_length=1)
    version: Optional[int] = Field(default=None, ge=1)


class PromptPreviewRequest(BaseModel):
    variables: Dict[str, Any] = Field(..., min_length=1)
    model: Optional[str] = Field(default=None)
    params: Optional[PromptDefaultParams] = Field(default=None)
    version: Optional[int] = Field(default=None, ge=1)


class PromptRollbackRequest(BaseModel):
    targetVersion: int = Field(..., ge=1)
    changeLog: Optional[str] = Field(default=None)


class PromptRecord(BaseModel):
    """Internal persisted prompt record."""

    prompt_id: str
    tenant_id: str
    prompt_key: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    template: str
    variables: List[PromptVariableDef] = Field(default_factory=list)
    default_model: Optional[str] = None
    default_params: Optional[Dict[str, Any]] = None
    tags: List[str] = Field(default_factory=list)
    version: int = 1
    is_latest: bool = True
    status: PromptStatus = PromptStatus.ACTIVE
    change_log: Optional[str] = None
    created_by: str
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PromptVersionRecord(PromptRecord):
    """A historical version of a prompt template."""

    previous_version: Optional[int] = None
    rolled_back_from: Optional[int] = None
    rolled_back_to: Optional[int] = None


def extract_variable_names(template: str) -> List[str]:
    return sorted(set(_VARIABLE_PATTERN.findall(template)))
