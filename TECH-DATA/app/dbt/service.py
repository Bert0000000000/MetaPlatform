"""DBT service (mock compile/run + DAG visualization)."""

from __future__ import annotations

from typing import Any, Dict, List

from app.common.errors import DataSourceNotFoundError, InvalidParamError
from app.dbt.orm import DbtModelORM, DbtProjectORM
from app.dbt.repository import DbtRepository, _new_model_id, _new_project_id
from app.dbt.schemas import (
    CreateDbtModelRequest,
    CreateDbtProjectRequest,
    DbtCompileResult,
    DbtDag,
    DbtDagEdge,
    DbtDagNode,
    DbtModel,
    DbtProject,
    DbtRunResult,
    MaterializationType,
    UpdateDbtProjectRequest,
)


def _now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


class DbtService:
    def __init__(self, repository: DbtRepository) -> None:
        self._repo = repository

    # ----------------------------------------------------- projects

    async def create_project(
        self, tenant_id: str, request: CreateDbtProjectRequest
    ) -> DbtProject:
        existing = [
            p
            for p in await self._repo.list_projects(tenant_id)
            if p.name == request.name
        ]
        if existing:
            raise InvalidParamError(
                f"DBT 项目名称已存在: name={request.name}",
                data={"name": request.name},
            )
        p = DbtProjectORM(
            id=_new_project_id(),
            tenant_id=tenant_id,
            name=request.name,
            project_path=request.projectPath,
            profile=request.profile,
            target=request.target,
        )
        saved = await self._repo.insert_project(p)
        return self._to_project(saved)

    async def list_projects(self, tenant_id: str) -> List[DbtProject]:
        items = await self._repo.list_projects(tenant_id)
        return [self._to_project(p) for p in items]

    async def get_project(self, tenant_id: str, project_id: str) -> DbtProject:
        p = await self._repo.get_project(project_id, tenant_id)
        if p is None:
            raise DataSourceNotFoundError(
                f"DBT 项目不存在: id={project_id}", data={"id": project_id}
            )
        return self._to_project(p)

    async def update_project(
        self,
        tenant_id: str,
        project_id: str,
        request: UpdateDbtProjectRequest,
    ) -> DbtProject:
        await self.get_project(tenant_id, project_id)
        fields: Dict[str, Any] = {}
        if request.name is not None:
            fields["name"] = request.name
        if request.projectPath is not None:
            fields["project_path"] = request.projectPath
        if request.profile is not None:
            fields["profile"] = request.profile
        if request.target is not None:
            fields["target"] = request.target
        updated = await self._repo.update_project(project_id, tenant_id, fields)
        if updated is None:
            raise DataSourceNotFoundError(
                f"DBT 项目不存在: id={project_id}", data={"id": project_id}
            )
        return self._to_project(updated)

    async def delete_project(self, tenant_id: str, project_id: str) -> Dict[str, Any]:
        await self.get_project(tenant_id, project_id)
        await self._repo.delete_project(project_id, tenant_id)
        return {"id": project_id, "deleted": True}

    # ----------------------------------------------------- models

    async def create_model(
        self,
        tenant_id: str,
        project_id: str,
        request: CreateDbtModelRequest,
    ) -> DbtModel:
        await self.get_project(tenant_id, project_id)
        m = DbtModelORM(
            id=_new_model_id(),
            tenant_id=tenant_id,
            project_id=project_id,
            name=request.name,
            schema=request.schema,
            materialized=request.materialized.value,
            sql=request.sql,
            dependencies=request.dependencies,
        )
        saved = await self._repo.insert_model(m)
        return self._to_model(saved)

    async def list_models(
        self, tenant_id: str, project_id: str
    ) -> List[DbtModel]:
        await self.get_project(tenant_id, project_id)
        items = await self._repo.list_models(project_id, tenant_id)
        return [self._to_model(m) for m in items]

    # ----------------------------------------------------- compile / run (mock)

    async def compile_project(
        self, tenant_id: str, project_id: str
    ) -> DbtCompileResult:
        project = await self.get_project(tenant_id, project_id)
        models = await self._repo.list_models(project_id, tenant_id)
        compiled_lines: List[str] = [
            f"-- DBT compile for project {project.name}",
            f"-- target: {project.target or 'dev'}",
        ]
        for m in models:
            compiled_lines.append(
                f"-- model {m.name} ({m.materialized})"
            )
            compiled_lines.append(m.sql or f"SELECT * FROM {m.name}_source;")
        return DbtCompileResult(
            projectId=project.id,
            compiledSql="\n".join(compiled_lines),
            warnings=[],
        )

    async def run_project(
        self, tenant_id: str, project_id: str
    ) -> DbtRunResult:
        project = await self.get_project(tenant_id, project_id)
        models = await self._repo.list_models(project_id, tenant_id)
        log = [f"{_now_iso()} dbt run --project {project.name}"]
        for m in models:
            log.append(f"{_now_iso()} OK {m.name}")
        return DbtRunResult(
            projectId=project.id,
            status="SUCCESS",
            affectedRows=len(models) * 100,
            durationMs=len(models) * 50,
            log=log,
        )

    async def dag(self, tenant_id: str, project_id: str) -> DbtDag:
        project = await self.get_project(tenant_id, project_id)
        models = await self._repo.list_models(project_id, tenant_id)
        nodes = [
            DbtDagNode(
                id=m.id,
                label=m.name,
                schema=m.schema,
                materialized=MaterializationType(m.materialized),
            )
            for m in models
        ]
        edges: List[DbtDagEdge] = []
        model_by_name = {m.name: m for m in models}
        for m in models:
            for dep in m.dependencies:
                target = model_by_name.get(dep)
                if target:
                    edges.append(DbtDagEdge(source=target.id, target=m.id))
        return DbtDag(projectId=project.id, nodes=nodes, edges=edges)

    # ----------------------------------------------------- helpers

    def _to_project(self, p: DbtProjectORM) -> DbtProject:
        return DbtProject(
            id=p.id,
            tenantId=p.tenant_id,
            name=p.name,
            projectPath=p.project_path,
            profile=p.profile,
            target=p.target,
            createdAt=p.created_at,
            updatedAt=p.updated_at,
        )

    def _to_model(self, m: DbtModelORM) -> DbtModel:
        return DbtModel(
            id=m.id,
            projectId=m.project_id,
            tenantId=m.tenant_id,
            name=m.name,
            schema=m.schema,
            materialized=MaterializationType(m.materialized),
            sql=m.sql,
            dependencies=m.dependencies,
            createdAt=m.created_at,
        )