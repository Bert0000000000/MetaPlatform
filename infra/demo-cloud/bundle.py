"""Bundle source and offline Docker images without copying local secrets or databases."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import shutil
import subprocess
import tarfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
INFRA_IMAGES = (
    "pgvector/pgvector:pg16",
    "redis:7-alpine",
    "minio/minio:RELEASE.2024-10-13T13-34-11Z",
    "neo4j:5.20-community",
    "confluentinc/cp-kafka:7.8.0",
    "quay.io/keycloak/keycloak:25.0",
)
EXCLUDED_PARTS = {
    "node_modules",
    ".venv",
    "__pycache__",
    ".git",
    "private",
    "dist",
    "screenshots",
    ".artifacts",
    "playwright-report",
    "test-results",
}


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def save_images(path: Path, images: list[str]) -> None:
    with path.open("wb") as output:
        process = subprocess.Popen(
            [shutil.which("docker"), "image", "save", *images], stdout=subprocess.PIPE
        )
        try:
            with gzip.GzipFile(fileobj=output, mode="wb", compresslevel=3, mtime=0) as compressed:
                while chunk := process.stdout.read(4 * 1024 * 1024):
                    compressed.write(chunk)
        finally:
            process.stdout.close()
        if process.wait() != 0:
            raise SystemExit(f"Docker image export failed: {path.name}")
    if path.stat().st_size > 500_000_000:
        raise SystemExit(
            f"{path.name} exceeds the OrcaTerm single-file upload limit; split this image group."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--images", action="store_true")
    args = parser.parse_args()
    output = HERE / "artifacts"
    output.mkdir(exist_ok=True)
    revision = subprocess.check_output(
        [shutil.which("git"), "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip()
    (output / "source-revision.txt").write_text(revision + "\n", encoding="utf-8")

    names = (
        subprocess.check_output([shutil.which("git"), "ls-files", "-z"], cwd=ROOT)
        .decode("utf-8")
        .split("\0")
    )
    paths = []
    for name in names:
        if not name:
            continue
        path = Path(name)
        wanted = name.startswith(("mate-platform-backend/", "metaplatform-frontend/")) or name in (
            "docker-compose.yml",
            "infra/init-multiple-databases.sql",
            "infra/keycloak/realm-mate.json",
            "scripts/ont/apply_rls.py",
        )
        excluded = any(
            part in EXCLUDED_PARTS or part.startswith((".pytest", ".env")) for part in path.parts
        )
        if wanted and not excluded and (ROOT / path).is_file():
            paths.append(path)
    paths += [
        path.relative_to(ROOT)
        for path in HERE.iterdir()
        if path.is_file() and not path.name.startswith("DEPLOYMENT-")
    ]
    paths += [
        (output / name).relative_to(ROOT) for name in ("requirements.txt", "source-revision.txt")
    ]

    source = output / f"metaplatform-demo-{revision}.tar.gz"
    with tarfile.open(source, "w:gz") as archive:
        for path in sorted(set(paths)):
            archive.add(ROOT / path, arcname=path.as_posix(), recursive=False)
    files = [source]
    if args.images:
        groups = {
            "runtime-images": [
                f"metaplatform-demo-backend:{revision}",
                f"metaplatform-demo-web:{revision}",
            ],
            "storage-images": list(INFRA_IMAGES[:3]),
            "middleware-images": list(INFRA_IMAGES[3:]),
        }
        for label, images in groups.items():
            path = output / f"{label}-{revision}.tar.gz"
            save_images(path, images)
            files.append(path)
    manifest = {
        "source_revision": revision,
        "files": [
            {"name": path.name, "bytes": path.stat().st_size, "sha256": digest(path)}
            for path in files
        ],
    }
    (output / "bundle-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
