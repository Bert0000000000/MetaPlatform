"""models —— PALANTIR Dynamic 层对位：模型对象注册与动态安全（ONT-G22）。

ModelObject = 一个可被 Agent/Function 调用的模型（LLM/分类器/预测器）的
一等注册对象：
  - serving 元数据（provider/base_url/model）
  - 输入输出 schema 引用（JSON Schema 字符串，内联即可）
  - required_markings：调用者须持有的 marking 集（动态安全：可见性 =
    actor_markings ⊇ required_markings）

registry 提供 register / get / visible_to（按 actor markings 过滤）——
与 ObjectType.marking 的工具可见性语义一致（SAL-06 对位）。
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ModelObject:
    rid: str                      # ont.<tenant>.mdl.<slug>.<ver>
    display_name: str
    provider: str                 # openai-compatible | anthropic | ark-plan | …
    model: str                    # 供给方模型名
    base_url: str = ""
    input_schema: str = ""        # JSON Schema（字符串内联）
    output_schema: str = ""
    required_markings: frozenset[str] = frozenset()


class ModelRegistry:
    def __init__(self) -> None:
        self._models: dict[str, ModelObject] = {}

    def register(self, model: ModelObject) -> ModelObject:
        if not model.rid.startswith("ont.") or ".mdl." not in model.rid:
            raise ValueError(f"invalid model rid: {model.rid!r}")
        self._models[model.rid] = model
        return model

    def get(self, rid: str) -> ModelObject | None:
        return self._models.get(rid)

    def visible_to(self, actor_markings: frozenset[str] | set[str]) -> list[ModelObject]:
        """动态安全：actor markings 覆盖模型 required_markings 才可见。"""
        actor = set(actor_markings)
        return sorted(
            (m for m in self._models.values()
             if set(m.required_markings) <= actor),
            key=lambda m: m.rid,
        )

    def check(self, rid: str, actor_markings: frozenset[str] | set[str]) -> tuple[bool, str]:
        m = self._models.get(rid)
        if m is None:
            return False, "not_found"
        missing = set(m.required_markings) - set(actor_markings)
        if missing:
            return False, f"missing_markings:{sorted(missing)}"
        return True, "ok"
