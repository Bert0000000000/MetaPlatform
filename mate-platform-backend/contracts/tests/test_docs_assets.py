from pathlib import Path
WORKSPACE=Path(__file__).parents[3]

def test_swagger_and_redoc_share_bundle() -> None:
 swagger=(WORKSPACE/"docs/swagger/index.html").read_text(encoding="utf-8")
 redoc=(WORKSPACE/"docs/swagger/redoc.html").read_text(encoding="utf-8")
 url="/mate-platform-backend/contracts/openapi/generated/bundled.yaml"
 assert url in swagger and url in redoc
 assert "specs/iam.yaml" not in swagger

def test_start_script_validates_before_serving() -> None:
 script=(WORKSPACE/"start-swagger.ps1").read_text(encoding="utf-8")
 assert script.index("npm run check") < script.index("http.server")
 assert "docs/swagger/index.html" in script.replace("\\","/")
