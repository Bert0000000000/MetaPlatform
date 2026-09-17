"""身份**下投影**：把员工定义压成某个执行面能吃的 ``RuntimeBundle``（ADR-0066 §5.8）。

**为什么要有投影这一层**：外部运行时不是"黑箱 CLI"——把一句话敲进去、把回显抄
回来，那是 D-10 要治的"假回执"。下投影的语义是：**员工是谁（角色提示词）、它会
什么（skill 引用清单）、它能碰什么（工具白名单）**这三样，被显式地、可审计地
下放给执行面。执行面变了，身份不变。

**三条硬约束**（本模块就是它们的实现处）：

* ``RuntimeBundle`` 是**本仓类型**——字段全是本仓概念（instructions / tools /
  model ref），**不暴露任何框架类型**（R10）。将来加 ``codex`` / ``dsh`` adapter
  时这个契约不变。
* bundle 只带**引用**（``skillId`` / 工具名 / kb id），**绝不内联密钥**（硬规则
  #12）。:func:`scan_for_secrets` 是那条断言的可执行版本。
* 工具面**只能收窄**（ADR-0066 §5.2）：``tool_scope`` 是交集，写一个员工没有的
  工具不会因此拿到它。

**边界登记（没做的部分）**：

* 投影只出 skill **清单**（id + name + 一句话描述），不出正文——正文由子 agent
  用 ``read_skill`` 按需拉（R6）。对进程外的运行时（Claude Code），``read_skill``
  的挂载面（MCP）**本切片没接**，所以外部运行时实际上拿不到 skill 正文。
* ``kb_ids`` / ``action_rids`` / ``markings`` 三维**没有进 bundle**：外部运行时
  够不到本仓的包络闸门（``EnvelopeGate`` 在 ``superai`` 的执行循环里），把这三维
  写进投影只会造成"下放过了"的错觉。它们在外部运行时上的强制留待后续切片。
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

from ..profiles import EmployeeProfile, RuntimeKind

# ── 密钥扫描（硬规则 #12 的可执行版本）──────────────────────────────────
#
# 判据是"下放产物里只该有引用"。所以扫描器只抓**密钥的形状**，不抓一切长字符串：
# 本仓的 skill id 就叫 ``sk-order-anomaly``（``sk-`` 前缀是技能命名，不是密钥），
# 把它一起禁掉会让断言变成"什么都扫不出来"的空断言。
_SECRET_PATTERNS: tuple[re.Pattern[str], ...] = (
    # 本仓 MCP 长期密钥的前缀（ADR-0062：sk-mcp-*）
    re.compile(r"sk-mcp-[A-Za-z0-9_-]{8,}"),
    re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/-]{16,}=*"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    # key=value 形态的凭据（api_key / client_secret / password …）
    re.compile(
        r"(?i)\b(?:api[_-]?key|client[_-]?secret|secret|password|passwd|token)\b\s*[:=]\s*\S+"
    ),
    # 长十六进制串（>=40）——签名/摘要/随机密钥的常见形态
    re.compile(r"\b[0-9a-fA-F]{40,}\b"),
)


def scan_for_secrets(text: str) -> list[str]:
    """返回文本里**看起来像密钥**的片段（空列表 = 没扫到）。

    刻意用"形状"而不是"值"判定：调用方拿不到密钥清单，也就不可能把清单写进
    扫描器里——那种写法一旦漂移就会静默失效。
    """
    return [match.group(0) for pattern in _SECRET_PATTERNS for match in pattern.finditer(text)]


# ── bundle 类型 ─────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class SkillRef:
    """对一条 skill 的**引用**（不含正文，R6 的渐进加载第 1 层）。"""

    skill_id: str
    name: str
    description: str


@dataclass(frozen=True, slots=True)
class RuntimeBundle:
    """一次下放：某个执行面要拿到的全部东西。

    字段解释（``RuntimeKind.CLAUDE_CODE`` 的用法在括号里）：

    * ``instructions`` —— 角色提示词（渲染进 ``CLAUDE.md`` / 系统提示）
    * ``skills`` —— skill **引用清单**（进指令正文；正文另取）
    * ``tools`` —— 允许调用的工具名（渲染成 ``--allowedTools`` 白名单）
    * ``model`` —— 逻辑模型**引用**（profile 配的那个；是否真的透传给执行面
      由运行时决定——把 llmgw 的模型名塞给 claude CLI 是错的）
    * ``endpoint`` —— 网关/服务端点**引用**（不含凭据）
    * ``working_dir`` —— **由运行时在落盘时填**（投影不知道租户/任务，
      所以投影产物里它恒为空串）
    """

    runtime_kind: RuntimeKind
    instructions: str
    skills: tuple[SkillRef, ...] = ()
    tools: tuple[str, ...] = ()
    model: str = ""
    endpoint: str = ""
    working_dir: str = ""

    def to_manifest_dict(self) -> dict[str, Any]:
        """落盘给外部运行时看的**引用清单**（``projection.json`` 的载荷）。

        只出引用——出现 "content" / "body" / 密钥字样就是漏了东西。
        """
        return {
            "runtimeKind": str(self.runtime_kind),
            "instructions": self.instructions,
            "skills": [
                {"skillId": s.skill_id, "name": s.name, "description": s.description}
                for s in self.skills
            ],
            "tools": list(self.tools),
            "model": self.model,
            "endpoint": self.endpoint,
            "workingDir": self.working_dir,
        }


@runtime_checkable
class ProjectionAdapter(Protocol):
    """把一份 profile 压成 ``RuntimeBundle``（ADR-0066 §5.8 的协议原文）。

    实现必须**幂等且无副作用**：投影只算不下放（写盘是运行时的事），这样同一个
    bundle 可以在多副本上算出同一份内容。
    """

    def render(self, profile: EmployeeProfile, *, tool_scope: Sequence[str]) -> RuntimeBundle:
        """``tool_scope`` 省略/为空 = 取 profile 全部工具；给了就是**交集**。"""
        ...


# ── 共用渲染 ────────────────────────────────────────────────────────────


def narrow_tools(tools: Sequence[str], tool_scope: Sequence[str]) -> tuple[str, ...]:
    """工具面收窄（只能收窄，不能扩）。保持 profile 里的原顺序，便于比对。"""
    if not tool_scope:
        return tuple(tools)
    wanted = set(tool_scope)
    return tuple(name for name in tools if name in wanted)


def _skill_refs(catalog: Any, skill_ids: Sequence[str]) -> tuple[SkillRef, ...]:
    """查不到的 skill **跳过**——名册写错不该让整轮下放失败（与 ``SkillCatalog`` 同口径）。"""
    if catalog is None or not skill_ids:
        return ()
    return tuple(
        SkillRef(skill_id=e.skill_id, name=e.name, description=e.description)
        for e in catalog.manifest(list(skill_ids))
    )


def _skill_manifest_lines(bundle: RuntimeBundle) -> list[str]:
    return [f"- {s.skill_id}（{s.name}）：{s.description}" for s in bundle.skills]


_ONT_RULE = (
    "【本体使用规则】涉及本体对象时，rid 必须来自 ont_list_classes 的返回："
    "先列清单、从中挑选，禁止凭业务名词自己拼造 rid（拼出来的必 404）。"
)


# ── superai 投影 ────────────────────────────────────────────────────────


class SuperAiProjection:
    """``superai``（本仓原生运行时）的投影。

    产出的是 ``LlmEmployeeRuntime`` 构造系统提示要用的材料。刻意**不 import
    langchain**：运行时怎么把 instructions 变成消息是它自己的事，投影只管内容
    （R10 —— 框架待在 adapter 之后）。
    """

    def __init__(self, skills: Any | None = None, *, endpoint: str = "") -> None:
        self._skills = skills
        #: llmgw 端点引用。**默认空**：真正的 base_url 由租户的 provider 配置
        #: 在运行时解析（env-facts §4），投影不猜也不内联它。
        self._endpoint = endpoint

    def render(self, profile: EmployeeProfile, *, tool_scope: Sequence[str]) -> RuntimeBundle:
        tools = narrow_tools(profile.tools, tool_scope)
        skills = _skill_refs(self._skills, profile.skills)
        parts = [profile.system_prompt.strip()]
        if any(name.startswith("ont_") for name in tools):
            parts.append(_ONT_RULE)
        if skills:
            manifest = "\n".join(f"- {s.skill_id}（{s.name}）：{s.description}" for s in skills)
            parts.append(
                "你可以使用以下技能。清单里只有名字与一句话说明；"
                "需要具体做法时先调用 read_skill 取全文，不要凭名字臆测。\n" + manifest
            )
        return RuntimeBundle(
            runtime_kind=RuntimeKind.SUPERAI,
            instructions="\n\n".join(p for p in parts if p),
            skills=skills,
            tools=tools,
            model=profile.model,
            endpoint=self._endpoint,
        )


# ── claude_code 投影 ────────────────────────────────────────────────────


class ClaudeCodeProjection:
    """``claude_code``（外部 CLI）的投影：渲染 ``CLAUDE.md`` 式指令 + 工具白名单。

    三样东西被**真的**下放（这是它区别于"黑箱调用"的地方）：

    1. **角色**：员工的 system prompt 变成 CLI 的系统提示（不是通用模板）；
    2. **工具面**：profile 白名单 ∩ tool_scope → ``--allowedTools``；
    3. **skill 引用**：清单进指令正文（正文不进——见模块头的边界登记）。
    """

    def __init__(self, skills: Any | None = None) -> None:
        self._skills = skills

    def render(self, profile: EmployeeProfile, *, tool_scope: Sequence[str]) -> RuntimeBundle:
        tools = narrow_tools(profile.tools, tool_scope)
        skills = _skill_refs(self._skills, profile.skills)
        bundle = RuntimeBundle(
            runtime_kind=RuntimeKind.CLAUDE_CODE,
            instructions="",
            skills=skills,
            tools=tools,
            model=profile.model,
        )
        lines = [
            f"# {profile.name}（{profile.profile_id}）",
            "",
            profile.system_prompt.strip(),
            "",
            "## 你的工具面（只允许调用这些工具，其他一律不要尝试）",
        ]
        lines += [f"- {name}" for name in tools] or ["- （本次没有发放任何工具）"]
        if bundle.skills:
            lines += ["", "## 可用技能（只有清单；需要具体做法时先取全文，不要凭名字臆测）"]
            lines += _skill_manifest_lines(bundle)
        lines += [
            "",
            "## 边界",
            "- 产出必须是你**实际得到的**结果；查不到就直说查不到，不要编造。",
            f"- 你的角色是「{profile.base_role}」，不要在这一点上漂移。",
        ]
        return RuntimeBundle(
            runtime_kind=bundle.runtime_kind,
            instructions="\n".join(lines),
            skills=bundle.skills,
            tools=bundle.tools,
            model=bundle.model,
        )


__all__ = [
    "ClaudeCodeProjection",
    "ProjectionAdapter",
    "RuntimeBundle",
    "SkillRef",
    "SuperAiProjection",
    "narrow_tools",
    "scan_for_secrets",
]
