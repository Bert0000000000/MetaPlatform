"""TECH-LLMGW client used by the Agent execution engine.

ALL LLM calls (chat, streaming, embeddings) go through this gateway.
When ``base_url`` is empty, the client returns a deterministic mock
response so the execution engine can run without the upstream service.
"""

from __future__ import annotations

import asyncio
import hashlib
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx

from app.common.errors import LLMGWUnavailableError


class LLMGWClient:
    """Thin async client for TECH-LLMGW chat completions.

    When ``base_url`` is empty, the client returns a deterministic mock
    response so the execution engine can run without the upstream service.
    """

    def __init__(self, base_url: str, timeout: float = 30.0) -> None:
        self._base_url = base_url.rstrip("/") if base_url else ""
        self._timeout = timeout

    async def chat(
        self,
        model_id: str,
        messages: List[Dict[str, Any]],
        *,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        functions: Optional[List[Dict[str, Any]]] = None,
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self._base_url:
            return self._mock_chat(model_id, messages, functions)

        headers = {"Content-Type": "application/json"}
        if trace_id:
            headers["X-Trace-Id"] = trace_id

        payload: Dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens is not None:
            payload["maxTokens"] = max_tokens
        if functions:
            payload["functions"] = functions

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._base_url}/api/v1/llmgw/chat/completions",
                    json=payload,
                    headers=headers,
                )
                resp.raise_for_status()
                return resp.json()["data"]
        except httpx.HTTPError as exc:
            raise LLMGWUnavailableError(
                f"LLM Gateway 调用失败: {exc}",
                data={"model": model_id},
            ) from exc

    async def stream_chat(
        self,
        model_id: str,
        messages: List[Dict[str, Any]],
        *,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        trace_id: Optional[str] = None,
    ) -> AsyncIterator[Dict[str, Any]]:
        """Stream chat completion tokens from TECH-LLMGW.

        Yields delta chunks with ``{"delta": str, "finish_reason": str|None}``.
        """
        if not self._base_url:
            async for chunk in self._mock_stream(model_id, messages):
                yield chunk
            return

        headers = {"Content-Type": "application/json"}
        if trace_id:
            headers["X-Trace-Id"] = trace_id

        payload: Dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }
        if max_tokens is not None:
            payload["maxTokens"] = max_tokens

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self._base_url}/api/v1/llmgw/chat/completions",
                    json=payload,
                    headers=headers,
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        import json

                        data = json.loads(line[6:])
                        if data.get("choices"):
                            choice = data["choices"][0]
                            yield {
                                "delta": choice.get("delta", {}).get("content", ""),
                                "finish_reason": choice.get("finish_reason"),
                            }
        except httpx.HTTPError as exc:
            raise LLMGWUnavailableError(
                f"LLM Gateway 流式调用失败: {exc}",
                data={"model": model_id},
            ) from exc

    async def embed(
        self,
        model_id: str,
        texts: List[str],
        *,
        trace_id: Optional[str] = None,
    ) -> List[List[float]]:
        """Generate embeddings for a list of texts via TECH-LLMGW."""
        if not self._base_url:
            return self._mock_embed(model_id, texts)

        headers = {"Content-Type": "application/json"}
        if trace_id:
            headers["X-Trace-Id"] = trace_id

        payload = {"model": model_id, "input": texts}

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._base_url}/api/v1/llmgw/embeddings",
                    json=payload,
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()["data"]
                return [item["embedding"] for item in data.get("embeddings", [])]
        except httpx.HTTPError as exc:
            raise LLMGWUnavailableError(
                f"LLM Gateway Embedding 调用失败: {exc}",
                data={"model": model_id},
            ) from exc

    # ----------------------------------------------------------- mock helpers

    def _mock_chat(
        self,
        model_id: str,
        messages: List[Dict[str, Any]],
        functions: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        user_text = ""
        for m in messages:
            if m.get("role") == "user":
                user_text = str(m.get("content", ""))
                break
        seed = f"{model_id}:{user_text}"
        digest = hashlib.sha256(seed.encode()).hexdigest()[:16]

        # When functions are provided, simulate a function_call response.
        if functions:
            fn = functions[0]
            answer = f"已收到任务：{user_text}\n（模拟模式，建议调用工具: {fn['name']}）"
            return {
                "id": f"chat-mock-{digest}",
                "model": model_id,
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": answer,
                            "function_call": {
                                "name": fn["name"],
                                "arguments": '{"input": "' + user_text + '"}',
                            },
                        },
                        "finish_reason": "function_call",
                    }
                ],
                "usage": {
                    "promptTokens": len(user_text),
                    "completionTokens": len(answer),
                },
            }

        answer = (
            f"已收到任务：{user_text}\n"
            f"（当前为模拟模式，未调用真实模型；seed={digest}）"
        )
        return {
            "id": f"chat-mock-{digest}",
            "model": model_id,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": answer},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"promptTokens": len(user_text), "completionTokens": len(answer)},
        }

    async def _mock_stream(
        self,
        model_id: str,
        messages: List[Dict[str, Any]],
    ) -> AsyncIterator[Dict[str, Any]]:
        user_text = ""
        for m in messages:
            if m.get("role") == "user":
                user_text = str(m.get("content", ""))
                break
        answer = f"已收到任务：{user_text}（模拟流式输出）"
        for word in answer.split(" "):
            await asyncio.sleep(0)
            yield {"delta": word + " ", "finish_reason": None}
        yield {"delta": "", "finish_reason": "stop"}

    def _mock_embed(
        self,
        model_id: str,
        texts: List[str],
    ) -> List[List[float]]:
        import random

        results: List[List[float]] = []
        for text in texts:
            seed = int(hashlib.sha256(f"{model_id}:{text}".encode()).hexdigest()[:8], 16)
            rng = random.Random(seed)
            results.append([rng.uniform(-1, 1) for _ in range(8)])
        return results
