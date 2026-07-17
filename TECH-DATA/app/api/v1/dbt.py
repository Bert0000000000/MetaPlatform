"""DBT integration endpoints (P3-DATA-02)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.dbt.schemas import (
    CreateDbtModelRequest,
    CreateDbtProjectRequest,
    UpdateDbtProjectRequest,
)
from app.dbt.service import DbtService
from app.deps import get_dbt_service

router = APIRouter(tags=["dbt"])


# ----------------------------------------------------------- projects


@router.post("/dbt/projects", summary="创建 DBT 项目")
async def create_project(
    body: CreateDbtProjectRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DbtService = Depends(get_dbt_service),
) -> dict:
    project = await service.create_project(ctx.tenant_id, body)
    return success(project.model_dump(), trace_id=ctx.trace_id)


@router.get("/dbt/projects", summary="DBT 项目列表")
async def list_projects(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DbtService = Depends(get_dbt_service),
) -> dict:
    items = [p.model_dump() for p in await service.list_projects(ctx.tenant_id)]
    return success({"items": items}, trace_id=ctx.trace_id)


@router.get("/dbt/projects/{project_id}", summary="DBT 项目详情")
async def get_project(
    project_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DbtService = Depends(get_dbt_service),
) -> dict:
    project = await service.get_project(ctx.tenant_id, project_id)
    return success(project.model_dump(), trace_id=ctx.trace_id)


@router.put("/dbt/projects/{project_id}", summary="更新 DBT 项目")
async def update_project(
    project_id: str,
    body: UpdateDbtProjectRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DbtService = Depends(get_dbt_service),
) -> dict:
    project = await service.update_project(ctx.tenant_id, project_id, body)
    return success(project.model_dump(), trace_id=ctx.trace_id)


@router.delete("/dbt/projects/{project_id}", summary="删除 DBT 项目")
async def delete_project(
    project_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DbtService = Depends(get_dbt_service),
) -> dict:
    result = await service.delete_project(ctx.tenant_id, project_id)
    return success(result, trace_id=ctx.trace_id)


@router.post("/dbt/projects/{project_id}/compile", summary="编译 DBT 项目")
async def compile_project(
    project_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DbtService = Depends(get_dbt_service),
) -> dict:
    result = await service.compile_project(ctx.tenant_id, project_id)
    return success(result.model_dump(), trace_id=ctx.trace_id)


@router.post("/dbt/projects/{project_id}/run", summary="运行 DBT 项目")
async def run_project(
    project_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DbtService = Depends(get_dbt_service),
) -> dict:
    result = await service.run_project(ctx.tenant_id, project_id)
    return success(result.model_dump(), trace_id=ctx.trace_id)


@router.get("/dbt/projects/{project_id}/dag", summary="DBT DAG 视图")
async def project_dag(
    project_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DbtService = Depends(get_dbt_service),
) -> dict:
    dag = await service.dag(ctx.tenant_id, project_id)
    return success(dag.model_dump(), trace_id=ctx.trace_id)


# ----------------------------------------------------------- models


@router.post("/dbt/projects/{project_id}/models", summary="新增 DBT 模型")
async def create_model(
    project_id: str,
    body: CreateDbtModelRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DbtService = Depends(get_dbt_service),
) -> dict:
    model = await service.create_model(ctx.tenant_id, project_id, body)
    return success(model.model_dump(), trace_id=ctx.trace_id)


@router.get("/dbt/projects/{project_id}/models", summary="DBT 模型列表")
async def list_models(
    project_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DbtService = Depends(get_dbt_service),
) -> dict:
    items = [m.model_dump() for m in await service.list_models(ctx.tenant_id, project_id)]
    return success({"items": items}, trace_id=ctx.trace_id)