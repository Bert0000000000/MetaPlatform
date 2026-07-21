"""FastAPI dependencies for the discovery service."""

from __future__ import annotations

from app.services.ontology_discovery_service import LlmSuggestionClient, OntologyClient


def get_llm_client() -> LlmSuggestionClient:
    return LlmSuggestionClient()


def get_ontology_client() -> OntologyClient:
    return OntologyClient()
