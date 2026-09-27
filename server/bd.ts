import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;

export class BdError extends Error {
  readonly stderr: string;

  constructor(message: string, stderr: string) {
    super(message);
    this.name = "BdError";
    this.stderr = stderr;
  }
}

function bdBinary(): string {
  const configured = process.env.PASEO_BEADS_BD_BIN?.trim();
  return configured && configured.length > 0 ? configured : "bd";
}

interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

/** Run the `bd` CLI in `cwd` without a shell. */
export function runBd(cwd: string, args: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    execFile(
      bdBinary(),
      args,
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER_BYTES,
        windowsHide: true,
        env: { ...process.env, NO_COLOR: "1", BD_LAST_TOUCHED_FALLBACK: "0" },
      },
      (error, stdout, stderr) => {
        if (error && typeof (error as { code?: unknown }).code !== "number") {
          const failure = error as NodeJS.ErrnoException;
          reject(
            new BdError(
              failure.code === "ENOENT"
                ? `Could not run \`${bdBinary()}\`. Install the beads CLI or set PASEO_BEADS_BD_BIN.`
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

/** Run `bd` and parse its JSON stdout, throwing a readable error on failure. */
export async function runBdJson<T>(cwd: string, args: string[], timeoutMs?: number): Promise<T> {
  const result = await runBd(cwd, args, timeoutMs);
  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout).trim().split("\n").slice(0, 4).join(" ");
    throw new BdError(`bd ${args.join(" ")} failed: ${detail || `exit ${result.code}`}`, result.stderr);
  }
  const text = result.stdout.trim();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new BdError(`bd ${args.join(" ")} returned output that is not JSON`, result.stdout);
  }
}

/** Run `bd` and return trimmed stdout, for commands that print IDs or plain text. */
export async function runBdText(cwd: string, args: string[], timeoutMs?: number): Promise<string> {
  const result = await runBd(cwd, args, timeoutMs);
  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout).trim().split("\n").slice(0, 4).join(" ");
    throw new BdError(`bd ${args.join(" ")} failed: ${detail || `exit ${result.code}`}`, result.stderr);
  }
  return result.stdout.trim();
}

export function hasBeadsDatabase(dir: string): boolean {
  try {
    return existsSync(path.join(dir, ".beads"));
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
