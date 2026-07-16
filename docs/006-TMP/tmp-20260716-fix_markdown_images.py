import re
import os
import shutil

md_path = r"d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\Mate_Platform_架构设计_v1.0.md"
assets_dir = r"d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\Mate_Platform_Assets"
media_dir = os.path.join(assets_dir, "media")

with open(md_path, "r", encoding="utf-8") as f:
    content = f.read()

pattern = re.compile(r'!\[([^\]]*)\]\(([^\s)]+)\s+"([^"]+)"\)')

def repl(m):
    alt = m.group(1)
    old_path = m.group(2)
    title = m.group(3)
    # title like "application_architecture.png"
    new_name = title.strip()
    src = os.path.normpath(old_path)
    dst = os.path.join(assets_dir, new_name)
    if os.path.exists(src):
        shutil.copy2(src, dst)
    new_ref = f"![{alt}](./Mate_Platform_Assets/{new_name})"
    return new_ref

new_content = pattern.sub(repl, content)

# Remove pandoc image size attributes like {width="..." height="..."}
new_content = re.sub(r'\{width="[^"]+"\s+height="[^"]+"\}', '', new_content)

with open(md_path, "w", encoding="utf-8") as f:
    f.write(new_content)

# Clean up media directory if it exists
if os.path.isdir(media_dir):
    shutil.rmtree(media_dir)

print("Markdown image paths fixed.")
