# eslint-plugin-softstop

ESLint rules that keep SoftStop **check → record** pairing honest in consumer apps.

## Install

```bash
pnpm add -D eslint-plugin-softstop
# or from this monorepo workspace:
# "eslint-plugin-softstop": "workspace:*"
```

## Enable (legacy `.eslintrc`)

```js
module.exports = {
  plugins: ["softstop"],
  extends: ["plugin:softstop/recommended"],
  // or:
  // rules: { "softstop/require-record-after-check": "error" }
};
```

## Enable (flat config, ESLint 9+)

```js
import softstop from "eslint-plugin-softstop";

export default [
  {
    plugins: { softstop },
    rules: {
      "softstop/require-record-after-check": "error"
    }
  }
];
```

## Rules

### `require-record-after-check`

Reports SoftStop-style `.check(` calls when the enclosing function has **no** `.record(`.

**Prefer** SDK wrappers that own the pairing:

- `beforeContact`
- `withSoftStop`
- `wrapUserFacingTool`

**Or** pair manually with `try/finally` so blocked and crash paths still `record`.

This is a practical AST heuristic, not a full control-flow proof. It catches the common orphan pattern: check then send with no record.

## Workspace

From SoftStop monorepo root:

```bash
pnpm --filter eslint-plugin-softstop test
```
