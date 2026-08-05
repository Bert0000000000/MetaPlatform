"""R5 Step 14: 加 Map ↔ JsonNode 转换到 DTO/Service.

策略:
  1. DTO 把 Map<String,Object> 改回 String (让 entity 字段也是 String)
  2. entity jsonb 字段改回 String (让 DTO 仍用 String)
  3. service 在转换时通过 ObjectMapper 序列化/反序列化

简化: 所有 jsonb 字段都用 String, service 用 ObjectMapper.
"""
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

# All remaining 4 modules
MODULES = ["TECH-IAM", "TECH-WFE", "TECH-EA", "TECH-ACTION"]

def revert_jsonb_to_string(file_path):
    """Change JsonNode jsonb fields back to String."""
    txt = file_path.read_text(encoding="utf-8")
    # Pattern: @Column(jsonb) @JdbcTypeCode(SqlTypes.JSON) private JsonNode field;
    # → @Column(jsonb) @Lob @JdbcTypeCode(SqlTypes.LONGVARCHAR) private String field;
    new_txt = re.sub(
        r"@Column\(([^)]*columnDefinition\s*=\s*[\"']jsonb[\"'][^)]*)\)\s*\n\s*@JdbcTypeCode\(SqlTypes\.JSON\)\s*\n\s*private\s+com\.fasterxml\.jackson\.databind\.JsonNode\s+(\w+);",
        r"@Lob\n    @JdbcTypeCode(SqlTypes.LONGVARCHAR)\n    @Column(\1)\n    private String \2;",
        txt
    )
    # Remove JsonNode import if no longer used
    if "JsonNode" not in new_txt:
        new_txt = re.sub(r"import com\.fasterxml\.jackson\.databind\.JsonNode;\n", "", new_txt)
    if new_txt != txt:
        file_path.write_text(new_txt, encoding="utf-8")
        return True
    return False

def revert_map_in_dto(file_path):
    """Change JsonNode DTO fields back to Map<String,Object> for jsonb."""
    txt = file_path.read_text(encoding="utf-8")
    # Find @Column(jsonb) and change JsonNode back to Map
    new_txt = re.sub(
        r"@Column\(([^)]*columnDefinition\s*=\s*[\"']jsonb[\"'][^)]*)\)\s*\n\s*private\s+com\.fasterxml\.jackson\.databind\.JsonNode\s+(\w+);",
        r"@Column(\1)\n    private Map<String, Object> \2;",
        txt
    )
    if "JsonNode" not in new_txt:
        new_txt = re.sub(r"import com\.fasterxml\.jackson\.databind\.JsonNode;\n", "", new_txt)
    if "Map<" in new_txt and "import java.util.Map" not in new_txt:
        new_txt = re.sub(
            r"(package\s+[^;]+;)",
            r"\1\n\nimport java.util.Map;",
            new_txt, count=1
        )
    if new_txt != txt:
        file_path.write_text(new_txt, encoding="utf-8")
        return True
    return False

def main():
    for module in MODULES:
        print(f"\n=== {module} ===")
        module_path = Path(module) / "src/main/java"
        e_count = 0
        d_count = 0
        for p in module_path.rglob("*Entity.java"):
            if revert_jsonb_to_string(p):
                e_count += 1
        for p in module_path.rglob("*Dto.java"):
            if revert_map_in_dto(p):
                d_count += 1
        print(f"  Reverted: {e_count} entities, {d_count} DTOs")

if __name__ == "__main__":
    main()
