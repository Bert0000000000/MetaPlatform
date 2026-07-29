"""Workbench (Dashboard) endpoints (FR-DASH-001..010).

Exposed under /api/v1/dashboard/*. Provides the aggregate home/workbench
surface consumed by @mate/dashboard (port 9230). Self-contained mock store
so the front-end can develop and exercise the full IA without every
upstream service being up. Shapes match
metaplatform-frontend/apps/dashboard/src/api/*.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])

def _now() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


def _iso(dt: datetime | None = None) -> str:
    return (dt or _now()).isoformat()


def _past(days: int = 0, hours: int = 0, minutes: int = 0) -> datetime:
    return _now() - timedelta(days=days, hours=hours, minutes=minutes)


def _future(days: int = 0) -> datetime:
    return _now() + timedelta(days=days)


_NOTIFICATIONS: list[dict[str, Any]] = [
    {"id": "n-1001", "type": "approval",
     "title": "\u65b0\u5ba1\u6279\u5f85\u529e",
     "content": "\u674e\u96f7 \u63d0\u4ea4\u4e86\u300c\u91c7\u8d2d\u7533\u8bf7\u5355 #PR-2026-0731\u300d\u7b49\u5f85\u4f60\u7684\u5ba1\u6279",
     "read": False, "createdAt": _past(minutes=12).isoformat(),
     "link": "/dashboard?tab=approvals"},
    {"id": "n-1002", "type": "task",
     "title": "\u6570\u5b57\u5458\u5de5\u300c\u8d22\u52a1\u5bf9\u8d26\u5458\u300d\u5df2\u751f\u6210\u65e5\u62a5",
     "content": "\u53ef\u5728 Deliverables \u9875\u9762\u67e5\u770b\u8be6\u7ec6\u62a5\u544a\u4e0e\u4e0b\u8f7d",
     "read": False, "createdAt": _past(hours=1, minutes=20).isoformat(),
     "link": "/deliverables"},
    {"id": "n-1003", "type": "system",
     "title": "Ontology \u6a21\u578b v1.4.0 \u5df2\u53d1\u5e03",
     "content": "Concept:Deal \u589e\u52a0 3 \u4e2a\u5c5e\u6027\uff0c\u5efa\u8bae\u5237\u65b0\u6d4f\u89c8\u5668\u67e5\u770b\u6700\u65b0\u6a21\u578b",
     "read": False, "createdAt": _past(hours=4).isoformat(), "link": None},
    {"id": "n-1004", "type": "mention",
     "title": "\u738b\u82b3 \u5728\u300c\u5ba2\u6237\u5408\u540c\u300d\u77e5\u8bc6\u5e93 @ \u4e86\u4f60",
     "content": "\u8bf7\u5ba1\u9605\u5176\u4e2d\u7684\u98ce\u9669\u70b9\u6bb5\u843d",
     "read": True, "createdAt": _past(hours=8).isoformat(),
     "link": "/deliverables"},
    {"id": "n-1005", "type": "alert",
     "title": "\u670d\u52a1 TECH-AGENT \u9519\u8bef\u7387\u7a81\u589e",
     "content": "\u8fd1 5 \u5206\u949f 5xx \u6bd4\u4f8b 4.2%\uff0c\u9608\u503c 1.5%\uff0c\u5df2\u81ea\u52a8\u5f00\u5355",
     "read": True, "createdAt": _past(days=1).isoformat(),
     "link": "/aiops"},
]


def _seed_todos() -> list[dict[str, Any]]:
    return [
        {"id": "t-9001", "name": "\u5ba1\u6279\uff1a\u5408\u540c\u7b7e\u7f72\u7533\u8bf7 #CT-2026-0731-01",
         "assignee": "current", "processInstanceId": "pi-3001",
         "processDefinitionId": "contract-sign",
         "createTime": _past(hours=2).isoformat(), "endTime": None,
         "status": "pending"},
        {"id": "t-9002", "name": "\u5ba1\u6279\uff1a\u5dee\u65c5\u62a5\u9500\u5355 #TR-2607-018",
         "assignee": "current", "processInstanceId": "pi-3002",
         "processDefinitionId": "travel-reimburse",
         "createTime": _past(hours=6).isoformat(), "endTime": None,
         "status": "pending"},
        {"id": "t-9003", "name": "\u5ba1\u6279\uff1a\u5458\u5de5\u8f6c\u5c97\u7533\u8bf7 #HR-2026-0730-007",
         "assignee": "current", "processInstanceId": "pi-3003",
         "processDefinitionId": "hr-transfer",
         "createTime": _past(days=1, hours=2).isoformat(), "endTime": None,
         "status": "pending"},
        {"id": "t-9100", "name": "\u5ba1\u6279\uff1a\u5408\u540c\u7b7e\u7f72\u7533\u8bf7 #CT-2026-0728-09",
         "assignee": "current", "processInstanceId": "pi-3010",
         "processDefinitionId": "contract-sign",
         "createTime": _past(days=2).isoformat(),
         "endTime": _past(days=1, hours=10).isoformat(),
         "status": "approved"},
        {"id": "t-9101", "name": "\u5ba1\u6279\uff1a\u91c7\u8d2d\u7533\u8bf7\u5355 #PR-2026-0725-03",
         "assignee": "current", "processInstanceId": "pi-3011",
         "processDefinitionId": "purchase-request",
         "createTime": _past(days=3).isoformat(),
         "endTime": _past(days=2, hours=12).isoformat(),
         "status": "rejected"},
    ]


_TODOS = _seed_todos()


_WORKERS: list[dict[str, Any]] = [
    {"id": "w-1", "employeeId": "EMP-AI-001",
     "name": "\u8d22\u52a1\u5bf9\u8d26\u5458", "code": "finance-recon",
     "roleCategory": "\u8d22\u52a1", "status": "ACTIVE",
     "runningTasks": 2, "completedToday": 18,
     "lastActiveAt": _past(minutes=4).isoformat()},
    {"id": "w-2", "employeeId": "EMP-AI-002",
     "name": "\u5ba2\u6237\u6863\u6848\u7ba1\u7406\u5458", "code": "crm-archivist",
     "roleCategory": "\u5ba2\u6237\u8fd0\u8425", "status": "ACTIVE",
     "runningTasks": 0, "completedToday": 9,
     "lastActiveAt": _past(minutes=22).isoformat()},
    {"id": "w-3", "employeeId": "EMP-AI-003",
     "name": "\u77e5\u8bc6\u5e93\u6574\u7406\u5458", "code": "kb-curator",
     "roleCategory": "\u77e5\u8bc6", "status": "ACTIVE",
     "runningTasks": 1, "completedToday": 5,
     "lastActiveAt": _past(hours=1).isoformat()},
    {"id": "w-4", "employeeId": "EMP-AI-004",
     "name": "\u5de1\u68c0\u8c03\u5ea6\u5458", "code": "patrol",
     "roleCategory": "\u8fd0\u7ef4", "status": "INACTIVE",
     "runningTasks": 0, "completedToday": 0,
     "lastActiveAt": _past(days=2).isoformat()},
]


_DELIVERABLES: list[dict[str, Any]] = [
    {"id": "d-1", "type": "report",
     "title": "7 \u6708\u7ecf\u8425\u5206\u6790\u6708\u62a5",
     "source": "finance-recon",
     "description": "\u672c\u6708\u8425\u6536\u3001\u5229\u6da6\u3001\u56de\u6b3e\u3001\u5e94\u6536\u8d26\u9f84\u4e0e\u540c\u6bd4\u73af\u6bd4",
     "format": "pdf", "status": "ready", "size": 2_356_120,
     "createdAt": _past(hours=2).isoformat(),
     "createdBy": "\u8d22\u52a1\u5bf9\u8d26\u5458",
     "downloadUrl": "/api/v1/dashboard/deliverables/d-1/download?format=pdf"},
    {"id": "d-2", "type": "task_output",
     "title": "\u5ba2\u6237\u6863\u6848\u6e05\u6d17\u7ed3\u679c\uff08batch-2607\uff09",
     "source": "crm-archivist",
     "description": "\u672c\u6b21\u6e05\u6d17 1,287 \u6761\u5ba2\u6237\u8bb0\u5f55\uff0c\u53bb\u91cd 41 \u6761\u3001\u8865\u5168\u5b57\u6bb5 312 \u6761",
     "format": "json", "status": "ready", "size": 612_400,
     "createdAt": _past(hours=5).isoformat(),
     "createdBy": "\u5ba2\u6237\u6863\u6848\u7ba1\u7406\u5458",
     "downloadUrl": "/api/v1/dashboard/deliverables/d-2/download?format=json"},
    {"id": "d-3", "type": "schedule_summary",
     "title": "\u4eca\u6668\u5b9a\u65f6\u4efb\u52a1\u8fd0\u884c\u6458\u8981",
     "source": "system-scheduler",
     "description": "28 \u4e2a\u5b9a\u65f6\u4efb\u52a1\uff0c27 \u6210\u529f\u3001 1 \u5931\u8d25\uff08KB \u7d22\u5f15\u91cd\u5efa\uff09",
     "format": "markdown", "status": "ready", "size": 18_900,
     "createdAt": _past(hours=7).isoformat(),
     "createdBy": "\u7cfb\u7edf",
     "downloadUrl": "/api/v1/dashboard/deliverables/d-3/download?format=markdown"},
    {"id": "d-4", "type": "analysis",
     "title": "\u5f02\u5e38\u4e8b\u4ef6 RCA \u62a5\u544a\uff08TECH-AGENT\uff09",
     "source": "aiops-analyzer",
     "description": "5xx \u9519\u8bef\u7387\u7a81\u589e\u6839\u56e0 + \u63a8\u8350\u5904\u7f6e\u52a8\u4f5c",
     "format": "markdown", "status": "ready", "size": 9_240,
     "createdAt": _past(hours=10).isoformat(),
     "createdBy": "AI Ops",
     "downloadUrl": "/api/v1/dashboard/deliverables/d-4/download?format=markdown"},
    {"id": "d-5", "type": "report",
     "title": "\u77e5\u8bc6\u5e93\u7d22\u5f15\u91cd\u5efa\u4efb\u52a1\uff08\u751f\u6210\u4e2d\uff09",
     "source": "kb-curator",
     "description": "\u5bf9 3 \u4e2a\u77e5\u8bc6\u5eab\u89e6\u53d1\u5168\u91cf\u91cd\u5efa\uff0c\u5c1a\u672a\u5b8c\u6210",
     "format": "pdf", "status": "generating", "size": 0,
     "createdAt": _past(minutes=35).isoformat(),
     "createdBy": "\u77e5\u8bc6\u5e93\u6574\u7406\u5458"},
]


_ANOMALIES: list[dict[str, Any]] = [
    {"id": "an-1", "ruleId": "r-err-rate", "anomalyType": "ERROR_RATE",
     "severity": "CRITICAL", "serviceName": "TECH-AGENT",
     "traceId": "5f0b7a3c2e1f9a01", "metricValue": 4.2,
     "rootCause": "\u4e0a\u6e38 model gateway \u8d85\u65f6\u5bfc\u81f4 502 \u6fc0\u589e",
     "remediationAction": "\u89e6\u53d1\u7194\u65ad\u964d\u7ea7\u5230\u5907\u7528\u6a21\u578b + \u901a\u77e5\u503c\u73ed",
     "status": "ANALYZING",
     "detectedAt": _past(minutes=14).isoformat(), "resolvedAt": None},
    {"id": "an-2", "ruleId": "r-p99-latency", "anomalyType": "P99_LATENCY",
     "severity": "WARNING", "serviceName": "TECH-RAG",
     "traceId": None, "metricValue": 2.8,
     "rootCause": None, "remediationAction": None,
     "status": "OPEN", "detectedAt": _past(hours=1).isoformat(),
     "resolvedAt": None},
    {"id": "an-3", "ruleId": "r-error-code", "anomalyType": "ERROR_CODE",
     "severity": "INFO", "serviceName": "TECH-OBS",
     "traceId": None, "metricValue": 7,
     "rootCause": "OIDC refresh \u5931\u8d25\uff0c\u91cd\u8bd5\u6210\u529f",
     "remediationAction": None,
     "status": "RESOLVED",
     "detectedAt": _past(hours=6).isoformat(),
     "resolvedAt": _past(hours=5).isoformat()},
]


_ANOMALY_RULES: list[dict[str, Any]] = [
    {"id": "r-err-rate", "name": "\u670d\u52a1 5xx \u9519\u8bef\u7387",
     "metricType": "ERROR_RATE", "conditionOperator": ">",
     "threshold": 1.5, "timeWindowSeconds": 300,
     "aggregationFunction": "avg", "severity": "CRITICAL", "enabled": True},
    {"id": "r-p99-latency", "name": "P99 \u5ef6\u8fdf\u544a\u8b66",
     "metricType": "P99_LATENCY", "conditionOperator": ">",
     "threshold": 2.0, "timeWindowSeconds": 600,
     "aggregationFunction": "p99", "severity": "WARNING", "enabled": True},
    {"id": "r-error-code", "name": "\u7279\u5b9a\u9519\u8bef\u7801\u9891\u6b21",
     "metricType": "ERROR_CODE", "conditionOperator": ">",
     "threshold": 5, "timeWindowSeconds": 600,
     "aggregationFunction": "count", "severity": "INFO", "enabled": True},
]


_SEARCH_INDEX: list[dict[str, Any]] = [
    {"category": "app", "id": "app-001",
     "title": "\u5ba2\u6237\u5408\u540c\u5ba1\u9605 Agent",
     "description": "\u57fa\u4e8e\u5408\u540c\u6a21\u677f\u4e0e\u6cd5\u89c4\uff0c\u81ea\u52a8\u5ba1\u9605\u6761\u6b3e\u98ce\u9669",
     "link": "/apps/detail?id=app-001"},
    {"category": "app", "id": "app-002",
     "title": "\u8d22\u52a1\u6708\u62a5\u751f\u6210\u5668",
     "description": "\u4ece ERP \u62bd\u53d6\u6570\u636e\uff0c\u751f\u6210\u6708\u62a5 PPT + \u6570\u636e\u5305",
     "link": "/apps/detail?id=app-002"},
    {"category": "knowledge", "id": "kb-001",
     "title": "\u5ba2\u6237\u5408\u540c\uff082024-2026\uff09",
     "description": "3,287 \u4efd\u5408\u540c\uff0c\u53ef\u6309\u5ba2\u6237/\u6807\u7684/\u91d1\u989d\u68c0\u7d22",
     "link": "/kb/detail?id=kb-001"},
    {"category": "knowledge", "id": "kb-002",
     "title": "\u4ea7\u54c1\u624b\u518c\uff08Mate Platform\uff09",
     "description": "\u5168\u5e73\u53f0\u4ea7\u54c1\u624b\u518c\u3001API \u6587\u6863\u3001\u8fd0\u7ef4\u624b\u518c",
     "link": "/kb/detail?id=kb-002"},
    {"category": "ontology", "id": "ont-001",
     "title": "Concept:Customer",
     "description": "\u5ba2\u6237\u672c\u4f53\uff1a\u57fa\u672c\u4fe1\u606f / \u8054\u7cfb\u4eba / \u5408\u540c / \u7968\u5238",
     "link": "/ontstudio/ontology/ont-001"},
    {"category": "ontology", "id": "ont-002",
     "title": "Action:ApproveContract",
     "description": "\u5408\u540c\u5ba1\u6279\u52a8\u4f5c\uff1a\u89e6\u53d1 Flowable \u6d41\u7a0b + ABAC \u6821\u9a8c",
     "link": "/ontstudio/ontology/ont-002"},
    {"category": "task", "id": "task-001",
     "title": "\u5ba1\u6279\uff1a\u5408\u540c\u7b7e\u7f72\u7533\u8bf7 #CT-2026-0731-01",
     "description": "\u63d0\u4ea4\u4eba \u674e\u96f7\uff0c\u5f85\u4f60\u5ba1\u6279",
     "link": "/dashboard?tab=approvals"},
    {"category": "task", "id": "task-002",
     "title": "\u5f02\u5e38\uff1aTECH-AGENT \u9519\u8bef\u7387\u7a81\u589e",
     "description": "5xx \u6bd4\u4f8b 4.2%\uff0cAI Ops \u5df2\u5f00\u5355",
     "link": "/aiops"},
]


_API_KEYS: list[dict[str, Any]] = [
    {"apiKeyId": "ak-1", "name": "Read-only integration",
     "keyPrefix": "mp_live_abcd****", "userId": "u-1",
     "scopes": ["read:dashboard", "read:knowledge"],
     "status": "ACTIVE", "expiresAt": _future(days=87).isoformat(),
     "lastUsedAt": _past(hours=2).isoformat(),
     "createdAt": _past(days=30).isoformat()},
    {"apiKeyId": "ak-2", "name": "Legacy ETL token",
     "keyPrefix": "mp_live_legacy**", "userId": "u-1",
     "scopes": ["read:all"], "status": "ACTIVE",
     "expiresAt": _future(days=14).isoformat(),
     "lastUsedAt": _past(days=3).isoformat(),
     "createdAt": _past(days=120).isoformat()},
]


_SESSIONS: list[dict[str, Any]] = [
    {"id": "s-1", "device": "Chrome 128 \u00b7 Windows 11",
     "ip": "10.0.5.21", "location": "\u4e0a\u6d77",
     "lastActiveAt": _now().isoformat(), "current": True},
    {"id": "s-2", "device": "Safari 17 \u00b7 iPhone 15",
     "ip": "10.0.5.21", "location": "\u4e0a\u6d77",
     "lastActiveAt": _past(hours=4).isoformat(), "current": False},
    {"id": "s-3", "device": "Edge 128 \u00b7 Windows 11",
     "ip": "10.0.5.42", "location": "\u529e\u516c\u5ba4 \u00b7 \u5317\u4eac",
     "lastActiveAt": _past(days=2).isoformat(), "current": False},
]


_USER_SETTINGS: dict[str, dict[str, Any]] = {
    "u-1": {
        "userId": "u-1",
        "language": "zh-CN",
        "timezone": "Asia/Shanghai",
        "dateFormat": "YYYY-MM-DD HH:mm:ss",
        "defaultPage": "/dashboard",
        "theme": "dark",
        "layout": ["metrics", "approvals", "workers", "notifications"],
    }
}


_NOTIFICATION_SETTINGS: dict[str, dict[str, Any]] = {
    "u-1": {
        "userId": "u-1",
        "approval": True, "task": True, "system": True, "mention": True,
        "alert": True, "email": False, "push": True,
    }
}


# ============================================================================
# Schemas
# ============================================================================


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)
    tenantId: str | None = None


class UserInfo(BaseModel):
    id: str
    username: str
    email: str
    realName: str
    status: str


class SettingsUpdate(BaseModel):
    userId: str | None = None
    language: str | None = None
    timezone: str | None = None
    dateFormat: str | None = None
    defaultPage: str | None = None
    theme: str | None = None
    layout: list[str] | None = None


class NotificationSettingsUpdate(BaseModel):
    userId: str | None = None
    approval: bool | None = None
    task: bool | None = None
    system: bool | None = None
    mention: bool | None = None
    alert: bool | None = None
    email: bool | None = None
    push: bool | None = None


class ApiKeyCreate(BaseModel):
    tenantId: str | None = "tenant-default"
    name: str
    userId: str | None = None
    scopes: list[str] = Field(default_factory=list)
    expiresAt: str | None = None


class DownloadRequest(BaseModel):
    format: str


class TodoActionRequest(BaseModel):
    action: str
    comment: str | None = None


class AnomalyRuleCreate(BaseModel):
    name: str
    metricType: str
    conditionOperator: str
    threshold: float
    timeWindowSeconds: int
    aggregationFunction: str
    severity: str
    enabled: bool = True


# ============================================================================
# Auth
# ============================================================================


@router.post("/auth/login", summary="Workbench login")
async def dashboard_login(body: LoginRequest) -> Any:
    if not body.username or not body.password:
        raise HTTPException(status_code=400, detail="username and password required")
    real_name = body.username.capitalize()
    user_id = f"u-{secrets.token_hex(3)}"
    return {
        "loginResult": "SUCCESS",
        "userId": user_id,
        "username": body.username,
        "realName": real_name,
        "accessToken": f"mb_at_{secrets.token_urlsafe(24)}",
        "refreshToken": f"mb_rt_{secrets.token_urlsafe(24)}",
        "tokenType": "Bearer",
        "expiresIn": 3600,
        "refreshExpiresIn": 2_592_000,
        "requirePasswordReset": False,
        "mfaRequired": False,
        "user": {
            "id": user_id,
            "username": body.username,
            "email": f"{body.username}@metaplatform.local",
            "realName": real_name,
            "status": "ACTIVE",
        },
    }


# ============================================================================
# Profile
# ============================================================================


@router.get("/profile", summary="Current user profile")
async def get_profile() -> Any:
    return {
        "id": "u-1",
        "username": "admin",
        "email": "admin@metaplatform.local",
        "realName": "\u7ba1\u7406\u5458",
        "tenantId": "tenant-default",
        "roles": [{"roleId": "r-1", "roleCode": "PLATFORM_SUPER_ADMIN",
                    "roleName": "\u8d85\u7ea7\u7ba1\u7406\u5458", "dataScope": "ALL"}],
        "departments": [
            {"departmentId": "d-1", "departmentCode": "platform",
             "departmentName": "\u5e73\u53f0\u7ec4", "isPrimary": True},
        ],
        "permissions": [
            {"permissionCode": "*", "permissionName": "\u5168\u90e8\u6743\u9650",
             "resourceType": "*"},
        ],
    }


@router.get("/profile/permissions", summary="Aggregated permissions")
async def get_profile_permissions() -> Any:
    return {
        "userId": "u-1",
        "tenantId": "tenant-default",
        "permissionCodes": ["*"],
        "permissions": [
            {"permissionId": "p-1", "permissionCode": "*",
             "permissionName": "\u5168\u90e8\u6743\u9650", "resourceType": "*",
             "actions": ["*"], "effect": "ALLOW"},
        ],
        "roles": [
            {"roleId": "r-1", "roleCode": "PLATFORM_SUPER_ADMIN",
             "roleName": "\u8d85\u7ea7\u7ba1\u7406\u5458", "dataScope": "ALL"},
        ],
    }


# ============================================================================
# Settings + sessions + api-keys
# ============================================================================


_DEFAULT_SETTINGS: dict[str, Any] = {
    "language": "zh-CN",
    "timezone": "Asia/Shanghai",
    "dateFormat": "YYYY-MM-DD HH:mm:ss",
    "defaultPage": "/dashboard",
    "theme": "dark",
    "layout": ["metrics", "approvals", "workers", "notifications"],
}


@router.get("/settings", summary="User preferences")
async def get_settings(userId: str | None = Query(default=None)) -> Any:
    uid = userId or "u-1"
    return _USER_SETTINGS.get(uid, {"userId": uid, **_DEFAULT_SETTINGS})


@router.put("/settings", summary="Update user preferences")
async def update_settings(payload: SettingsUpdate) -> Any:
    uid = payload.userId or "u-1"
    cur = _USER_SETTINGS.setdefault(uid, {"userId": uid, **_DEFAULT_SETTINGS})
    data = payload.model_dump(exclude_unset=True, exclude={"userId"})
    cur.update({k: v for k, v in data.items() if v is not None})
    return cur


@router.get("/sessions", summary="Active sessions")
async def get_sessions(userId: str | None = Query(default=None)) -> Any:
    return list(_SESSIONS)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(session_id: str) -> None:
    global _SESSIONS
    _SESSIONS = [s for s in _SESSIONS if s["id"] != session_id]
    return None


@router.get("/api-keys", summary="List API keys")
async def list_api_keys(tenantId: str | None = Query(default=None),
                        page: int = 0, size: int = 100) -> Any:
    items = list(_API_KEYS)
    return {"items": items, "total": len(items), "page": page,
            "pageSize": size, "totalPages": 1}


@router.post("/api-keys", summary="Create API key")
async def create_api_key(payload: ApiKeyCreate) -> Any:
    key_id = f"ak-{secrets.token_hex(3)}"
    raw = f"mp_live_{secrets.token_urlsafe(20)}"
    record = {
        "apiKeyId": key_id,
        "name": payload.name,
        "keyPrefix": f"{raw[:14]}****",
        "userId": payload.userId or "u-1",
        "scopes": payload.scopes,
        "status": "ACTIVE",
        "expiresAt": payload.expiresAt,
        "createdAt": _iso(),
    }
    _API_KEYS.append(record)
    return {**record, "apiKey": raw}


@router.delete("/api-keys/{api_key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(api_key_id: str) -> None:
    global _API_KEYS
    _API_KEYS = [k for k in _API_KEYS if k["apiKeyId"] != api_key_id]
    return None


# ============================================================================
# Notifications
# ============================================================================


@router.get("/notifications", summary="List notifications")
async def list_notifications(userId: str | None = Query(default=None),
                              status: str = "all",
                              limit: int = 50, offset: int = 0) -> Any:
    items = list(_NOTIFICATIONS)
    if status == "unread":
        items = [n for n in items if not n["read"]]
    elif status == "read":
        items = [n for n in items if n["read"]]
    return items[offset:offset + limit]


@router.get("/notifications/unread-count", summary="Unread count")
async def unread_count(userId: str | None = Query(default=None)) -> Any:
    return sum(1 for n in _NOTIFICATIONS if not n["read"])


@router.put("/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(notification_id: str) -> None:
    for n in _NOTIFICATIONS:
        if n["id"] == notification_id:
            n["read"] = True
            break
    return None


@router.post("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(userId: str | None = Query(default=None)) -> None:
    for n in _NOTIFICATIONS:
        n["read"] = True
    return None


@router.get("/notifications/settings", summary="Notification preferences")
async def get_notification_settings(userId: str | None = Query(default=None)) -> Any:
    uid = userId or "u-1"
    return _NOTIFICATION_SETTINGS.get(uid, {"userId": uid,
        "approval": True, "task": True, "system": True, "mention": True,
        "alert": True, "email": False, "push": True})


@router.put("/notifications/settings", summary="Update notification preferences")
async def update_notification_settings(payload: NotificationSettingsUpdate) -> Any:
    uid = payload.userId or "u-1"
    cur = _NOTIFICATION_SETTINGS.setdefault(uid, {
        "userId": uid, "approval": True, "task": True, "system": True,
        "mention": True, "alert": True, "email": False, "push": True})
    data = payload.model_dump(exclude_unset=True, exclude={"userId"})
    cur.update({k: v for k, v in data.items() if v is not None})
    return cur


# ============================================================================
# Metrics
# ============================================================================


@router.get("/metrics", summary="Metric cards")
async def metric_cards() -> Any:
    return [
        {"key": "active_users", "label": "\u4eca\u65e5\u6d3b\u8dc3\u7528\u6237",
         "value": 287, "unit": "\u4eba", "trend": 12.4, "trendUp": True,
         "icon": "users"},
        {"key": "api_calls", "label": "\u4eca\u65e5 API \u8c03\u7528",
         "value": 142350, "unit": "\u6b21", "trend": 8.1, "trendUp": True,
         "icon": "activity"},
        {"key": "errors", "label": "\u4eca\u65e5\u5f02\u5e38",
         "value": 17, "unit": "\u6b21", "trend": -23.5, "trendUp": False,
         "icon": "alert"},
        {"key": "tasks", "label": "\u5728\u9014\u4efb\u52a1",
         "value": 56, "unit": "\u4e2a", "trend": 3.2, "trendUp": True,
         "icon": "tasks"},
    ]


@router.get("/metrics/trend", summary="Metric trend")
async def metric_trend(range_: str = Query(default="24h", alias="range")) -> Any:
    points = 24 if range_ == "24h" else (168 if range_ == "7d" else 30)
    step_h = 1 if range_ in ("1h", "24h") else (4 if range_ == "7d" else 24)
    series = []
    for i in range(points):
        t = _now() - timedelta(hours=step_h * (points - i - 1))
        api_calls = 1800 + (i * 35) + (i % 5) * 80
        errors = max(0, int(api_calls * 0.004 + ((i * 7) % 11)))
        series.append({
            "time": t.isoformat(),
            "value": api_calls,
            "apiCalls": api_calls,
            "errors": errors,
        })
    return series


# ============================================================================
# Todos / Approvals
# ============================================================================


def _map_todo(item: dict[str, Any]) -> dict[str, Any]:
    status_norm = ("pending" if item["status"] == "pending"
                   else ("completed" if item["status"] == "approved"
                         else "rejected"))
    return {
        "taskId": item["id"],
        "title": item["name"],
        "applicant": item["assignee"],
        "applicantId": item["assignee"],
        "flowName": item.get("processDefinitionId", "\u9ed8\u8ba4\u6d41\u7a0b"),
        "status": status_norm,
        "priority": "medium",
        "createdAt": item["createTime"],
        "completedAt": item.get("endTime"),
    }


@router.get("/todos", summary="Pending tasks")
async def list_todos(userId: str | None = Query(default=None),
                     page: int = 1, size: int = 20) -> Any:
    pending = [_map_todo(t) for t in _TODOS if t["status"] == "pending"]
    return {"items": pending, "total": len(pending), "page": page,
            "pageSize": size, "totalPages": 1}


@router.get("/todos/done", summary="Done tasks")
async def list_done_todos(userId: str | None = Query(default=None),
                          page: int = 1, size: int = 20) -> Any:
    done = [_map_todo(t) for t in _TODOS if t["status"] != "pending"]
    return {"items": done, "total": len(done), "page": page,
            "pageSize": size, "totalPages": 1}


@router.post("/todos/{task_id}/action", summary="Approve / reject")
async def act_todo(task_id: str, body: TodoActionRequest) -> Any:
    for t in _TODOS:
        if t["id"] == task_id:
            t["endTime"] = _iso()
            t["status"] = ("approved" if body.action in ("approve", "complete")
                           else "rejected")
            return {"ok": True, "taskId": task_id, "status": t["status"]}
    raise HTTPException(status_code=404, detail="task not found")


# ============================================================================
# Digital workers
# ============================================================================


@router.get("/workers", summary="Digital workers")
async def list_workers() -> Any:
    return [
        {"id": w["employeeId"], "employeeId": w["employeeId"],
         "name": w["name"], "code": w["code"],
         "roleCategory": w["roleCategory"], "status": w["status"],
         "runningTasks": w["runningTasks"],
         "completedToday": w["completedToday"],
         "lastActiveAt": w["lastActiveAt"]} for w in _WORKERS
    ]


# ============================================================================
# Deliverables
# ============================================================================


@router.get("/deliverables", summary="Deliverables")
async def list_deliverables(
    type: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = 0, size: int = 20,
    keyword: str | None = None,
) -> Any:
    items = list(_DELIVERABLES)
    if type:
        items = [d for d in items if d["type"] == type]
    if status_filter:
        items = [d for d in items if d["status"] == status_filter]
    if keyword:
        kw = keyword.lower()
        items = [d for d in items if kw in d["title"].lower()
                 or kw in d["description"].lower()]
    return {"items": items, "total": len(items), "page": page,
            "pageSize": size, "totalPages": 1}


@router.post("/deliverables/{deliverable_id}/download")
async def download_deliverable(deliverable_id: str,
                                body: DownloadRequest | None = None) -> Any:
    for d in _DELIVERABLES:
        if d["id"] == deliverable_id:
            fmt = (body.format if body else d["format"])
            return {
                "downloadUrl": f"/api/v1/dashboard/deliverables/{deliverable_id}/file.{fmt}",
                "message": f"\u5df2\u751f\u6210 {fmt.upper()} \u683c\u5f0f\u4e0b\u8f7d\u94fe\u63a5\uff0c5 \u5206\u949f\u5185\u6709\u6548",
            }
    raise HTTPException(status_code=404, detail="deliverable not found")


@router.delete("/deliverables/{deliverable_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deliverable(deliverable_id: str) -> None:
    global _DELIVERABLES
    _DELIVERABLES = [d for d in _DELIVERABLES if d["id"] != deliverable_id]
    return None


# ============================================================================
# Anomalies / AIOps
# ============================================================================


@router.get("/anomalies", summary="Anomaly events")
async def list_anomalies(status: str | None = Query(default=None)) -> Any:
    items = list(_ANOMALIES)
    if status:
        items = [a for a in items if a["status"] == status.upper()]
    return items


@router.get("/anomalies/{anomaly_id}", summary="Anomaly detail")
async def get_anomaly(anomaly_id: str) -> Any:
    for a in _ANOMALIES:
        if a["id"] == anomaly_id:
            return a
    raise HTTPException(status_code=404, detail="anomaly not found")


@router.post("/anomalies/{anomaly_id}/analyze", summary="RCA")
async def analyze_anomaly(anomaly_id: str) -> Any:
    for a in _ANOMALIES:
        if a["id"] == anomaly_id:
            return {
                "conclusion": (
                    f"{a['serviceName']} {a['anomalyType']} \u7a81\u589e\u81f3 "
                    f"{a['metricValue']}\uff0c\u521d\u6b65\u5224\u65ad\u4e3a\u4e0a\u6e38\u4f9d\u8d56\u8d85\u65f6"
                ),
                "suggestedAction": "\u5f00\u542f\u7194\u65ad\u964d\u7ea7 + \u901a\u77e5\u503c\u73ed + \u6682\u65f6\u8df3\u8fc7\u975e\u5173\u952e\u8c03\u7528",
                "relatedLogs": [
                    {"timestamp": _past(minutes=10).isoformat(),
                     "serviceName": a["serviceName"], "level": "ERROR",
                     "traceId": a.get("traceId") or "n/a",
                     "message": "Upstream timeout after 30s"},
                    {"timestamp": _past(minutes=8).isoformat(),
                     "serviceName": a["serviceName"], "level": "ERROR",
                     "traceId": a.get("traceId") or "n/a",
                     "message": "circuit breaker opened"},
                ],
                "relatedMetrics": {"error_rate": 4.2, "p99_latency": 2.8,
                                   "active_connections": 312},
            }
    raise HTTPException(status_code=404, detail="anomaly not found")


@router.post("/anomalies/{anomaly_id}/remediate", summary="Trigger remediation")
async def remediate_anomaly(anomaly_id: str,
                             body: dict[str, Any] | None = None) -> Any:
    body = body or {}
    mode = body.get("mode", "ADVISE")
    return {
        "executed": mode == "AUTO",
        "actionCode": body.get("actionCode") or "auto-circuit-breaker",
        "actionName": "\u5f00\u542f\u7194\u65ad\u964d\u7ea7",
        "message": ("\u5df2\u4e0b\u53d1\u5904\u7f6e\u52a8\u4f5c" if mode == "AUTO"
                    else "\u5df2\u7ed9\u51fa\u5efa\u8bae\u52a8\u4f5c\uff0c\u9700\u4eba\u5de5\u786e\u8ba4"),
        "executionId": f"exec-{secrets.token_hex(4)}",
    }


@router.get("/anomaly-rules", summary="Anomaly detection rules")
async def list_anomaly_rules() -> Any:
    return list(_ANOMALY_RULES)


@router.post("/anomaly-rules", summary="Create rule")
async def create_anomaly_rule(payload: AnomalyRuleCreate) -> Any:
    rec = {"id": f"r-{uuid.uuid4().hex[:6]}", **payload.model_dump()}
    _ANOMALY_RULES.append(rec)
    return rec


@router.put("/anomaly-rules/{rule_id}", summary="Update rule")
async def update_anomaly_rule(rule_id: str, payload: AnomalyRuleCreate) -> Any:
    for i, r in enumerate(_ANOMALY_RULES):
        if r["id"] == rule_id:
            _ANOMALY_RULES[i] = {"id": rule_id, **payload.model_dump()}
            return _ANOMALY_RULES[i]
    raise HTTPException(status_code=404, detail="rule not found")


@router.delete("/anomaly-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_anomaly_rule(rule_id: str) -> None:
    global _ANOMALY_RULES
    _ANOMALY_RULES = [r for r in _ANOMALY_RULES if r["id"] != rule_id]
    return None


# ============================================================================
# Global search
# ============================================================================


@router.get("/search", summary="Global search")
async def global_search(keyword: str | None = Query(default=None)) -> Any:
    if not keyword:
        return []
    kw = keyword.lower()
    return [s for s in _SEARCH_INDEX
            if kw in s["title"].lower() or kw in s["description"].lower()]

