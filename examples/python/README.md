# Python example

Prefer the published SDK:

```bash
pip install softstop
# or from repo: pip install -e ../../packages/sdk-python
```

See [packages/sdk-python](../../packages/sdk-python/) and the agent example [../langchain-agent](../langchain-agent/).

This directory keeps a thin `governor_client.py` script for a quick local check against `pnpm dev`.

```bash
# terminal 1 — repo root
pnpm install
pnpm dev

# terminal 2
cd examples/python
pip install -r requirements.txt
# Prefer SoftStop SDK; this script is a standalone demo
GOVERNOR_API_URL=http://localhost:3000 python governor_client.py
```

Optional hosted demo: `GOVERNOR_API_URL=https://softstop.vercel.app`.

See [../README.md](../README.md) for the shared integration pattern.
