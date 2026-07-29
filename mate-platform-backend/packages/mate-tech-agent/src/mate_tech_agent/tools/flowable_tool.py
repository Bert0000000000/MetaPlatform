"""Flowable HTTP client (TC-5.7.8 S4 BPMN).

Real endpoints (Flowable 6/7/8 REST API):
- POST /flowable-rest/service/repository/deployments       (deploy BPMN)
- POST /flowable-rest/service/runtime/process-instances     (start process)
- GET  /flowable-rest/service/runtime/process-instances/{id} (status)

Env: FLOWABLE_URL (default http://localhost:8080).
Falls back to InMemory (returns mock) when server unavailable.
"""
from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from typing import Any, Protocol

import httpx

_log = logging.getLogger(__name__)


class FlowableTool(Protocol):
    def deploy_bpmn(self, process_key: str, bpmn_xml: str, name: str = "") -> dict[str, Any]: ...
    def start_process(self, process_key: str, variables: dict[str, Any] | None = None) -> dict[str, Any]: ...
    def get_process_state(self, instance_id: str) -> dict[str, Any]: ...
    def list_process_definitions(self) -> list[dict[str, Any]]: ...


class InMemoryFlowableTool:
    def __init__(self) -> None:
        self._deployments: dict[str, dict[str, Any]] = {}
        self._instances: dict[str, dict[str, Any]] = {}
        self._defs: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()

    def deploy_bpmn(self, process_key, bpmn_xml, name=""):
        dep_id = str(uuid.uuid4())
        with self._lock:
            self._deployments[dep_id] = {
                "id": dep_id,
                "name": name or process_key,
                "process_key": process_key,
                "deployed_at": time.time(),
            }
            self._defs[process_key] = self._deployments[dep_id]
        return self._deployments[dep_id]

    def start_process(self, process_key, variables=None):
        with self._lock:
            if process_key not in self._defs:
                return {"id": "", "error": f"process {process_key} not deployed"}
            inst_id = str(uuid.uuid4())
            self._instances[inst_id] = {
                "id": inst_id,
                "process_key": process_key,
                "variables": variables or {},
                "status": "running",
                "started_at": time.time(),
                "result": "",
            }
        return self._instances[inst_id]

    def get_process_state(self, instance_id):
        with self._lock:
            inst = self._instances.get(instance_id)
        if not inst:
            return {"id": instance_id, "status": "not_found"}
        elapsed = time.time() - inst["started_at"]
        if elapsed > 0.5:
            inst["status"] = "completed"
            inst["result"] = f"Process {inst['process_key']} completed (simulated)"
        return inst

    def list_process_definitions(self):
        with self._lock:
            return list(self._defs.values())


class HttpxFlowableTool:
    DEFAULT_URL = "http://localhost:8080"
    REST_PREFIX = "/flowable-rest/service"

    def __init__(self, base_url=None, timeout=30.0):
        self._base_url = (base_url or os.environ.get("FLOWABLE_URL", self.DEFAULT_URL)).rstrip("/")
        self._client = httpx.Client(timeout=timeout, auth=("admin", "test"))
        self._available = False
        self._fallback = InMemoryFlowableTool()
        self._check()

    def _check(self):
        try:
            r = self._client.get(f"{self._base_url}{self.REST_PREFIX}/management/engine", timeout=5.0)
            self._available = r.status_code == 200
            if self._available:
                _log.info("Flowable ACTIVE at %s", self._base_url)
            else:
                _log.info("Flowable responded %d, using InMemory fallback", r.status_code)
        except Exception as exc:
            _log.info("Flowable unavailable at %s: %s (using InMemory fallback)", self._base_url, exc)

    def deploy_bpmn(self, process_key, bpmn_xml, name=""):
        if not self._available:
            return self._fallback.deploy_bpmn(process_key, bpmn_xml, name)
        try:
            files = {"file": ("process.bpmn20.xml", bpmn_xml.encode("utf-8"), "application/xml")}
            r = self._client.post(
                f"{self._base_url}{self.REST_PREFIX}/repository/deployments",
                files=files,
                params={"name": name or process_key},
            )
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            _log.warning("Flowable deploy failed: %s (using fallback)", exc)
            return self._fallback.deploy_bpmn(process_key, bpmn_xml, name)

    def start_process(self, process_key, variables=None):
        if not self._available:
            return self._fallback.start_process(process_key, variables)
        try:
            r = self._client.post(
                f"{self._base_url}{self.REST_PREFIX}/runtime/process-instances",
                json={"processDefinitionKey": process_key, "variables": variables or {}},
            )
            r.raise_for_status()
            return r.json()
        except Exception:
            return self._fallback.start_process(process_key, variables)

    def get_process_state(self, instance_id):
        if not self._available:
            return self._fallback.get_process_state(instance_id)
        try:
            r = self._client.get(
                f"{self._base_url}{self.REST_PREFIX}/runtime/process-instances/{instance_id}"
            )
            if r.status_code == 200:
                data = r.json()
                data["status"] = "running" if not data.get("ended") else "completed"
                return data
            return {"id": instance_id, "status": "not_found"}
        except Exception:
            return self._fallback.get_process_state(instance_id)

    def list_process_definitions(self):
        if not self._available:
            return self._fallback.list_process_definitions()
        try:
            r = self._client.get(f"{self._base_url}{self.REST_PREFIX}/repository/process-definitions")
            r.raise_for_status()
            return r.json().get("data", [])
        except Exception:
            return self._fallback.list_process_definitions()

    def close(self):
        self._client.close()


_tool: FlowableTool | None = None


def get_flowable_tool():
    global _tool
    if _tool is None:
        _tool = HttpxFlowableTool()
    return _tool


def set_flowable_tool(tool):
    global _tool
    _tool = tool
