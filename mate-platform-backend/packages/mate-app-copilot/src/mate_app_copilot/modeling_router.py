"""Authenticated, bounded AI recommendations. No native ontology write access."""

import json
import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, model_validator
from fastapi.responses import StreamingResponse

from .api.app import _get_client, _request_bearer_token, _tid
from .modeling_proposal import generate, refine, repair_data
from .modeling_review import review

router = APIRouter(prefix="/api/v1/copilot/modeling", tags=["modeling"])


class ModelingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    profile: dict[str, Any]
    context: str = Field(default="", max_length=2000)
    questions: list[dict[str, Any]] = Field(default_factory=list, max_length=20)
    existingTypes: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    outputSchema: dict[str, Any] | None = Field(
        default=None,
        description="Inert JSON Schema supplied by the ontology adapter; at most 30000 JSON characters. References are never fetched.",
    )
    draft: dict[str, Any] | None = None
    validation: dict[str, Any] | None = None

    @model_validator(mode="after")
    def bounded(self):
        if len(json.dumps(self.model_dump(), ensure_ascii=False)) > 250000:
            raise ValueError("建模输入超过容量限制")
        if (
            self.outputSchema is not None
            and len(json.dumps(self.outputSchema, ensure_ascii=False)) > 30000
        ):
            raise ValueError("生成配置 Schema 超过容量限制")
        sheets = self.profile.get("sheets", [])
        if not isinstance(sheets, list) or len(sheets) > 40:
            raise ValueError("最多支持 40 张工作表")
        for sheet in sheets:
            if not isinstance(sheet, dict) or not isinstance(sheet.get("name"), str):
                raise ValueError("数据画像工作表无效")
            if not isinstance(sheet.get("columns"), list) or len(sheet["columns"]) > 60:
                raise ValueError("数据画像列数无效")
        return self


def identity(request):
    tenant = _tid(request)  # verified JWT tenant, never a caller body tenant
    token = _request_bearer_token(request)
    if not token:
        raise HTTPException(401, "需要用户身份")
    return tenant, token


@router.post("/generate")
async def generate_model(body: ModelingRequest, request: Request):
    tenant, token = identity(request)
    if "text/event-stream" in request.headers.get("accept", ""):
        async def events():
            queue = asyncio.Queue()

            async def run():
                try:
                    result = await generate(
                        _get_client(request), tenant, token, body.profile, body.context,
                        body.questions, body.existingTypes, body.outputSchema,
                        on_progress=lambda value: queue.put_nowait({"type": "progress", "progress": value}),
                    )
                    queue.put_nowait({"type": "result", "result": result})
                except HTTPException as exc:
                    queue.put_nowait({"type": "error", "status": exc.status_code, "detail": exc.detail})
                except Exception:
                    queue.put_nowait({"type": "error", "status": 502, "detail": "AI 建模结果不符合结构或跨表概念约束，草稿未修改"})

            task = asyncio.create_task(run())
            try:
                while True:
                    try:
                        event = await asyncio.wait_for(queue.get(), timeout=15)
                    except asyncio.TimeoutError:
                        yield ": keep-alive\n\n"
                        continue
                    yield "data: " + json.dumps(event, ensure_ascii=False) + "\n\n"
                    if event["type"] in {"result", "error"}:
                        break
            finally:
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)

        return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
    return await generate(
        _get_client(request),
        tenant,
        token,
        body.profile,
        body.context,
        body.questions,
        body.existingTypes,
        body.outputSchema,
    )


@router.post("/review")
async def review_model(body: ModelingRequest, request: Request):
    tenant, token = identity(request)
    if body.draft is None or body.validation is None:
        raise HTTPException(422, "需要草稿及校验结果")
    return await review(
        _get_client(request), tenant, token, body.profile, body.draft, body.validation
    )


@router.post('/refine', operation_id='copilotRefineModelingCandidate')
async def refine_model(body: ModelingRequest, request: Request):
    tenant, token = identity(request)
    if body.draft is None or body.validation is None or body.outputSchema is None:
        raise HTTPException(422, '需要候选、全量预检与补丁 Schema')
    return await refine(_get_client(request), tenant, token, body.profile, body.draft,
                        body.validation, body.outputSchema)


@router.post('/data-repair', operation_id='copilotProposeModelingDataRepair')
async def propose_data_repair(body: ModelingRequest, request: Request):
    tenant, token = identity(request)
    if body.validation is None or body.outputSchema is None:
        raise HTTPException(422, '需要冲突依据和修复 Schema')
    return await repair_data(_get_client(request), tenant, token, body.context, body.validation, body.outputSchema)
