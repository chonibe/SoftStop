"use strict";

/**
 * Flag SoftStop `.check(` calls that lack a matching `.record(` in the same
 * function. Prefer `beforeContact` / `withSoftStop` / `wrapUserFacingTool`.
 *
 * Practical heuristic (not full CFG):
 * - Report member `.check(` when the enclosing function has no `.record(`
 * - Skip when the call is already wrapped via helpers that own the pairing
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require SoftStop check() to be paired with record() (or use beforeContact / withSoftStop)",
      recommended: true
    },
    schema: [],
    messages: {
      missingRecord:
        "SoftStop check() must be followed by record() in the same function (use try/finally), or prefer beforeContact / withSoftStop / wrapUserFacingTool."
    }
  },

  create(context) {
    const SAFE_WRAPPERS = new Set([
      "beforeContact",
      "withSoftStop",
      "wrapUserFacingTool"
    ]);

    /**
     * @param {import('estree').Node | null | undefined} node
     * @returns {import('estree').Node | null}
     */
    function enclosingFunction(node) {
      let current = node && node.parent;
      while (current) {
        if (
          current.type === "FunctionDeclaration" ||
          current.type === "FunctionExpression" ||
          current.type === "ArrowFunctionExpression"
        ) {
          return current;
        }
        current = current.parent;
      }
      return null;
    }

    /**
     * @param {import('estree').Node} node
     * @returns {boolean}
     */
    function functionHasRecordCall(node) {
      const source = context.getSourceCode();
      const text = source.getText(node);
      // Member .record( — avoid matching unrelated identifiers named record
      return /\.\s*record\s*\(/.test(text);
    }

    /**
     * @param {import('estree').Node} node
     * @returns {boolean}
     */
    function isSafeWrapperCall(node) {
      if (node.type !== "CallExpression") return false;
      const callee = node.callee;
      if (callee.type === "Identifier" && SAFE_WRAPPERS.has(callee.name)) {
        return true;
      }
      if (
        callee.type === "MemberExpression" &&
        !callee.computed &&
        callee.property.type === "Identifier" &&
        SAFE_WRAPPERS.has(callee.property.name)
      ) {
        return true;
      }
      return false;
    }

    /**
     * True when this check() sits inside beforeContact / withSoftStop callback
     * wiring (rare in consumer code; still safe).
     * @param {import('estree').Node} node
     */
    function insideSafeWrapper(node) {
      let current = node.parent;
      while (current) {
        if (isSafeWrapperCall(current)) return true;
        current = current.parent;
      }
      return false;
    }

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression" || callee.computed) return;
        if (callee.property.type !== "Identifier") return;
        if (callee.property.name !== "check") return;

        // SoftStop.check is the only interesting pattern; ignore Math.check etc.
        // Heuristic: any `.check(` with object that looks like a client is fine to flag
        // when unpaired — false positives on non-SoftStop .check are rare in app code.

        if (insideSafeWrapper(node)) return;

        const fn = enclosingFunction(node);
        if (!fn) {
          // Top-level check without a function body — always report
          context.report({ node: callee.property, messageId: "missingRecord" });
          return;
        }

        if (!functionHasRecordCall(fn)) {
          context.report({ node: callee.property, messageId: "missingRecord" });
        }
      }
    };
  }
};
