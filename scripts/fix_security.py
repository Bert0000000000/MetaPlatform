from pathlib import Path

for p in ['TECH-LLMGW/src/main/resources/application-dev.yml','TECH-RAG/src/main/resources/application-dev.yml','TECH-ONT/src/main/resources/application-dev.yml']:
    text=Path(p).read_text(encoding='utf-8')
    old='      - org.springframework.ai.mcp.client.autoconfigure.McpClientAutoConfiguration\n  ai:'
    new='      - org.springframework.ai.mcp.client.autoconfigure.McpClientAutoConfiguration\n      - org.springframework.boot.actuate.autoconfigure.security.servlet.ManagementWebSecurityAutoConfiguration\n  ai:'
    if old in text and 'ManagementWebSecurityAutoConfiguration' not in text:
        text=text.replace(old,new)
        Path(p).write_text(text,encoding='utf-8')
        print('FIXED',p)
