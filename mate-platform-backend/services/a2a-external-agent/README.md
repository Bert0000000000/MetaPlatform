# a2a-external-agent

Real, runnable A2A 1.0 endpoint used by the SuperAI orchestrator to replace
the placeholder "外部对账桥接" registration that pointed at a non-existent
port.

The service exposes:

- `GET /.well-known/agent-card.json` → A2A 1.0 AgentCard (3 skills)
- `POST /` → JSON-RPC 2.0 `SendMessage`, returns a Task with
  `state: completed` and an artifact carrying the response text.
- `GET /healthz` → liveness probe
- `GET /skills` → skill roster (human-friendly)

Skills: `finance-recon`, `kb-curator`, `data-analyst`. The executor picks
a skill based on the request message metadata's `role_slug` field (or a
`[role-slug]` prefix in the message text).

## Run

```bash
cd mate-platform-backend
uvicorn services.a2a-external-agent.src.mate_a2a_external_agent.server:app --port 8701
```

## Docker

```bash
docker compose up -d a2a-external-agent
docker compose logs -f a2a-external-agent
```
