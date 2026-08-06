# Browser example

## SoftStop SDK (recommended)

```html
<script type="module">
  import { SoftStop } from 'https://softstop.vercel.app/sdk.js'
  // or: <script type="module" src="./softstop.js"></script> after building packages/sdk-js

  const ss = new SoftStop({
    url: window.SOFTSTOP_API_URL || 'http://localhost:3000'
  })

  const decision = await ss.check({
    userId: 'user_123',
    actionType: 'interruption',
    surface: 'in-app'
  })
</script>
```

## Local classic script

```html
<script>
  window.SOFTSTOP_API_URL = 'http://localhost:3000';
</script>
<script src="governor.js"></script>
```

`governor.js` keeps a `GovernorClient` / `SoftStop` alias for the older example. Prefer `softstop.js` or the CDN `sdk.js`.

See [../README.md](../README.md) for the shared integration pattern.
