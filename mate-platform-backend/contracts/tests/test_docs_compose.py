from pathlib import Path

import yaml

WORKSPACE=Path(__file__).parents[3]

def test_docs_services_are_profile_gated() -> None:
 compose=yaml.safe_load((WORKSPACE/"docker-compose.yml").read_text(encoding="utf-8"))
 for name in ("swagger-ui","redoc","prism"):
  service=compose["services"][name]
  assert set(service["profiles"])=={"local","docs"}
 assert "bundled.yaml" in " ".join(compose["services"]["prism"]["command"])
 assert compose["services"]["prism"]["ports"]==["4010:4010"]
 assert compose["services"]["prism"]["build"]["dockerfile"].endswith("Dockerfile.prism")

def test_docs_image_is_read_only_nginx() -> None:
 text=(WORKSPACE/"mate-platform-backend/contracts/Dockerfile.docs").read_text(encoding="utf-8")
 assert "npm run check" in text
 assert "FROM nginx:" in text
 assert "prism" not in text.lower()
