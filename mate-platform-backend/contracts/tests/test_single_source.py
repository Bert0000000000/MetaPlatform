from pathlib import Path

WORKSPACE=Path(__file__).parents[3]
CANONICAL=(WORKSPACE/"mate-platform-backend/contracts/openapi").resolve()
GENERATED_WORKSPACE_ROOTS={".claude", ".tmp-build-context", ".worktrees", ".venv", "node_modules", "dist", "build"}

def test_only_canonical_editable_openapi_sources_exist() -> None:
 offenders=[]
 for path in WORKSPACE.rglob("*.yaml"):
  relative=path.relative_to(WORKSPACE)
  if any(part in GENERATED_WORKSPACE_ROOTS for part in relative.parts): continue
  resolved=path.resolve(); text=path.as_posix()
  if CANONICAL in resolved.parents or resolved==CANONICAL: continue
  if "/legacy/" in text: continue
  if "/openapi/" in text or text.endswith("docs/active/api/openapi.yaml"):
   offenders.append(relative.as_posix())
 assert offenders==[]

def test_legacy_handwritten_generators_are_removed() -> None:
 scripts=WORKSPACE/"mate-platform-backend/scripts"
 offenders=[p.name for p in scripts.glob("gen_*_openapi.*")]
 assert offenders==[]
