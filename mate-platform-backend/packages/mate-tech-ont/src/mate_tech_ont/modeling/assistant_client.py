"""Anti-corruption client: AI proposes inert candidates, never native mutations."""

from __future__ import annotations

import json
import logging
import os
from contextvars import ContextVar

import httpx
from fastapi import HTTPException
from pydantic import ValidationError

from mate_clients.security.outgoing import user_async_client

from .core import Draft
from .quality import validate_review

logger = logging.getLogger(__name__)
generation_progress = ContextVar("generation_progress", default=None)


async def _post(operation, payload, authorization, tenant):
    if not authorization or not tenant:
        raise HTTPException(401, "需要用户和租户身份")
    base = os.getenv(
        "MODELING_COPILOT_URL", os.getenv("COPILOT_API_URL", "http://mate-app-copilot:8601")
    )
    headers = {
        "Authorization": authorization
        if authorization.lower().startswith("bearer ")
        else "Bearer " + authorization,
        "X-Tenant-Id": tenant,
    }
    try:
        # Generation discovers global concepts, then maps at most three sheets
        # per provider request. A fixed ten-minute read timeout for the entire
        # sequence cuts off valid multi-batch work while Copilot is still running.
        sheet_count = len(payload.get("profile", {}).get("sheets", []))
        batches = (min(sheet_count, 40) + 2) // 3 if operation == "generate" else 1
        read_timeout = 600 + 180 * max(0, batches - 1)
        async with user_async_client(
            headers["Authorization"],
            tenant_id=tenant,
            timeout=httpx.Timeout(read_timeout, connect=15),
        ) as client:
            callback = generation_progress.get() if operation == "generate" else None
            url = base.rstrip("/") + "/api/v1/copilot/modeling/" + operation
            if callback:
                async with client.stream(
                    "POST", url, headers={**headers, "Accept": "text/event-stream"}, json=payload
                ) as streamed:
                    if streamed.status_code == 200 and "text/event-stream" in streamed.headers.get(
                        "content-type", ""
                    ):
                        response = None
                        async for line in streamed.aiter_lines():
                            if not line.startswith("data:"):
                                continue
                            event = json.loads(line[5:].strip())
                            if event.get("type") == "progress":
                                await callback(event["progress"])
                            elif event.get("type") == "result":
                                if not isinstance(event.get("result"), dict):
                                    raise ValueError("invalid result")
                                return event["result"]
                            elif event.get("type") == "error":
                                response = httpx.Response(
                                    event.get("status", 502), json={"detail": event.get("detail")}
                                )
                                break
                        if response is None:
                            raise ValueError("incomplete progress stream")
                    else:
                        await streamed.aread()
                        response = streamed
            else:
                response = await client.post(url, headers=headers, json=payload)
        if response.status_code != 200:
            status = response.status_code if response.status_code in (401, 403, 422, 503) else 502
            detail = response.json().get("detail")
            safe_messages = {
                "AI 输出被截断（达到模型输出上限），未生成完整候选；草稿未修改",
                "AI 未返回完整有效的 JSON，请检查模型配置后重试；草稿未修改",
                "AI 建模结果不符合结构或跨表概念约束，草稿未修改",
                "请先配置默认 AI 服务商、模型及访问凭证",
                "无法读取当前租户的 AI 配置",
                "AI 模型服务响应超时，请稍后重试；草稿未修改",
                "无法连接 AI 模型服务，自动重试后仍失败，请检查服务地址和网络；草稿未修改",
                "AI 模型服务拒绝访问，请检查服务商凭证及模型权限；草稿未修改",
                "AI 模型服务请求受限，自动重试后仍失败，请稍后重试；草稿未修改",
                "AI 模型服务返回异常状态，请检查服务地址或稍后重试；草稿未修改",
                "AI 服务商网关超时，自动重试后仍失败，请稍后重试或检查服务商状态；草稿未修改",
                "AI 服务商未找到所选模型或接口，请检查模型 ID 和服务地址；草稿未修改",
            }
            for code, explanation in {
                "mapping_shape": "映射结果结构无效",
                "mapping_unknown_class": "映射引用了全局候选中不存在的对象类型",
                "mapping_outside_group": "映射引用了当前批次之外的工作表",
                "mapping_unknown_property": "映射引用了对象中不存在的属性",
                "mapping_unknown_column": "映射引用了工作表中不存在的字段",
                "mapping_limit": "映射数量超过支持上限",
            }.items():
                safe_messages.add(
                    f"AI 建模结果不符合结构或跨表概念约束，草稿未修改（{code}：{explanation}）"
                )
            message = (
                detail
                if isinstance(detail, str) and detail in safe_messages
                else "AI 建模服务请求失败，请检查权限及模型配置；草稿未修改"
            )
            raise HTTPException(status, message)
        result = response.json()
        if not isinstance(result, dict):
            raise ValueError("invalid response")
        return result
    except httpx.TimeoutException:
        logger.warning(
            "modeling service request failed: operation=%s error_type=timeout", operation
        )
        raise HTTPException(
            502, "AI 建模任务等待超时，草稿未修改；请检查任务状态后再重试"
        ) from None
    except httpx.HTTPError as exc:
        logger.warning(
            "modeling service request failed: operation=%s error_type=%s",
            operation,
            type(exc).__name__,
        )
        raise HTTPException(
            502, "无法连接 AI 建模服务，草稿未修改；请检查建模服务运行状态"
        ) from None
    except ValueError:
        logger.warning(
            "modeling service request failed: operation=%s error_type=invalid_response", operation
        )
        raise HTTPException(502, "AI 建模服务返回了无效响应；草稿未修改") from None


async def generate(profile, context, questions, existing_types, authorization, tenant):
    result = await _post(
        "generate",
        {
            "profile": profile,
            "context": context,
            "questions": questions,
            "existingTypes": existing_types,
            "outputSchema": Draft.model_json_schema(),
        },
        authorization,
        tenant,
    )
    try:
        draft = Draft.model_validate(result["draft"]).model_dump()
        # A provider cannot pre-approve proposals or insert manual source facts.
        if draft["instances"] or draft["instanceEdits"] or draft["links"]:
            raise ValueError("AI must not create manual facts")
        for family in ("classes", "mappings", "relationships"):
            for item in draft[family]:
                item["accepted"] = False
                if family != "mappings":
                    # Publication scope is a human choice, never a provider decision.
                    item["included"] = True
        for item in draft["classes"]:
            item["identityStatus"] = "proposed" if item["identity"] else "unresolved"
            for key in item["uniqueKeys"]:
                key["confirmed"] = False
        # Inspect the raw response: Pydantic's legacy cardinality default is not
        # evidence that a provider actually proposed a rule.
        for raw, item in zip(result["draft"]["relationships"], draft["relationships"], strict=True):
            item["cardinalityStatus"] = "proposed" if "cardinality" in raw else "unresolved"
            if item["targetSelection"] == "legacy":
                item["targetSelection"] = "entity"
        draft["semantics"]["context"] = context
        draft["semantics"]["questions"] = questions
        for definition in draft["semantics"]["definitions"]:
            definition["confirmed"] = False
        from .rules import relationship_field_problem

        model = Draft.model_validate(draft)
        classes = {c.id: c for c in model.classes}
        pending = []
        for relation in model.relationships:
            problem = relationship_field_problem(relation, classes)
            if problem:
                pending.append(f"「{relation.name}」：{problem}")
        if pending and len(model.notes) < 30:
            model.notes.append(
                (
                    "关系待完善（请在候选审核中处理，不会自动确认或移出发布范围）："
                    + "；".join(pending)
                )[:1000]
            )
        return Draft.model_validate(model.model_dump()).model_dump()
    except ValidationError as exc:
        # Locations and machine error codes only; never expose provider values or raw output.
        details = "; ".join(
            ".".join(str(part) for part in error["loc"]) + ":" + error["type"]
            for error in exc.errors(include_input=False)[:5]
        )
        raise HTTPException(502, "AI 建模结果结构无效；草稿未修改（" + details + "）") from None
    except (KeyError, TypeError, ValueError):
        raise HTTPException(502, "AI 建模结果结构无效；草稿未修改") from None


async def review(profile, draft, validation, authorization, tenant):
    result = await _post(
        "review",
        {"profile": profile, "draft": draft, "validation": validation},
        authorization,
        tenant,
    )
    try:
        return validate_review(
            result["review"],
            {
                "draft": Draft.model_validate(draft).model_dump(),
                "evidence": [
                    {"id": "sheet:" + sheet["name"]} for sheet in profile.get("sheets", [])
                ],
            },
        )
    except (ValidationError, KeyError, TypeError, ValueError):
        raise HTTPException(502, "AI 语义审查结果结构无效") from None
