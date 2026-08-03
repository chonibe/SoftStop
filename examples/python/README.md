# Python example

Local first:

```bash
# terminal 1 — repo root
pnpm install
pnpm dev

# terminal 2
cd examples/python
pip install -r requirements.txt
GOVERNOR_API_URL=http://localhost:3000 python governor_client.py
```

Optional hosted demo: `GOVERNOR_API_URL=https://governer.vercel.app`.

See [../README.md](../README.md) for the shared integration pattern.
