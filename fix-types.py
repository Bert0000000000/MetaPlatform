"""R5 Step 13: 系统化修剩余 4 模块的 enum/jsonb 类型不匹配.

策略:
  1. 找每个 service 文件中引用的 enum 类 (e.g. AppVersionStatus)
  2. 找 entity 中对应的 String status 字段
  3. 改成 enum 类型, 加 @Enumerated
  4. 找 jsonb String 字段改成 JsonNode
  5. 修 DTO 把 Map<String,Object> 改成 JsonNode
"""
import re
import sys
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")

MODULES = ["TECH-IAM", "TECH-WFE", "TECH-EA", "TECH-ACTION"]

# Enum class names that map to status fields
# Format: (enum_class_name, entity_field_name, column_name)
ENUM_MAPPINGS = {
    "TECH-WFE": {
        "AppVersionStatus": ("status", "status"),
        "AppReleaseStatus": ("status", "status"),
        "AppReleaseStrategy": ("strategy", "strategy"),
        "ApprovalStatus": ("status", "status"),
        "ProcessDefinitionStatus": ("status", "status"),
    },
}

def fix_status_enum_in_entity(entity_path, enum_name, field_name, column_name):
    """Change String field to enum type with @Enumerated."""
    txt = entity_path.read_text(encoding="utf-8")
    # Check if field exists as String
    pattern = rf"(@Column\s*\([^)]*name\s*=\s*[\"']{column_name}[\"'][^)]*\)\s*\n\s*private\s+String\s+{field_name}\s*;)"
    m = re.search(pattern, txt, re.MULTILINE)
    if not m:
        return False
    # Replace with enum
    enum_path = enum_name  # same package
    new_field = (
        f"@Enumerated(EnumType.STRING)\n"
        f"    @JdbcTypeCode(SqlTypes.VARCHAR)\n"
        f"    @Column(name = \"{column_name}\", nullable = false, length = 32)\n"
        f"    private {enum_name} {field_name};"
    )
    txt2 = re.sub(pattern, new_field, txt, count=1, flags=re.MULTILINE)
    if "@Enumerated" in txt2 and "EnumType.STRING" in txt2:
        entity_path.write_text(txt2, encoding="utf-8")
        return True
    return False

def fix_jsonb_in_entity(entity_path):
    """Change String field to JsonNode for jsonb columns."""
    txt = entity_path.read_text(encoding="utf-8")
    # Find @Column(... jsonb ...) followed by private String xxx;
    pattern = re.compile(
        r"(@Lob\s+)?@JdbcTypeCode\(SqlTypes\.LONGVARCHAR\)\s+@Column\(([^)]*columnDefinition\s*=\s*[\"']jsonb[\"'][^)]*)\)\s*private\s+String\s+(\w+);",
        re.MULTILINE
    )
    new_txt = txt
    count = 0
    for m in pattern.finditer(txt):
        col_attrs = m.group(2)
        field = m.group(3)
        replacement = (
            f"@Column({col_attrs})\n"
            f"    @JdbcTypeCode(SqlTypes.JSON)\n"
            f"    private com.fasterxml.jackson.databind.JsonNode {field};"
        )
        new_txt = new_txt.replace(m.group(0), replacement, 1)
        count += 1
    if count > 0:
        # Remove @Lob before jsonb fields
        new_txt = re.sub(
            r"@Lob\s+(@Column\([^)]*columnDefinition\s*=\s*[\"']jsonb[\"'][^)]*\)\s*\n\s*@JdbcTypeCode\(SqlTypes\.JSON\))",
            r"\1",
            new_txt
        )
        # Add JsonNode import if needed
        if "com.fasterxml.jackson.databind.JsonNode" in new_txt and "import com.fasterxml.jackson.databind.JsonNode" not in new_txt:
            # Find package line and add import after
            new_txt = re.sub(
                r"(package\s+[^;]+;)",
                r"\1\n\nimport com.fasterxml.jackson.databind.JsonNode;",
                new_txt, count=1
            )
        entity_path.write_text(new_txt, encoding="utf-8")
    return count

def fix_jsonb_in_dto(dto_path):
    """Change Map<String,Object> field to JsonNode for jsonb fields."""
    txt = dto_path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"private\s+Map<String,\s*Object>\s+(\w+);"
    )
    new_txt = txt
    count = 0
    for m in pattern.finditer(txt):
        replacement = f"private com.fasterxml.jackson.databind.JsonNode {m.group(1)};"
        new_txt = new_txt.replace(m.group(0), replacement, 1)
        count += 1
    if count > 0:
        # Add JsonNode import if needed
        if "com.fasterxml.jackson.databind.JsonNode" in new_txt and "import com.fasterxml.jackson.databind.JsonNode" not in new_txt:
            new_txt = re.sub(
                r"(package\s+[^;]+;)",
                r"\1\n\nimport com.fasterxml.jackson.databind.JsonNode;",
                new_txt, count=1
            )
        # Add Map import if not used
        if "Map<" not in new_txt and "import java.util.Map" in new_txt:
            new_txt = new_txt.replace("import java.util.Map;", "")
        dto_path.write_text(new_txt, encoding="utf-8")
    return count

def main():
    for module in MODULES:
        print(f"\n=== {module} ===")
        module_path = Path(module) / "src/main/java"

        # Step 1: Fix entity status fields with enums
        enum_map = ENUM_MAPPINGS.get(module, {})
        for enum_name, (field_name, column_name) in enum_map.items():
            for p in module_path.rglob("*Entity.java"):
                if enum_name.replace("Status", "").lower() in p.stem.lower() or p.stem.endswith("Entity"):
                    if fix_status_enum_in_entity(p, enum_name, field_name, column_name):
                        print(f"  ✅ {p.name}: {field_name} -> {enum_name}")
                        break

        # Step 2: Fix jsonb fields in entities
        jsonb_count = 0
        for p in module_path.rglob("*Entity.java"):
            c = fix_jsonb_in_entity(p)
            jsonb_count += c
        print(f"  jsonb fields fixed: {jsonb_count}")

        # Step 3: Fix DTO Map<String,Object> fields
        dto_count = 0
        for p in module_path.rglob("*Dto.java"):
            c = fix_jsonb_in_dto(p)
            dto_count += c
        print(f"  DTO fields fixed: {dto_count}")

if __name__ == "__main__":
    main()
