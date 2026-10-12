# Beads - issue tracking via br

This repository uses [beads_rust](https://github.com/Dicklesworthstone/beads_rust) (`br`), not the Go `bd` CLI.
`bd` stores issues in embedded Dolt and was too slow. `br` stores them in SQLite (`.beads/beads.db`)
and exports `.beads/issues.jsonl`.

The previous Dolt database is still on disk under `.beads/embeddeddolt` (gitignored) if you need to
roll back. Git hooks no longer call `bd`.

```bash
br ready --json
br list --json
br show <id> --json
br create "Title" -p 2 -t task --json
br update <id> --status in_progress
br close <id> --reason "Done"
br sync --flush-only
```

`br` does not run git. After changing issues, commit `.beads/issues.jsonl` yourself.
