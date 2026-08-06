"""Session Sandbox (SESSION-01) 测试。"""

from __future__ import annotations

import time

import pytest

from mate_kernel.sandbox.session import (
    CrossSessionAccessError,
    SessionExpired,
    SessionLimits,
    SessionPhase,
    SessionSandbox,
)


def _sb() -> SessionSandbox:
    return SessionSandbox()


class TestLifecycle:
    def test_create_session(self) -> None:
        sb = _sb()
        s, tok = sb.create("alice", plan_steps=("step1", "step2"))
        assert s.user_id == "alice"
        assert s.phase == SessionPhase.PLANNING
        assert tok.session_id == s.session_id

    def test_advance_state_machine(self) -> None:
        sb = _sb()
        s, _ = sb.create("alice")
        s = sb.advance("alice", s.session_id)
        assert s.phase == SessionPhase.AWAITING_USER
        assert s.hitl_paused is True
        s = sb.advance("alice", s.session_id)
        assert s.phase == SessionPhase.RUNNING
        s = sb.advance("alice", s.session_id)
        assert s.phase == SessionPhase.COMPLETED

    def test_advance_from_terminal_raises(self) -> None:
        sb = _sb()
        s, _ = sb.create("alice")
        sb.advance("alice", s.session_id)
        sb.advance("alice", s.session_id)
        sb.advance("alice", s.session_id)
        with pytest.raises(ValueError, match="cannot advance"):
            sb.advance("alice", s.session_id)

    def test_abort(self) -> None:
        sb = _sb()
        s, _ = sb.create("alice")
        s = sb.abort("alice", s.session_id)
        assert s.phase == SessionPhase.ABORTED


class TestIsolation:
    def test_different_users_isolated(self) -> None:
        sb = _sb()
        s_alice, _ = sb.create("alice")
        s_bob, _ = sb.create("bob")
        sb.set_var("alice", s_alice.session_id, "secret", "alice-pwd")
        # alice 看不到 bob session
        with pytest.raises(KeyError):
            sb.get("alice", s_bob.session_id)
        # bob 看不到 alice 的 secret
        sb.set_var("bob", s_bob.session_id, "x", "y")
        assert sb._sessions[("alice", s_alice.session_id)].variables["secret"] == "alice-pwd"
        assert sb._sessions[("bob", s_bob.session_id)].variables.get("secret") is None
        assert sb._sessions[("bob", s_bob.session_id)].variables["x"] == "y"


class TestToken:
    def test_token_validates(self) -> None:
        sb = _sb()
        s, tok = sb.create("alice")
        s = sb.get("alice", s.session_id, tok)
        assert s.user_id == "alice"

    def test_token_user_mismatch_forbidden(self) -> None:
        sb = _sb()
        s, tok = sb.create("alice")
        with pytest.raises(CrossSessionAccessError, match="token does not match"):
            sb.get("bob", s.session_id, tok)

    def test_expired_token_raises(self) -> None:
        sb = _sb()
        s, _ = sb.create(
            "alice",
            limits=SessionLimits(ttl_seconds=1, max_ttl_seconds=2),
        )
        # 构造过期 token
        from mate_kernel.sandbox.session import SessionToken
        expired = SessionToken(
            token="x",
            session_id=s.session_id,
            user_id="alice",
            expires_at=time.time() - 10,
            scopes=(),
        )
        with pytest.raises(SessionExpired, match="token expired"):
            sb.get("alice", s.session_id, expired)


class TestLimits:
    def test_default_30min(self) -> None:
        assert SessionLimits().ttl_seconds == 30 * 60

    def test_max_24h(self) -> None:
        assert SessionLimits().max_ttl_seconds == 24 * 60 * 60

    def test_exceeds_max_rejected(self) -> None:
        sb = _sb()
        with pytest.raises(ValueError, match="exceeds max"):
            sb.create("alice", limits=SessionLimits(ttl_seconds=25 * 3600))


class TestExpirationAndEviction:
    def test_session_expired(self) -> None:
        sb = _sb()
        s, _ = sb.create("alice", limits=SessionLimits(ttl_seconds=1, max_ttl_seconds=2))
        time.sleep(1.1)
        with pytest.raises(SessionExpired, match="expired"):
            sb.get("alice", s.session_id)

    def test_evict_expired(self) -> None:
        sb = _sb()
        s1, _ = sb.create("alice", limits=SessionLimits(ttl_seconds=1, max_ttl_seconds=2))
        s2, _ = sb.create("bob", limits=SessionLimits(ttl_seconds=100, max_ttl_seconds=200))
        time.sleep(1.1)
        n = sb.evict_expired()
        assert n == 1
        assert ("alice", s1.session_id) not in sb._sessions
        assert ("bob", s2.session_id) in sb._sessions


class TestHITL:
    def test_hitl_required_by_default(self) -> None:
        sb = _sb()
        s, _ = sb.create("alice")
        assert s.hitl_required is True
        assert s.hitl_paused is False

    def test_hitl_pauses_at_awaiting_user(self) -> None:
        sb = _sb()
        s, _ = sb.create("alice")
        sb.advance("alice", s.session_id)  # → awaiting_user
        assert sb.get("alice", s.session_id).hitl_paused is True