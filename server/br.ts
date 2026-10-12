import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;

export class BrError extends Error {
  readonly stderr: string;

  constructor(message: string, stderr: string) {
    super(message);
    this.name = "BrError";
    this.stderr = stderr;
  }
}

function brBinary(): string {
  const configured = process.env.PASEO_BEADS_BR_BIN?.trim();
  return configured && configured.length > 0 ? configured : "br";
}

interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

/** Run the `br` CLI in `cwd` without a shell. */
export function runBr(cwd: string, args: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    execFile(
      brBinary(),
      args,
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER_BYTES,
        windowsHide: true,
        env: { ...process.env, NO_COLOR: "1" },
      },
      (error, stdout, stderr) => {
        if (error && typeof (error as { code?: unknown }).code !== "number") {
          const failure = error as NodeJS.ErrnoException;
          reject(
            new BrError(
              failure.code === "ENOENT"
                ? `Could not run \`${brBinary()}\`. Install beads_rust (\`br\`) or set PASEO_BEADS_BR_BIN.`
                : (failure.message ?? String(error)),
              String(stderr ?? ""),
            ),
          );
          return;
        }
        resolve({
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
          code: error ? Number((error as { code?: unknown }).code) : 0,
        });
      },
    );
  });
}

/** Run `br` and parse its JSON stdout, throwing a readable error on failure. */
export async function runBrJson<T>(cwd: string, args: string[], timeoutMs?: number): Promise<T> {
  const result = await runBr(cwd, args, timeoutMs);
  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout).trim().split("\n").slice(0, 4).join(" ");
    throw new BrError(`br ${args.join(" ")} failed: ${detail || `exit ${result.code}`}`, result.stderr);
  }
  const text = result.stdout.trim();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new BrError(`br ${args.join(" ")} returned output that is not JSON`, result.stdout);
  }
}

/** Run `br` and return trimmed stdout, for commands that print IDs or plain text. */
export async function runBrText(cwd: string, args: string[], timeoutMs?: number): Promise<string> {
  const result = await runBr(cwd, args, timeoutMs);
  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout).trim().split("\n").slice(0, 4).join(" ");
    throw new BrError(`br ${args.join(" ")} failed: ${detail || `exit ${result.code}`}`, result.stderr);
  }
  return result.stdout.trim();
}

/**
 * Files beads writes into `.beads` once a database is initialized there. Beads also
 * keeps a machine-level `~/.beads` for event data, so a bare directory is not proof
 * of a project database. `beads.db` is the beads_rust (br) store; `issues.db` is the
 * older sqlite name.
 */
const DATABASE_MARKERS = ["config.yaml", "metadata.json", "issues.db", "beads.db"];

export function hasBeadsDatabase(dir: string): boolean {
  try {
    const beadsDir = path.join(dir, ".beads");
    return DATABASE_MARKERS.some((marker) => existsSync(path.join(beadsDir, marker)));
  } catch {
    return false;
  }
}

export function projectName(dir: string): string {
  return path.basename(dir) || dir;
}

/** Walk up from `dir` looking for the nearest directory that holds a `.beads` database. */
export function findBeadsRoot(dir: string, maxDepth = 4): string | null {
  let current = path.resolve(dir);
  for (let depth = 0; depth <= maxDepth; depth += 1) {
    if (hasBeadsDatabase(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}
