# MetaPlatform Bruno API Collection

A complete collection of ~20 API requests for the MetaPlatform REST API,
covering the most-used endpoints across all sections.

## Install Bruno

Download from <https://usebruno.com> (free, open-source).

## Import the Collection

In Bruno:
1. Click **Collection** → **Open Collection**
2. Select `bruno/MetaPlatform/`
3. Pick the **Local Dev** environment

## Run the Collection

1. Open the **Auth → Login** request
2. Click **Send**
3. The JWT token is auto-saved to the `token` env var
4. All subsequent authenticated requests use it automatically

## Sections Included

| Section | Requests | What's covered |
|---|---|---|
| Auth          | 2  | Login, /me |
| Health        | 1  | /api/health |
| Storage       | 2  | Health check, Neo4j query |
| AI            | 5  | Status, Embed, Chat, Agent, RAG |
| Analytics     | 4  | Status, NL2SQL, Quality, Simulate |
| Observability | 2  | Prometheus metrics, Status |
| Notifications | 2  | List, Send test |
| Scheduler     | 1  | Status |
| OpenAPI       | 1  | Spec retrieval |

For full coverage, browse the auto-generated Swagger UI at:
**http://localhost:3001/api/docs/**

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `baseUrl` | `http://localhost:3001` | API server URL |
| `email` | `admin@metaplatform.com` | Login email |
| `password` | `admin123` | Login password |
| `token` | (set after login) | JWT bearer token |

## Adding New Requests

Right-click any folder → **New Request**, then write:

```
meta {
  name: My new request
  type: http
  seq: 1
}

post {
  url: {{baseUrl}}/api/my/endpoint
  body: json
  auth: bearer
}

auth:bearer {
  token: {{token}}
}

headers {
  Content-Type: application/json
}

body:json {
  { "key": "value" }
}

tests {
  test("status is 200", function() {
    expect(res.status).to.equal(200);
  });
}
```

See <https://docs.usebruno.com> for the full .bru syntax.