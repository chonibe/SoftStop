"use strict";

const requireRecordAfterCheck = require("./lib/rules/require-record-after-check");

/** @type {import('eslint').ESLint.Plugin} */
module.exports = {
  meta: {
    name: "eslint-plugin-softstop",
    version: "0.1.0"
  },
  rules: {
    "require-record-after-check": requireRecordAfterCheck
  },
  configs: {
    recommended: {
      plugins: ["softstop"],
      rules: {
        "softstop/require-record-after-check": "error"
      }
    }
  }
};
