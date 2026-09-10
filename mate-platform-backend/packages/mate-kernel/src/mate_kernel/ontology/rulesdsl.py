"""rulesdsl —— 声明式规则语言最小闭环（ONT-G15 / PRD-24）。

SWRL 风格规则文本 → 解析 → 对推理事实执行。语法（一行一规则）::

    规则名: IF <类谓词>(?<var>) AND <类谓词>(?<var>) THEN <类谓词>(?<var>)

- 类谓词形如 ``employee(?x)``——变量绑定到个体 id；
- 执行语义：THEN 头部谓词按规则体变量的一致绑定推导新事实（正向链），
  重复事实幂等；
- 与 reasoning.engine 的输入输出同构（facts: {predicate: set[ids]}），
  可叠加在 R1/R2/R3 输出之上。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

_RULE_RE = re.compile(r"^(?P<name>[A-Za-z0-9_\-]+)\s*:\s*IF\s+(?P<body>.+?)\s+THEN\s+(?P<head>.+)$")
_ATOM_RE = re.compile(r"^(?P<pred>[A-Za-z0-9_\-]+)\(\?(?P<var>[A-Za-z0-9_\-]+)\)$")


@dataclass(frozen=True)
class Atom:
    predicate: str
    var: str


@dataclass(frozen=True)
class Rule:
    name: str
    body: tuple[Atom, ...]
    head: Atom


@dataclass
class DslResult:
    facts: dict[str, set[str]] = field(default_factory=dict)
    derived: list[dict[str, str]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def parse_rules(text: str) -> tuple[list[Rule], list[str]]:
    """解析规则文本；返回 (规则集, 错误列表)。"""
    rules: list[Rule] = []
    errors: list[str] = []
    for lineno, raw in enumerate(text.strip().splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = _RULE_RE.match(line)
        if not m:
            errors.append(f"line {lineno}: cannot parse: {line!r}")
            continue
        body: list[Atom] = []
        ok = True
        for atom_text in m.group("body").split(" AND "):
            am = _ATOM_RE.match(atom_text.strip())
            if not am:
                errors.append(f"line {lineno}: bad atom: {atom_text!r}")
                ok = False
                continue
            body.append(Atom(am.group("pred"), am.group("var")))
        hm = _ATOM_RE.match(m.group("head").strip())
        if not hm:
            errors.append(f"line {lineno}: bad head atom")
            ok = False
            continue
        if ok and body:
            rules.append(
                Rule(m.group("name"), tuple(body), Atom(hm.group("pred"), hm.group("var")))
            )
    return rules, errors


def _eval_atom(
    atom: Atom, binding: dict[str, str], facts: dict[str, set[str]]
) -> list[dict[str, str]]:
    """对单个体谓词在当前绑定下求可行绑定扩展。"""
    out: list[dict[str, str]] = []
    bound = binding.get(atom.var)
    if bound is not None:
        if bound in facts.get(atom.predicate, set()):
            out.append(binding)
        return out
    for cand in sorted(facts.get(atom.predicate, set())):
        trial = dict(binding)
        trial[atom.var] = cand
        out.append(trial)
    return out


def run_rules(rules: list[Rule], facts: dict[str, set[str]], max_iterations: int = 10) -> DslResult:
    """正向链执行：规则体全绑定满足 ⟹ 推导头部事实（幂等）。"""
    result = DslResult(facts={p: set(v) for p, v in facts.items()})
    for _ in range(max_iterations):
        added = False
        for rule in rules:
            bindings: list[dict[str, str]] = [{}]
            for atom in rule.body:
                nxt: list[dict[str, str]] = []
                for b in bindings:
                    nxt.extend(_eval_atom(atom, b, result.facts))
                bindings = nxt
                if not bindings:
                    break
            for b in bindings:
                head_id = b.get(rule.head.var)
                if not head_id:
                    continue
                bucket = result.facts.setdefault(rule.head.predicate, set())
                if head_id not in bucket:
                    bucket.add(head_id)
                    result.derived.append(
                        {
                            "rule": rule.name,
                            "predicate": rule.head.predicate,
                            "id": head_id,
                        }
                    )
                    added = True
        if not added:
            break
    return result
