"""The cloud acceptance probes must reject misleading legacy SPARQL responses."""

import importlib.util
import unittest
from pathlib import Path


def verifier():
    spec = importlib.util.spec_from_file_location(
        "demo_sparql_verification", Path(__file__).resolve().parents[1] / "verify.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SparqlVerificationTests(unittest.TestCase):
    def call(self, method, path, body, *, authenticated=True, expected=(200, 201)):
        self.assertEqual(method, "POST")
        self.assertIn(path, {"/api/v1/ont/sparql", "/api/v1/ont/explain"})
        self.requests.append((path, authenticated, expected))
        if not authenticated:
            self.assertEqual(expected, (401,))
            return {"detail": "missing tenant context"}
        if expected == (400,):
            keyword = "OPTIONAL" if "OPTIONAL {" in body["query"] else "FILTER"
            return {"detail": f"Parse failed: Unsupported SPARQL syntax: {keyword}"}
        self.assertEqual(expected, (200,))
        return {"bindings": [], "variables": ["FILTER"]}

    def setUp(self):
        self.requests = []

    def test_both_endpoints_require_real_error_and_read_responses(self):
        checks = []
        verifier().verify_sparql_boundary(self.call, checks)
        self.assertEqual(len(self.requests), 8)
        self.assertEqual(sum(expected == (400,) for _, _, expected in self.requests), 4)
        self.assertEqual(sum(not authenticated for _, authenticated, _ in self.requests), 2)
        self.assertTrue(any("FILTER/OPTIONAL" in check for check in checks))

    def test_wrong_parse_error_cannot_approve_release(self):
        def wrong_error(*args, **kwargs):
            result = self.call(*args, **kwargs)
            if kwargs.get("expected") == (400,):
                result = {"detail": "unrelated service error"}
            return result

        with self.assertRaisesRegex(RuntimeError, "syntax error"):
            verifier().verify_sparql_boundary(wrong_error, [])

    def test_missing_bindings_cannot_approve_supported_query(self):
        def missing_bindings(*args, **kwargs):
            result = self.call(*args, **kwargs)
            if args[1] == "/api/v1/ont/sparql" and kwargs.get("expected") == (200,):
                result = {}
            return result

        with self.assertRaisesRegex(RuntimeError, "SELECT bindings"):
            verifier().verify_sparql_boundary(missing_bindings, [])

    def test_wrong_explain_projection_cannot_approve_supported_query(self):
        def wrong_projection(*args, **kwargs):
            result = self.call(*args, **kwargs)
            if args[1] == "/api/v1/ont/explain" and kwargs.get("expected") == (200,):
                result = {"variables": []}
            return result

        with self.assertRaisesRegex(RuntimeError, "EXPLAIN projection"):
            verifier().verify_sparql_boundary(wrong_projection, [])
