# Browser example

Local first — start the API, then open `index.html` (or serve this folder) with:

```html
<script>
  window.GOVERNOR_API_URL = "http://localhost:3000";
</script>
<script src="governor.js"></script>
```

Default in `governor.js` is `http://localhost:3000`. For the optional hosted demo, set `window.GOVERNOR_API_URL = "https://softstop.vercel.app"`.

See [../README.md](../README.md) for the shared integration pattern.
