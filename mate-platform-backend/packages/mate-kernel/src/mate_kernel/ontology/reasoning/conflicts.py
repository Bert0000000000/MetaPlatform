"""conflicts — Axiom 冲突检测公共入口（SHACL×Axiom 联动闸门配套）。

实现位于 ``engine.detect_axiom_conflicts``（闭包函数 ``_same_as_clusters`` /
``_reach_closure`` 均在 engine）；本模块仅单向再导出，保证
``reasoning.engine`` 与 ``reasoning.conflicts`` 两条导入路径指向同一实现，
且不产生循环导入。
"""

from __future__ import annotations

from .engine import AxiomConflict, detect_axiom_conflicts

__all__ = ["AxiomConflict", "detect_axiom_conflicts"]
