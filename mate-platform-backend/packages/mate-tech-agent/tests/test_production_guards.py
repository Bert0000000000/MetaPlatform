"""Production profile must fail closed instead of returning synthetic AI output."""
from __future__ import annotations

import pytest

from mate_tech_agent.llm import get_llm, synthesize_answer


def test_production_rejects_echo_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")
    monkeypatch.setenv("LLM_PROVIDER", "echo")

    with pytest.raises(RuntimeError, match="synthetic LLM provider"):
        get_llm()


@pytest.mark.parametrize("profile", ["production", "staging"])
def test_deployed_profiles_reject_unknown_llm_provider(
    monkeypatch: pytest.MonkeyPatch, profile: str,
) -> None:
    monkeypatch.setenv("MATE_PROFILE", profile)
    monkeypatch.setenv("LLM_PROVIDER", "  typo-provider  ")

    with pytest.raises(RuntimeError, match="unsupported LLM provider"):
        get_llm()


def test_production_rejects_extract_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")

    class BrokenLLM:
        def invoke(self, prompt: str) -> str:
            raise RuntimeError("provider unavailable")

    with pytest.raises(RuntimeError, match="LLM provider unavailable"):
        synthesize_answer(BrokenLLM(), "what happened", [{"text": "context"}])


def test_production_rejects_in_memory_agent_state(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")
    monkeypatch.setenv("LEGACY_LOGIN_COMPAT", "1")

    with pytest.raises(RuntimeError, match="in-memory agent state"):
        from mate_tech_agent.api.app import create_app

        create_app()


def test_production_rejects_unavailable_flowable_tool(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from mate_tech_agent.tools.flowable_tool import HttpxFlowableTool

    monkeypatch.setenv("MATE_PROFILE", "production")
    tool = None
    try:
        with pytest.raises(RuntimeError, match="synthetic Flowable"):
            tool = HttpxFlowableTool(base_url="http://127.0.0.1:1", timeout=0.01)
    finally:
        if tool is not None:
            tool.close()


def test_production_rejects_flowable_fallback_after_profile_switch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from mate_tech_agent.tools.flowable_tool import HttpxFlowableTool

    monkeypatch.setenv("MATE_PROFILE", "development")
    tool = HttpxFlowableTool(base_url="http://127.0.0.1:1", timeout=0.01)
    try:
        monkeypatch.setenv("MATE_PROFILE", "production")
        with pytest.raises(RuntimeError, match="synthetic Flowable"):
            tool.deploy_bpmn("review", "<process />")
    finally:
        tool.close()
