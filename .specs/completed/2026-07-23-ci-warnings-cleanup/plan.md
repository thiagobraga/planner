# CI Warnings Cleanup

Pipeline run 30019504561 passed with 0 errors but 32 warning annotations across
Quality, Security, and Deploy jobs. Warnings-only cleanup, no functional change
intended.

## Strategy

1. **React hook dependency warnings (app)** — 6 findings. Real risk: stale
   closures / values that silently go out of sync with renders.
2. **Unused variable/import lint warnings (api)** — 8 findings. Dead code only,
   safe removals.
3. **CodeQL Action v3→v4 deprecation** — concrete upgrade, low risk.
4. **Node.js 20→24 deprecation warnings** — informational/upstream (GitHub
   runners auto-force Node 24 compat today). No code action available yet;
   revisit when `actions/checkout`, `actions/setup-node`,
   `actions/upload-artifact`, `docker/*` publish Node-24-native majors.
