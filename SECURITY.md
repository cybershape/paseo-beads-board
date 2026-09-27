# Security policy

## Reporting a vulnerability

Please report security issues privately by email to the maintainer, or through the repository's
private vulnerability reporting on GitHub. Include reproduction steps and the affected version. Fixes
ship as a new patch release of `paseo-beads-board`, and the advisory is credited unless you prefer
otherwise.

## Trust model

Paseo plugins are trusted, unsandboxed code. This plugin is no exception, and it is worth being
explicit about what it can do:

- **Server code runs in a daemon subprocess as the daemon user.** `server/bd.ts` executes the
  beads `bd` CLI with `execFile` — no shell, no string interpolation into a command line — with a
  30 second timeout and a 64 MiB output cap. Every argument comes from the plugin's own RPC
  contracts, and `bd` runs with the daemon user's filesystem access, so it can read and modify any
  beads database that user can reach.
- **No network calls, no telemetry, and no credentials are used by this plugin.** It talks to the
  `bd` CLI and to the Paseo SDK only.
- **Client code runs inside the Paseo app** and only renders board data; it performs no I/O of its
  own beyond the plugin RPCs.
- **The `bd` binary is configurable** through `PASEO_BEADS_BD_BIN` in the daemon environment. That
  variable is trusted input: point it only at a binary you control.

Board data is read from and written to your own beads databases. Treat this plugin with the same
care as any other tool that shells out on your machine, and read `server/bd.ts` and
`server/handlers.ts` before installing it somewhere sensitive.
