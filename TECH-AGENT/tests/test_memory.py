"""Memory service tests (P2-AGT-08)."""

from __future__ import annotations

from app.memory.schemas import MessageRole

TENANT = "tenant-test"


class TestMemoryService:
    async def test_create_session(self, registry):
        service = registry.memory_service
        session = await service.create_session(TENANT, "agt-001", "Test Session")
        assert session.session_id.startswith("sess-")
        assert session.agent_id == "agt-001"
        assert session.title == "Test Session"

    async def test_add_and_get_messages(self, registry):
        service = registry.memory_service
        session = await service.create_session(TENANT, "agt-001")
        await service.add_message(
            TENANT, session.session_id, "agt-001", MessageRole.USER, "Hello"
        )
        await service.add_message(
            TENANT,
            session.session_id,
            "agt-001",
            MessageRole.ASSISTANT,
            "Hi there",
        )

        context = await service.get_context(TENANT, session.session_id, max_messages=10)
        assert len(context) == 2
        assert context[0].role == MessageRole.USER
        assert context[0].content == "Hello"
        assert context[1].role == MessageRole.ASSISTANT

    async def test_get_context_with_limit(self, registry):
        service = registry.memory_service
        session = await service.create_session(TENANT, "agt-001")
        for i in range(5):
            await service.add_message(
                TENANT, session.session_id, "agt-001", MessageRole.USER, f"msg-{i}"
            )

        context = await service.get_context(TENANT, session.session_id, max_messages=3)
        assert len(context) == 3
        assert context[0].content == "msg-2"
        assert context[2].content == "msg-4"

    async def test_clear_session(self, registry):
        service = registry.memory_service
        session = await service.create_session(TENANT, "agt-001")
        await service.add_message(
            TENANT, session.session_id, "agt-001", MessageRole.USER, "Hello"
        )

        ok = await service.clear_session(TENANT, session.session_id)
        assert ok is True

        context = await service.get_context(TENANT, session.session_id)
        assert len(context) == 0

    async def test_list_sessions(self, registry):
        service = registry.memory_service
        await service.create_session(TENANT, "agt-001", "Session 1")
        await service.create_session(TENANT, "agt-001", "Session 2")
        await service.create_session(TENANT, "agt-002", "Session 3")

        sessions = await service.list_sessions(TENANT, "agt-001")
        assert len(sessions) == 2
        assert all(s.agent_id == "agt-001" for s in sessions)

    async def test_add_message_to_nonexistent_session(self, registry):
        service = registry.memory_service
        from app.common.errors import InvalidParamError
        import pytest

        with pytest.raises(InvalidParamError):
            await service.add_message(
                TENANT, "sess-nonexistent", "agt-001", MessageRole.USER, "Hello"
            )
