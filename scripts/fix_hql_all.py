from pathlib import Path

patterns = [
  ("AND (:keyword IS NULL OR LOWER(t.name) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))) OR LOWER(t.code) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))))",
   "AND (:keyword IS NULL OR (LOWER(t.name) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%')) OR LOWER(t.code) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))))"),
  ("AND (:keyword IS NULL OR LOWER(s.name) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))) OR LOWER(s.code) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))))",
   "AND (:keyword IS NULL OR (LOWER(s.name) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%')) OR LOWER(s.code) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))))"),
  ("AND (:keyword IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))) OR LOWER(p.code) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))))",
   "AND (:keyword IS NULL OR (LOWER(p.name) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%')) OR LOWER(p.code) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))))"),
  ("AND (:keyword IS NULL OR LOWER(c.name) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))) OR LOWER(c.code) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))))",
   "AND (:keyword IS NULL OR (LOWER(c.name) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%')) OR LOWER(c.code) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))))")
]
roots = [Path('TECH-MCP'),Path('TECH-ONT'),Path('TECH-RAG'),Path('TECH-DATA'),Path('TECH-A2A'),Path('TECH-OBS')]
total_fixed=0
for r in roots:
    for f in r.rglob('*.java'):
        text=f.read_text(encoding='utf-8')
        orig=text
        for old,new in patterns:
            text=text.replace(old,new)
        if text!=orig:
            f.write_text(text,encoding='utf-8')
            total_fixed+=1
            print('FIXED',f)
print('total',total_fixed)
