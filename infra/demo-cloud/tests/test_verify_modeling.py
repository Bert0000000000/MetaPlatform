"""Real workbook parsing and fail-closed Excel release acceptance."""
from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]


def load():
    path = KIT / "verify_modeling.py"
    if not path.is_file():
        raise AssertionError("Missing Excel release probe")
    spec = importlib.util.spec_from_file_location("verify_modeling", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class ModelingProbeTests(unittest.TestCase):
    def test_workbook_contains_actual_synthetic_records(self):
        module = load()
        # Read OpenXML independently; the hosted integration uses the production parser.
        import io
        from xml.etree import ElementTree as ET
        from zipfile import ZipFile
        ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        with ZipFile(io.BytesIO(module.workbook())) as archive:
            sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
            rows = [[cell.find("s:is/s:t", ns).text for cell in row]
                    for row in sheet.findall("s:sheetData/s:row", ns)]
        self.assertEqual(rows, [["Code", "Name"], ["A", "First"], ["B", "Second"]])

    def test_missing_source_configuration_stops_before_any_sync(self):
        module = load()
        paths = []
        def call(method, path, body=None, **kwargs):
            paths.append(path)
            if path.endswith("/sources"):
                return {"id": "synthetic-probe", "revision": 1}
            if path.endswith("/validate"):
                return {"id": "synthetic-probe", "revision": 2,
                        "validation": {"canPublish": True}, "plan": {"configHash": "a" * 64}}
            if path.endswith("/publish"):
                return {"id": "synthetic-probe", "revision": 2,
                        "publication": {"status": "succeeded"}}
            if path.endswith("/sync-check"):
                return {"syncCheck": {"canSync": False, "baselineError": "source not configured"}}
            return {"id": "synthetic-probe", "revision": 2}
        with self.assertRaisesRegex(RuntimeError, "source not configured"):
            module.verify(call, None)
        self.assertFalse(any(path.endswith("/sync") for path in paths))

    def test_readback_rejects_duplicates_instead_of_trusting_success_status(self):
        module = load()
        receipt = {"source_id": "probe", "types": [
            {"rid": "ont.tenant.obj.item.v1", "propertyMap": {"code": "code", "name": "name"},
             "values": [{"code": "A", "name": "First"}, {"code": "B", "name": "Second"}]},
        ], "link_type": "ont.tenant.ltp.label.v1"}
        def call(method, path, body=None, **kwargs):
            if "/sources/" in path:
                return {"sync": {"status": "succeeded"}}
            return [
                {"rid": "ont.tenant.ind.item.A", "props": {"code": "A", "name": "First"}},
                {"rid": "ont.tenant.ind.item.A-duplicate", "props": {"code": "A", "name": "First"}},
                {"rid": "ont.tenant.ind.item.B", "props": {"code": "B", "name": "Second"}},
            ]
        with self.assertRaisesRegex(RuntimeError, "count"):
            module.readback(call, receipt)
