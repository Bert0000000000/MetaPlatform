"""TECH-AGENT FastAPI application entry point."""

from __future__ import annotations

import uvicorn
from fastapi import FastAPI

from app.agents.repository import InMemoryAgentRepository
from app.agents.schemas import Agent, AgentStatus
from app.api.v1.router import router as v1_router
from app.common.middleware import (
    install_exception_handlers,
    install_trace_id_middleware,
)
from app.config import settings
from app.deps import get_registry

app = FastAPI(
    title="TECH-AGENT",
    description="Agent Framework Service for Mate Platform",
    version="0.1.0",
)

# Install middlewares & error handlers.
install_trace_id_middleware(app)
install_exception_handlers(app)

# Attach the process-wide registry to the app state.
registry = get_registry()
app.state.registry = registry

# Seed sample agents when running with the in-memory backend (local dev fallback).
if isinstance(registry.repository, InMemoryAgentRepository):
    samples = [
        Agent(
            id="agt-sample-contract-reviewer",
            tenant_id="default",
            agent_code="contract-reviewer",
            name="合同审查助手",
            description="自动识别合同风险条款并生成审查意见。",
            model_id="doubao-lite",
            system_prompt="你是一名专业的合同审查律师。",
            status=AgentStatus.ACTIVE,
        ),
        Agent(
            id="agt-sample-daily-report",
            tenant_id="default",
            agent_code="daily-report",
            name="日报汇总助手",
            description="汇总团队日报并提取关键进展与风险。",
            model_id="doubao-lite",
            system_prompt="你是一名高效的行政助理。",
            status=AgentStatus.ACTIVE,
        ),
        Agent(
            id="agt-sample-data-governance",
            tenant_id="default",
            agent_code="data-governance",
            name="数据治理助手",
            description="辅助识别数据质量问题并推荐清洗规则。",
            model_id="doubao-lite",
            system_prompt="你是一名数据治理专家。",
            status=AgentStatus.DRAFT,
        ),
    ]
    for agent in samples:
        registry.repository._store[(agent.tenant_id, agent.id)] = agent

# Mount the v1 API.
app.include_router(v1_router)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=settings.reload)
