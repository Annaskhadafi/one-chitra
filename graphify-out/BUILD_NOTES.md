# Graphify Build Notes

- Mode: AST-only local build.
- Reason: corpus is large; semantic extraction would use many assistant tokens.
- `.graphifyignore` is active to skip generated/debug/temp folders.
- To refresh after code changes: `graphify update .`. If shrink guard is expected after ignore cleanup, rebuild with force.
- To add richer inferred edges later, run `$graphify . --mode deep` from Codex when token cost is acceptable.
