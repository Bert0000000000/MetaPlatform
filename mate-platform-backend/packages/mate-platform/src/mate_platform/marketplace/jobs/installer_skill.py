"""Skill installer — registers a skill artifact into the SkillHub store.

The orchestrator hands off ``kind="skill"`` artifacts to this installer,
which stores the skill blob into the SkillHub registry (public/private)
and returns ``{instance_uid, registered_digest}`` for 硬规则 #14.
"""
from __future__ import annotations

from ._base import BaseInstaller


class SkillInstaller(BaseInstaller):
    kind = "skill"
    register_method = "register_skill"
