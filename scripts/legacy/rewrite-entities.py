import subprocess
import re
import sys
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")

def get_tables(db):
    r = subprocess.run(
        ["docker", "exec", "mate-postgres", "psql", "-U", "meta", "-d", db, "-c", r"\dt"],
        capture_output=True, text=True
    )
    tables = []
    for line in r.stdout.splitlines():
        m = re.match(r"\s*public\s*\|\s*(\w+)\s*\|\s*table\s*\|", line)
        if m:
            tables.append(m.group(1))
    return tables

def get_columns(db, table):
    try:
        r = subprocess.run(
            ["docker", "exec", "mate-postgres", "psql", "-U", "meta", "-d", db, "-c", r"\d " + table],
            capture_output=True, text=True, encoding="utf-8", errors="ignore", timeout=10
        )
    except Exception:
        return []
    if r.stdout is None:
        return []
    cols = []
    for line in r.stdout.splitlines():
        m = re.match(r"\s+(\w+)\s*\|\s*(.+?)\s*\|\s*(.+)$", line)
        if m and m.group(1) not in ('Column', 'Indexes', '---', 'References'):
            cols.append({"name": m.group(1), "type": m.group(2), "rest": m.group(3)})
    return cols

def pg_to_java(pg_type, module=None):
    pg_type = pg_type.lower()
    if "character varying" in pg_type or pg_type == "text" or pg_type == "varchar":
        return "String"
    if "jsonb" in pg_type or pg_type == "json":
        return "String"
    if "timestamp" in pg_type:
        return TIMESTAMP_TYPE.get(module, "OffsetDateTime")
    if pg_type == "date":
        return "LocalDate"
    if pg_type == "boolean":
        return "Boolean"
    if "integer" in pg_type or pg_type == "int" or pg_type == "int4":
        return "Integer"
    if "bigint" in pg_type or pg_type == "int8" or pg_type == "bigserial":
        return "Long"
    if pg_type == "double precision":
        return "Double"
    if "real" in pg_type:
        return "Float"
    if "numeric" in pg_type or "decimal" in pg_type:
        return "BigDecimal"
    if pg_type == "uuid":
        return "UUID"
    if pg_type == "bytea":
        return "byte[]"
    return "String"

def to_camel(name):
    parts = name.split('_')
    if not parts:
        return name
    def smart_title(s):
        if s and s[0].isdigit():
            return s.lower()
        return s.title()
    return parts[0].lower() + ''.join(smart_title(p) for p in parts[1:])

def jdbc_type_for(pg_type):
    pg_type = pg_type.lower()
    if "jsonb" in pg_type or pg_type == "json" or pg_type == "text":
        return "LONGVARCHAR"
    if "character varying" in pg_type or pg_type == "varchar":
        return "VARCHAR"
    return None

def needs_lob(pg_type):
    pg_type = pg_type.lower()
    return "jsonb" in pg_type or pg_type == "json" or pg_type == "text"

MODULES = {
    "TECH-AGENT": "metaplatform_agent",
    "TECH-LLMGW": "metaplatform_llmgw",
    "TECH-A2A":   "metaplatform_a2a",
    "TECH-RAG":   "metaplatform_rag",
    "TECH-DATA":  "metaplatform_data",
    "TECH-IAM":   "metaplatform_iam",
    "TECH-ONT":   "metaplatform_ont",
    "TECH-RULE":  "metaplatform_rule",
    "TECH-WFE":   "metaplatform_wfe",
    "TECH-GW":    "metaplatform_gw",
    "TECH-EA":    "metaplatform_ea",
    "TECH-ACTION":"metaplatform_action",
}

# Per-module timestamp type preference
TIMESTAMP_TYPE = {
    "TECH-AGENT": "OffsetDateTime",
    "TECH-LLMGW": "LocalDateTime",
    "TECH-A2A":   "OffsetDateTime",
    "TECH-RAG":   "OffsetDateTime",
    "TECH-DATA":  "OffsetDateTime",
    "TECH-IAM":   "LocalDateTime",
    "TECH-ONT":   "LocalDateTime",
    "TECH-RULE":  "LocalDateTime",
    "TECH-WFE":   "LocalDateTime",
    "TECH-GW":    "LocalDateTime",
    "TECH-EA":    "LocalDateTime",
    "TECH-ACTION":"LocalDateTime",
}

PREFIXES = ["Llmgw", "A2a", "Mcp", "Agent", "Data", "Rag", "Rule", "Wfe", "Msg", "Obs", "Gw", "Ea", "Action", "Ont", "Iam", "Mate"]

def find_entity_file(module, table):
    module_path = Path(module) / "src" / "main" / "java"
    parts = table.split("_")
    candidates = set()
    candidates.add("".join(p.title() for p in parts) + "Entity")
    if len(parts) > 1:
        candidates.add("".join(p.title() for p in parts[1:]) + "Entity")
    candidates.add(parts[0].title() + "".join(p.title() for p in parts[1:]) + "Entity")
    for prefix in PREFIXES:
        if len(parts) > 1:
            candidates.add(prefix + "".join(p.title() for p in parts[1:]) + "Entity")
    for cand in candidates:
        for p in module_path.rglob(cand + ".java"):
            return p
    return None

def generate_entity(module, package_path, table, columns, class_name):
    pass
    pk_col = None
    for c in columns:
        if c["name"] == "id":
            pk_col = c
            break
    if not pk_col and columns:
        pk_col = columns[0]

    lines = []
    lines.append("package " + package_path + ";")
    lines.append("")
    lines.append("import jakarta.persistence.*;")
    lines.append("import lombok.AllArgsConstructor;")
    lines.append("import lombok.Builder;")
    lines.append("import lombok.Data;")
    lines.append("import lombok.NoArgsConstructor;")
    lines.append("import org.hibernate.annotations.JdbcTypeCode;")
    lines.append("import org.hibernate.type.SqlTypes;")
    lines.append("")

    has_uuid = any(pg_to_java(c["type"]) == "UUID" for c in columns)
    has_offset = any(pg_to_java(c["type"], module) == "OffsetDateTime" for c in columns)
    has_localdt = any(pg_to_java(c["type"], module) == "LocalDateTime" for c in columns)
    has_localdate = any(pg_to_java(c["type"], module) == "LocalDate" for c in columns)
    has_bigdecimal = any(pg_to_java(c["type"], module) == "BigDecimal" for c in columns)

    if has_uuid:
        lines.append("import java.util.UUID;")
    if has_offset:
        lines.append("import java.time.OffsetDateTime;")
    if has_localdt:
        lines.append("import java.time.LocalDateTime;")
    if has_localdate:
        lines.append("import java.time.LocalDate;")
    if has_bigdecimal:
        lines.append("import java.math.BigDecimal;")

    lines.append("")
    lines.append("@Entity")
    lines.append(f'@Table(name = "{table}")')
    lines.append("@Data")
    lines.append("@Builder")
    lines.append("@NoArgsConstructor")
    lines.append("@AllArgsConstructor")
    lines.append(f"public class {class_name} {{")
    lines.append("")

    seen = set()
    for c in columns:
        if c["name"] in seen:
            continue
        seen.add(c["name"])
        java_type = pg_to_java(c["type"], module)
        field_name = to_camel(c["name"])
        is_pk = (c == pk_col)
        is_not_null = "not null" in c["rest"]
        is_lob = needs_lob(c["type"])
        jdbc = jdbc_type_for(c["type"])

        if is_pk and (c["name"] == "id" or java_type in ("Long", "Integer", "UUID")):
            lines.append("    @Id")
            if java_type == "UUID":
                lines.append("    @GeneratedValue(strategy = GenerationType.UUID)")
            elif java_type in ("Long", "Integer"):
                lines.append("    @GeneratedValue(strategy = GenerationType.IDENTITY)")
        if is_lob:
            lines.append("    @Lob")
        if jdbc:
            lines.append(f"    @JdbcTypeCode(SqlTypes.{jdbc})")
        col_attrs = [f'name = "{c["name"]}"']
        if is_not_null:
            col_attrs.append("nullable = false")
        if "character varying" in c["type"].lower():
            m = re.search(r"character varying\((\d+)\)", c["type"])
            if m:
                col_attrs.append(f"length = {m.group(1)}")
        if c["type"].lower() == "text":
            col_attrs.append('columnDefinition = "TEXT"')
        elif "jsonb" in c["type"].lower():
            col_attrs.append('columnDefinition = "jsonb"')
        lines.append(f"    @Column({', '.join(col_attrs)})")
        lines.append(f"    private {java_type} {field_name};")
        lines.append("")

    lines.append("}")
    return "\n".join(lines) + "\n"

for module, db in MODULES.items():
    tables = get_tables(db)
    module_path = Path(module) / "src" / "main" / "java"
    if not module_path.exists():
        continue
    rewritten = 0
    missed = []
    for table in tables:
        ef = find_entity_file(module, table)
        if not ef:
            missed.append(table)
            continue
        columns = get_columns(db, table)
        if not columns:
            continue
        rel = ef.relative_to(module_path)
        parts = rel.parts[:-1]
        package_path = ".".join(parts)
        class_name = ef.stem
        content = generate_entity(module, package_path, table, columns, class_name)
        ef.write_text(content, encoding="utf-8")
        rewritten += 1
    print(f"  {module}: {rewritten} rewritten, {len(missed)} missed: {missed[:3]}")

print("Done")
