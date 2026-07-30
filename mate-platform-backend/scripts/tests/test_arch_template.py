"""Direct test for the four-layer module template."""
from pathlib import Path
import sys, tempfile
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.arch_template import render


def test_render_includes_four_layers() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        out = render(name="sample", root=Path(tmp))
        for rel in [
            "domain/__init__.py",
            "application/__init__.py",
            "infrastructure/__init__.py",
            "api/__init__.py",
        ]:
            assert (out / rel).exists(), rel
        assert (out / "bootstrap.py").exists()
