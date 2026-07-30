from __future__ import annotations
import importlib,json,sys
from pathlib import Path
import yaml
BACKEND=Path(__file__).parents[2]
CONTRACTS=Path(__file__).parents[1]
RUNTIME=CONTRACTS/"runtime"

def configure_path()->None:
 for path in [*(BACKEND/"packages").glob("*/src"),*(BACKEND/"services").glob("*/src")]:
  sys.path.insert(0,str(path))

def export()->dict[str,str]:
 configure_path(); manifest=yaml.safe_load((CONTRACTS/"openapi/manifest.yaml").read_text(encoding="utf-8")); exported={}; cache={}
 RUNTIME.mkdir(parents=True,exist_ok=True)
 for domain,item in manifest["domains"].items():
  target=item.get("runtimeModule")
  if not target: continue
  if target not in cache:
   module_name,attr=target.split(":",1); module=importlib.import_module(module_name); app=getattr(module,attr); cache[target]=app.openapi()
  output=RUNTIME/f"{domain}.json"; output.write_text(json.dumps(cache[target],ensure_ascii=False,indent=2)+"\n",encoding="utf-8"); exported[domain]=output.relative_to(CONTRACTS).as_posix()
 (RUNTIME/"index.json").write_text(json.dumps(exported,indent=2)+"\n",encoding="utf-8")
 return exported
if __name__=="__main__":
 try: export()
 except Exception as exc:
  print(f"runtime export failed: {type(exc).__name__}: {exc}",file=sys.stderr); raise SystemExit(1)
