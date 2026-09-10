# model_prices.json — vendored pricing data

Per-token unit prices (USD) for the models llmgw actually routes to.
Kept small on purpose (~30 entries); this is NOT the full LiteLLM catalog.

## Sources (pulled 2026-09-09)

| `_source`    | Meaning                                                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `litellm`    | BerriAI/litellm `model_prices_and_context_window.json` @ main (MIT). Verbatim values.                                                                          |
| `arkcli`     | Volcengine ARK settlement prices via `arkcli pricing models` (CNY per 1K tokens), converted at 7.2 CNY/USD → `_source` keeps the original CNY value for audit. |
| `legacy`     | Pre-P1 llmgw hardcoded table — still accurate, not present in current LiteLLM catalog.                                                                         |
| `historical` | Provider-published price at model GA; the model has since dropped off current price lists (e.g. moonshot-v1). Verify before relying.                           |

## Update procedure

```bash
# doubao segment (re-verify quarterly):
arkcli pricing models --modality LLM    # InferencePrompt / InferenceCompletion / ContextSessionHit
arkcli pricing models --modality Embedding

# openai/anthropic/deepseek/qwen segment:
curl -sL https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json \
  | jq 'with_entries(select(.key | IN("gpt-4o", ...)))'
```

Record the pull date in `_meta.sources` and the original CNY price in each
`_source` when converting. ARK `ep-xxx` endpoint IDs are NOT resolvable from
any catalog — register them via the `LLMGW_MODEL_ALIASES` env (see pricing.py).

## Overrides & aliases (no redeploys needed)

- `LLMGW_PRICE_OVERRIDES` — env JSON replacing entries (negotiated/discount prices):
  `{"qwen-max": {"input_cost_per_token": 0.0000006, "output_cost_per_token": 0.0000024}}`
- `LLMGW_MODEL_ALIASES` — env JSON mapping request model names (incl. `ep-xxx`)
  to catalog keys: `{"ep-20240903xxxx": "doubao-seed-1.6", "doubao-pro": "doubao-pro-32k"}`

## License note

LiteLLM's price database is MIT-licensed; vendoring a subset with attribution
is permitted. The ARK prices are public list prices from the account's own
billing catalog.
