import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Resolves a working Python executable across Linux, macOS, Windows, and CI.
 * Prefers explicit PYTHON_CMD, then a local .venv, then standard PATH names.
 */
export function resolvePythonCmd(): string {
  if (process.env.PYTHON_CMD) return process.env.PYTHON_CMD;

  const venvCandidates =
    process.platform === 'win32'
      ? [resolve(process.cwd(), '.venv', 'Scripts', 'python.exe')]
      : [resolve(process.cwd(), '.venv', 'bin', 'python3'), resolve(process.cwd(), '.venv', 'bin', 'python')];

  for (const candidate of venvCandidates) {
    if (existsSync(candidate)) return candidate;
  }

  const pathCandidates = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
  for (const candidate of pathCandidates) {
    const probe = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (probe.status === 0) return candidate;
  }
  return 'python';
}
