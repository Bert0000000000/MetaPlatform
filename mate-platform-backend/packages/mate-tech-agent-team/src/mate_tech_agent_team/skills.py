"""技能渐进加载（任务 6 的核心，1.0 只做两层）。

**两层**：

* 第 1 层「清单」——常驻提示词，每条只有 ``skill_id / name / 一句话描述``，
  **不含正文**。员工一多、技能一多，撑爆提示词的从来是正文。
* 第 2 层「正文」——员工觉得需要时，用 ``read_skill(skill_id)`` 现拉。

数据源是既有 SkillHub（``mate_platform.marketplace.skillhub.store``），
本模块只是**读取侧**的薄封装，不新建存储。
"""

from __future__ import annotations

from dataclasses import dataclass

#: 清单预算：上下文 2% ≈ 8000 字符（1.0 取固定上限，不做动态窗口）
MANIFEST_BUDGET_CHARS = 8000


class SkillNotFound(LookupError):
    """SkillHub 里没有这个 skill。"""


@dataclass(frozen=True, slots=True)
class SkillManifestEntry:
    skill_id: str
    name: str
    description: str


def _one_line(text: str) -> str:
    return " ".join((text or "").split())


class SkillCatalog:
    """把员工挂的 skill id 清单渲染成预算内的清单 + 按需取正文。"""

    def __init__(self, store: object, *, budget_chars: int = MANIFEST_BUDGET_CHARS) -> None:
        self._store = store
        self._budget = budget_chars

    @property
    def budget_chars(self) -> int:
        return self._budget

    def manifest(self, skill_ids: tuple[str, ...] | list[str]) -> list[SkillManifestEntry]:
        """清单条目。查不到的 skill 跳过（名册写错不该让整轮跑挂）。"""
        entries: list[SkillManifestEntry] = []
        for skill_id in skill_ids:
            skill = self._store.get(skill_id)  # type: ignore[attr-defined]
            if skill is None:
                continue
            entries.append(
                SkillManifestEntry(
                    skill_id=skill.id,
                    name=skill.name,
                    description=_one_line(getattr(skill, "description", "")),
                )
            )
        return entries

    def render(self, skill_ids: tuple[str, ...] | list[str]) -> str:
        """渲染成提示词里的一段。**超预算的条目直接不列**，绝不退化成列正文。"""
        lines: list[str] = []
        used = 0
        entries = self.manifest(skill_ids)
        for entry in entries:
            line = f"- {entry.skill_id}（{entry.name}）：{entry.description}"
            if used + len(line) + 1 > self._budget:
                lines.append(f"- （其余 {len(entries) - len(lines)} 个技能因超出预算未列出）")
                break
            lines.append(line)
            used += len(line) + 1
        return "\n".join(lines)

    def read(self, skill_id: str) -> str:
        """第 2 层：取正文。"""
        skill = self._store.get(skill_id)  # type: ignore[attr-defined]
        if skill is None:
            raise SkillNotFound(skill_id)
        return skill.content

    def manifest_size(self, skill_ids: tuple[str, ...] | list[str]) -> int:
        """清单渲染后的字符数——调用方据此断言"没超预算"。"""
        return len(self.render(skill_ids))

    def search(self, query: str, *, tenant_id: str, limit: int = 5) -> list[SkillManifestEntry]:
        """清单外兜底：按关键词在 SkillHub 里找。

        只回 ``SkillManifestEntry``（不出正文）——兜底也不能把正文灌进上下文。
        """
        text = (query or "").strip().lower()
        if not text:
            return []
        found: list[SkillManifestEntry] = []
        for skill in self._store.list(tenant_id):  # type: ignore[attr-defined]
            haystack = f"{skill.name} {getattr(skill, 'description', '')}".lower()
            if text in haystack:
                found.append(
                    SkillManifestEntry(
                        skill_id=skill.id,
                        name=skill.name,
                        description=_one_line(getattr(skill, "description", "")),
                    )
                )
            if len(found) >= limit:
                break
        return found


__all__ = [
    "MANIFEST_BUDGET_CHARS",
    "SkillCatalog",
    "SkillManifestEntry",
    "SkillNotFound",
]
