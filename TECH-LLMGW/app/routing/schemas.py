from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class OptimizationStrategy(str, Enum):
    CHEAPEST = "cheapest"
    BALANCED = "balanced"
    BEST_QUALITY = "best_quality"


class RoutingRequest(BaseModel):
    promptTokens: int = Field(default=512, ge=1)
    completionTokens: int = Field(default=256, ge=1)
    requiredCapabilities: List[str] = Field(default_factory=lambda: ["CHAT"])
    preferredProvider: Optional[str] = None
    strategy: OptimizationStrategy = OptimizationStrategy.BALANCED
    maxLatencyMs: Optional[int] = None


class CandidateModel(BaseModel):
    modelId: str
    provider: str
    modelCode: str
    displayName: str
    type: str
    inputPrice: float
    outputPrice: float
    contextLength: int
    capabilities: List[str]
    estimatedCost: float
    estimatedLatencyMs: int
    score: float
    reason: str


class RoutingRecommendation(BaseModel):
    tenantId: str
    request: RoutingRequest
    recommendedModelId: str
    recommendedDisplayName: str
    estimatedCost: float
    potentialSavings: float
    savingsRate: float
    candidates: List[CandidateModel]
    strategy: str
    generatedAt: datetime = Field(default_factory=datetime.utcnow)


class RoutingRule(BaseModel):
    ruleId: str
    tenantId: str
    name: str
    description: str = ""
    requiredCapabilities: List[str] = Field(default_factory=list)
    preferredProvider: Optional[str] = None
    strategy: OptimizationStrategy = OptimizationStrategy.BALANCED
    priority: int = Field(default=0, ge=0)
    fallbackModelId: Optional[str] = None
    enabled: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)


class CreateRoutingRuleRequest(BaseModel):
    name: str
    description: str = ""
    requiredCapabilities: List[str] = Field(default_factory=list)
    preferredProvider: Optional[str] = None
    strategy: OptimizationStrategy = OptimizationStrategy.BALANCED
    priority: int = Field(default=0, ge=0)
    fallbackModelId: Optional[str] = None
    enabled: bool = True


class UpdateRoutingRuleRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    requiredCapabilities: Optional[List[str]] = None
    preferredProvider: Optional[str] = None
    strategy: Optional[OptimizationStrategy] = None
    priority: Optional[int] = None
    fallbackModelId: Optional[str] = None
    enabled: Optional[bool] = None
