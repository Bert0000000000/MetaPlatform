from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_routing_optimizer
from app.routing.schemas import (
    CreateRoutingRuleRequest,
    RoutingRequest,
    UpdateRoutingRuleRequest,
)
from app.routing.service import ModelRoutingOptimizer

router = APIRouter(tags=["routing"])


@router.post("/routing/recommend", summary="模型路由推荐")
async def recommend_model(
    request: Request,
    body: RoutingRequest,
    ctx: RequestContext = Depends(request_context_dep),
    optimizer: ModelRoutingOptimizer = Depends(get_routing_optimizer),
):
    rec = await optimizer.recommend(ctx.tenant_id, body)
    return success(rec.model_dump(), trace_id=ctx.trace_id)


@router.get("/routing/rules", summary="路由规则列表")
async def list_rules(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    optimizer: ModelRoutingOptimizer = Depends(get_routing_optimizer),
):
    items = [r.model_dump() for r in optimizer.list_rules(ctx.tenant_id)]
    return success({"items": items}, trace_id=ctx.trace_id)


@router.post("/routing/rules", summary="创建路由规则")
async def create_rule(
    request: Request,
    body: CreateRoutingRuleRequest,
    ctx: RequestContext = Depends(request_context_dep),
    optimizer: ModelRoutingOptimizer = Depends(get_routing_optimizer),
):
    rule = optimizer.create_rule(ctx.tenant_id, body)
    return success(rule.model_dump(), trace_id=ctx.trace_id)


@router.get("/routing/rules/{rule_id}", summary="路由规则详情")
async def get_rule(
    rule_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    optimizer: ModelRoutingOptimizer = Depends(get_routing_optimizer),
):
    rule = optimizer.get_rule(ctx.tenant_id, rule_id)
    return success(rule.model_dump(), trace_id=ctx.trace_id)


@router.put("/routing/rules/{rule_id}", summary="更新路由规则")
async def update_rule(
    rule_id: str,
    request: Request,
    body: UpdateRoutingRuleRequest,
    ctx: RequestContext = Depends(request_context_dep),
    optimizer: ModelRoutingOptimizer = Depends(get_routing_optimizer),
):
    rule = optimizer.update_rule(ctx.tenant_id, rule_id, body)
    return success(rule.model_dump(), trace_id=ctx.trace_id)


@router.delete("/routing/rules/{rule_id}", summary="删除路由规则")
async def delete_rule(
    rule_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    optimizer: ModelRoutingOptimizer = Depends(get_routing_optimizer),
):
    optimizer.delete_rule(ctx.tenant_id, rule_id)
    return success(None, trace_id=ctx.trace_id)
