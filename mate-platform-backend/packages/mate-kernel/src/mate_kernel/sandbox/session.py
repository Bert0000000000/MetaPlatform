"""Session Sandbox —— SESSION-01 Batch（ADR-0041）。

用户级会话沙箱：每用户每会话独占状态空间，多用户互不污染。
KERNEL-01 + SANDBOX-01 之上更高一层的"业务沙箱"，与 Function Sandbox 配合。

7 硬规则：
1. 状态按 user_id + session_id 双重 key 隔离（无 cross-pollution）
2. 默认 30 min TTL；可配置最长 24 h
3. Opt-in 持久化（默认 discard）
4. 至少 1 个 HITL pause（plan state machine）
5. Plan 状态机：planning → awaiting_user → running → completed/aborted
6. 同步执行（短期 token），不进入异步队列
7. Token 短效 + scope 仅限该 session
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class SessionPhase(str, Enum):
    PLANNING = "planning"
    AWAITING_USER = "awaiting_user"
    RUNNING = "running"
    COMPLETED = "completed"
    ABORTED = "aborted"


@dataclass(frozen=True, slots=True)
class SessionLimits:
    ttl_seconds: int = 30 * 60  # 30 min default
    max_ttl_seconds: int = 24 * 60 * 60  # 24h hard cap
    opt_in_persist: bool = False
    retention_seconds: int = 0  # 0 = discard


@dataclass(frozen=True, slots=True)
class SessionToken:
    token: str
    session_id: str
    user_id: str
    expires_at: float  # unix epoch seconds
    scopes: tuple[str, ...]


class SessionExpired(RuntimeError):
    pass


class CrossSessionAccessError(PermissionError):
    pass


@dataclass
class SessionState:
    """Per-session in-memory state（不持久化除非 opt_in_persist=True）。"""

    session_id: str
    user_id: str
    phase: SessionPhase = SessionPhase.PLANNING
    plan_steps: tuple[str, ...] = ()
    hitl_required: bool = True  # 至少 1 个 HITL（硬规则 #4）
    hitl_paused: bool = False
    variables: dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    last_active_at: float = field(default_factory=time.time)
    limits: SessionLimits = field(default_factory=SessionLimits)

    def touch(self) -> None:
        self.last_active_at = time.time()

    def is_expired(self, now: float | None = None) -> bool:
        now = now or time.time()
        return now - self.created_at > self.limits.ttl_seconds


class SessionSandbox:
    """Session 容器 —— 持有 (user_id, session_id) → SessionState 映射。"""

    def __init__(self) -> None:
        self._sessions: dict[tuple[str, str], SessionState] = {}

    def create(
        self,
        user_id: str,
        limits: SessionLimits | None = None,
        plan_steps: tuple[str, ...] = (),
    ) -> tuple[SessionState, SessionToken]:
        sid = uuid.uuid4().hex
        limits = limits or SessionLimits()
        if limits.ttl_seconds > limits.max_ttl_seconds:
            raise ValueError(
                f"ttl_seconds {limits.ttl_seconds} exceeds max {limits.max_ttl_seconds}"
            )
        s = SessionState(
            session_id=sid,
            user_id=user_id,
            plan_steps=plan_steps,
            limits=limits,
        )
        self._sessions[(user_id, sid)] = s
        token = SessionToken(
            token=uuid.uuid4().hex,
            session_id=sid,
            user_id=user_id,
            expires_at=s.created_at + limits.ttl_seconds,
            scopes=("session.read", "session.write"),
        )
        return s, token

    def get(self, user_id: str, session_id: str, token: SessionToken | None = None) -> SessionState:
        if token is not None:
            if token.session_id != session_id or token.user_id != user_id:
                raise CrossSessionAccessError("token does not match session")
            if token.expires_at < time.time():
                raise SessionExpired("token expired")
        s = self._sessions.get((user_id, session_id))
        if s is None:
            raise KeyError(f"session not found: {user_id}/{session_id}")
        if s.is_expired():
            raise SessionExpired(f"session {session_id} expired")
        return s

    def advance(self, user_id: str, session_id: str, token: SessionToken | None = None) -> SessionState:
        s = self.get(user_id, session_id, token)
        if s.phase == SessionPhase.PLANNING:
            object.__setattr__(s, "phase", SessionPhase.AWAITING_USER)
            object.__setattr__(s, "hitl_paused", True)
        elif s.phase == SessionPhase.AWAITING_USER:
            object.__setattr__(s, "phase", SessionPhase.RUNNING)
            object.__setattr__(s, "hitl_paused", False)
        elif s.phase == SessionPhase.RUNNING:
            object.__setattr__(s, "phase", SessionPhase.COMPLETED)
        else:
            raise ValueError(f"cannot advance from {s.phase}")
        s.touch()
        return s

    def abort(self, user_id: str, session_id: str, token: SessionToken | None = None) -> SessionState:
        s = self.get(user_id, session_id, token)
        object.__setattr__(s, "phase", SessionPhase.ABORTED)
        s.touch()
        return s

    def set_var(self, user_id: str, session_id: str, key: str, value: Any) -> None:
        s = self.get(user_id, session_id)
        s.variables[key] = value
        s.touch()

    def evict_expired(self, now: float | None = None) -> int:
        now = now or time.time()
        n = 0
        for k in list(self._sessions):
            if self._sessions[k].is_expired(now):
                del self._sessions[k]
                n += 1
        return n