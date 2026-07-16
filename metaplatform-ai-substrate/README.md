# MetaPlatform AI Substrate v0.1

Spike phase deliverable. Detailed plan: `docs/superpowers/plans/2026-07-02-ai-substrate-v0.1.md`.

## Quick Start

```bash
docker-compose up -d
./mvnw spring-boot:run
```

## Environment Variables

- `OPENAI_API_KEY`: OpenAI API key
- `ANTHROPIC_API_KEY`: Anthropic API key

## Ports

- PostgreSQL: localhost:5435
- Redis: localhost:6381
- This service: localhost:8083
