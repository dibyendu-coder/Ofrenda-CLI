# ofrenda

Interview about someone you miss. Local open-weight model writes the remembrance. Output: one HTML page with candles, works with wifi off.

## Run

```bash
ollama pull gemma3:4b
node ofrenda.mjs
```

Swap model:

```bash
OFRENDA_MODEL=llama3.2 node ofrenda.mjs
```

No model installed? Plain template, no AI:

```bash
node ofrenda.mjs --no-ai
```

## Env

- `OFRENDA_MODEL` model tag, default `gemma3:4b`
- `OLLAMA_HOST` default `http://localhost:11434`
- `OFRENDA_OUT` output dir, default `ofrendas`

## Why open

- Stories about dead family stay on your disk. No upload.
- No service to shut down and take the memories with it.
- Swap model, edit system prompt, zero cost.

## Limits

Small models can drift. System prompt forbids inventing facts, but read output and edit before sharing.