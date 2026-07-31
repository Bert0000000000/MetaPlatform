"""Prompt templates (ST-5.3.4).

3 个模板: summarize_doc / extract_entities / plan_task.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class PromptTemplate:
    """Prompt 模板定义."""

    name: str
    description: str
    template: str
    arguments: list[str]

    def render(self, **kwargs: Any) -> str:
        """根据 kwargs 渲染模板."""
        return self.template.format(**kwargs)


SUMMARIZE_DOC = PromptTemplate(
    name="summarize_doc",
    description="总结文档内容(输入文档全文)",
    template=(
        "请用 3 句话总结以下文档:\n"
        "--- 文档开始 ---\n{document}\n--- 文档结束 ---\n"
        "总结:"
    ),
    arguments=["document"],
)

EXTRACT_ENTITIES = PromptTemplate(
    name="extract_entities",
    description="从文本中抽取实体(概念/对象/指标/动作)",
    template=(
        "从以下文本抽取 ontology 实体, 输出 JSON 列表:\n"
        "{text}\n\n"
        "格式: [{{\"id\": \"...\", \"type\": \"Concept|Object|Metric|Action\", \"label\": \"...\"}}]"
    ),
    arguments=["text"],
)

PLAN_TASK = PromptTemplate(
    name="plan_task",
    description="将用户任务拆为可执行步骤",
    template=(
        "任务: {task}\n"
        "可用工具: {tools}\n\n"
        "请输出 JSON 计划: [{{\"step\": 1, \"tool\": \"...\", \"args\": {{...}}}}]"
    ),
    arguments=["task", "tools"],
)


PROMPT_REGISTRY: dict[str, PromptTemplate] = {
    "summarize_doc": SUMMARIZE_DOC,
    "extract_entities": EXTRACT_ENTITIES,
    "plan_task": PLAN_TASK,
}


def list_prompts() -> list[dict[str, Any]]:
    """列出所有 prompt (OpenAPI 格式)."""
    return [
        {
            "name": p.name,
            "description": p.description,
            "arguments": [
                {"name": arg, "required": True} for arg in p.arguments
            ],
        }
        for p in PROMPT_REGISTRY.values()
    ]


def render_prompt(name: str, **kwargs: Any) -> str:
    """渲染 prompt."""
    p = PROMPT_REGISTRY.get(name)
    if p is None:
        raise KeyError(f"Prompt '{name}' not registered")
    logger.info("prompt.render", name=name, args=list(kwargs.keys()))
    return p.render(**kwargs)