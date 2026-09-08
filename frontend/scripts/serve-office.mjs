import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(frontendRoot, '..');
const backendRoot = path.join(repoRoot, 'backend');

function pythonCommand() {
  const candidates = process.platform === 'win32' ? ['py', 'python'] : ['python3', 'python'];
  for (const cmd of candidates) {
    const args = process.platform === 'win32' && cmd === 'py' ? ['-3', '-c', 'import sys'] : ['-c', 'import sys'];
    const check = spawnSync(cmd, args, { stdio: 'ignore' });
    if (!check.error && check.status === 0) {
      return cmd === 'py' ? ['py', '-3'] : [cmd];
    }
  }
  return ['python'];
}

const [pythonBin, ...pythonPrefix] = pythonCommand();
const result = spawnSync(
  pythonBin,
  [...pythonPrefix, '-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8080'],
  {
    cwd: backendRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      SERVE_STATIC: '1',
      OFFICE_PORT: '8080',
    },
  }
);

process.exit(result.status ?? 1);
