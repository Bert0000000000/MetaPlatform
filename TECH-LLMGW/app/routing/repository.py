from __future__ import annotations

from threading import RLock
from typing import Dict, List, Optional

from app.routing.orm import Base, RoutingRuleORM
from app.routing.schemas import RoutingRule


def _row_to_rule(row: RoutingRuleORM) -> RoutingRule:
    return RoutingRule(
        ruleId=row.rule_id,
        tenantId=row.tenant_id,
        name=row.name,
        description=row.description or "",
        requiredCapabilities=list(row.required_capabilities or []),
        preferredProvider=row.preferred_provider,
        strategy=row.strategy,
        priority=row.priority,
        fallbackModelId=row.fallback_model_id,
        enabled=row.enabled,
        createdAt=row.created_at,
        updatedAt=row.updated_at,
    )


def _rule_to_row(rule: RoutingRule) -> RoutingRuleORM:
    return RoutingRuleORM(
        rule_id=rule.ruleId,
        tenant_id=rule.tenantId,
        name=rule.name,
        description=rule.description,
        required_capabilities=rule.requiredCapabilities,
        preferred_provider=rule.preferredProvider,
        strategy=rule.strategy.value,
        priority=rule.priority,
        fallback_model_id=rule.fallbackModelId,
        enabled=rule.enabled,
        created_at=rule.createdAt,
        updated_at=rule.updatedAt,
    )


class RoutingRuleRepository:
    def __init__(self) -> None:
        self._lock = RLock()
        self._rules: Dict[str, RoutingRule] = {}

    def insert(self, rule: RoutingRule) -> RoutingRule:
        with self._lock:
            self._rules[rule.ruleId] = rule
        return rule

    def update(self, rule: RoutingRule) -> RoutingRule:
        with self._lock:
            self._rules[rule.ruleId] = rule
        return rule

    def get(self, tenant_id: str, rule_id: str) -> RoutingRule:
        with self._lock:
            rule = self._rules.get(rule_id)
        if rule is None or rule.tenantId != tenant_id:
            raise KeyError(f"routing rule not found: {rule_id}")
        return rule

    def list(self, tenant_id: str) -> List[RoutingRule]:
        with self._lock:
            items = [r for r in self._rules.values() if r.tenantId == tenant_id]
        return sorted(items, key=lambda r: (-r.priority, r.createdAt))

    def delete(self, tenant_id: str, rule_id: str) -> None:
        with self._lock:
            rule = self._rules.get(rule_id)
            if rule is None or rule.tenantId != tenant_id:
                raise KeyError(f"routing rule not found: {rule_id}")
            del self._rules[rule_id]

    def clear(self) -> None:
        with self._lock:
            self._rules.clear()


class SqlAlchemyRoutingRuleRepository:
    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    @classmethod
    async def create_all(cls, engine) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def insert(self, rule: RoutingRule) -> RoutingRule:
        async with self._session_factory() as session:
            session.add(_rule_to_row(rule))
            await session.commit()
            return rule

    async def update(self, rule: RoutingRule) -> RoutingRule:
        async with self._session_factory() as session:
            existing = await session.get(RoutingRuleORM, rule.ruleId)
            if existing is None:
                raise KeyError(f"routing rule not found: {rule.ruleId}")
            row = _rule_to_row(rule)
            for col in [
                "name",
                "description",
                "required_capabilities",
                "preferred_provider",
                "strategy",
                "priority",
                "fallback_model_id",
                "enabled",
                "updated_at",
            ]:
                setattr(existing, col, getattr(row, col))
            await session.commit()
            return rule

    async def get(self, tenant_id: str, rule_id: str) -> RoutingRule:
        async with self._session_factory() as session:
            row = await session.get(RoutingRuleORM, rule_id)
        if row is None or row.tenant_id != tenant_id:
            raise KeyError(f"routing rule not found: {rule_id}")
        return _row_to_rule(row)

    async def list(self, tenant_id: str) -> List[RoutingRule]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = (
                select(RoutingRuleORM)
                .where(RoutingRuleORM.tenant_id == tenant_id)
                .order_by(RoutingRuleORM.priority.desc(), RoutingRuleORM.created_at)
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [_row_to_rule(r) for r in rows]

    async def delete(self, tenant_id: str, rule_id: str) -> None:
        async with self._session_factory() as session:
            row = await session.get(RoutingRuleORM, rule_id)
            if row is None or row.tenant_id != tenant_id:
                raise KeyError(f"routing rule not found: {rule_id}")
            await session.delete(row)
            await session.commit()

    async def clear(self) -> None:
        async with self._session_factory() as session:
            await session.execute(RoutingRuleORM.__table__.delete())
            await session.commit()
