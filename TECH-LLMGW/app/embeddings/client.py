"""Embedding client abstraction."""

from __future__ import annotations

import hashlib
import math
from typing import List, Protocol


class EmbeddingClient(Protocol):
    def embed(self, provider: str, model_code: str, inputs: List[str]) -> List[List[float]]: ...


class MockEmbeddingClient:
    """Deterministic embedding generator.

    The output vector is derived from a SHA-256 digest of the input text
    so repeated calls with the same input are stable. Vector length is
    fixed at 16 to keep test assertions readable; tests can override.
    """

    def __init__(self, *, dimension: int = 16) -> None:
        self._dimension = dimension
        self.calls: list[tuple[str, str, List[str]]] = []

    def embed(self, provider: str, model_code: str, inputs: List[str]) -> List[List[float]]:
        self.calls.append((provider, model_code, list(inputs)))
        return [self._hash_to_vector(f"{provider}|{model_code}|{text}") for text in inputs]

    # --------------------------------------------------------------- helpers

    def _hash_to_vector(self, seed: str) -> List[float]:
        digest = hashlib.sha256(seed.encode("utf-8")).digest()
        # Take the first N bytes from the digest and map to [-1, 1).
        vec: List[float] = []
        for i in range(self._dimension):
            byte = digest[i % len(digest)]
            vec.append((byte / 127.5) - 1.0)
        return vec

    def l2_normalize(self, vector: List[float]) -> List[float]:
        norm = math.sqrt(sum(x * x for x in vector)) or 1.0
        return [x / norm for x in vector]

    def reset(self) -> None:
        self.calls.clear()