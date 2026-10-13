"""Release verification must test the original .NET wire format and persisted name."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]


def verifier():
    spec = importlib.util.spec_from_file_location("issue142_verifier", KIT / "verify.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def source():
    return {
        "id": "synthetic-source",
        "name": "企业 世界.xlsx",
        "profile": {
            "rowCount": 1,
            "sheets": [
                {
                    "name": "业务资料",
                    "rows": 1,
                    "columns": [{"name": "名称", "samples": ["中文产品"]}],
                },
                {"name": "空表", "rows": 0, "columns": []},
            ],
        },
    }


class ExcelFilenameProbeTests(unittest.TestCase):
    def test_old_receipt_read_only_does_not_create_a_source_or_claim_upload_acceptance(self):
        calls, checks, state = [], [], {}

        def call(method, path, body=None, **options):
            calls.append((method, path))
            return source()

        verifier().verify_excel_filename(call, checks, state, read_only=True)
        self.assertEqual(calls, [])
        self.assertEqual(checks, [])
        self.assertEqual(state, {})

    def test_initial_probe_uploads_dotnet_encoding_and_reads_back_persisted_chinese_data(self):
        calls, checks, state = [], [], {}

        def call(method, path, body=None, **options):
            calls.append((method, path, body, options))
            return source()

        verifier().verify_excel_filename(call, checks, state, read_only=False)
        self.assertEqual(
            [c[:2] for c in calls],
            [
                ("POST", "/api/v1/ont/v2/modeling/sources"),
                ("GET", "/api/v1/ont/v2/modeling/sources/synthetic-source"),
            ],
        )
        body = calls[0][2]
        self.assertIsInstance(body, bytes)
        self.assertIn(b'filename="=?utf-8?B?5LyB5LiaIOS4lueVjC54bHN4?="', body)
        self.assertIn(b"filename*=utf-8''%E4%BC%81%E4%B8%9A%20%E4%B8%96%E7%95%8C.xlsx", body)
        self.assertIn(b"PK\x03\x04", body)
        self.assertTrue(
            calls[0][3]["headers"]["Content-Type"].startswith("multipart/form-data; boundary=")
        )
        self.assertEqual(state["issue142_source_id"], "synthetic-source")
        self.assertTrue(checks)

    def test_after_restart_reads_existing_source_without_creating_another(self):
        calls, checks = [], []
        state = {"issue142_source_id": "synthetic-source"}

        def call(method, path, body=None, **options):
            calls.append((method, path))
            return source()

        verifier().verify_excel_filename(call, checks, state, read_only=True)
        self.assertEqual(calls, [("GET", "/api/v1/ont/v2/modeling/sources/synthetic-source")])

    def test_bad_persisted_filename_counts_or_chinese_values_fail_release_acceptance(self):
        for change in ("name", "rowCount", "sheets", "samples"):
            with self.subTest(change=change):
                result = source()
                if change == "name":
                    result["name"] = "=?utf-8?B?5LyB5LiaIOS4lueVjC54bHN4?="
                elif change == "rowCount":
                    result["profile"]["rowCount"] = 0
                elif change == "sheets":
                    result["profile"]["sheets"] = []
                else:
                    result["profile"]["sheets"][0]["columns"][0]["samples"] = ["corrupt"]
                with self.assertRaises(RuntimeError):
                    verifier().verify_excel_filename(
                        lambda *args, result=result, **kwargs: result,
                        [],
                        {"issue142_source_id": "synthetic-source"},
                        read_only=True,
                    )


if __name__ == "__main__":
    unittest.main()
