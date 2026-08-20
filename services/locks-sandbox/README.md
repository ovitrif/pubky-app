# Locks / Paykit sandbox HTTP stub

Labeled local stand-in for the browser Locks client contract and Paykit setup launcher. It is **not** `pubky/locks`, **not** Paykit Server, and **not** Bitkit.

It exists so Pubky App can exercise:

- `POST /proof-bundles` with the canonical empty `paykit-payment` payload
- `POST /verification-task-lookups`
- `POST /access-credentials`
- `GET /priv-resources/content/<path>` with a bearer credential
- `GET /connect` and `GET /setup` launch pages

Invoice, address, and wallet material are rejected. Every response is marked `sandbox`.

```bash
npm run locks:sandbox
```

Defaults: Locks `127.0.0.1:3101`, Paykit setup `127.0.0.1:3102`. Override with `LOCKS_SANDBOX_PORT` and `PAYKIT_SETUP_SANDBOX_PORT`.
