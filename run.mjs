#!/usr/bin/env node
// Cross-platform launcher (Windows, macOS, Linux, WSL).
// Usage: node run.mjs [--port 5173] [--backend-port 8010]   (or: npm start)
// Sets up the Python venv and node_modules for THIS machine when needed,
// then starts the backend (default :8010) and the frontend (:5173).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const backend = join(root, 'backend');
const frontend = join(root, 'frontend');
const win = process.platform === 'win32';
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const BACKEND_PORT = arg('backend-port') || process.env.BACKEND_PORT || '8010';
const FRONTEND_PORT = arg('port') || process.env.FRONTEND_PORT || '5173';
const npm = win ? 'npm.cmd' : 'npm';

const log = (m) => console.log(`\x1b[36m[xml-compare]\x1b[0m ${m}`);
const die = (m) => {
  console.error(`\x1b[31m[xml-compare] ${m}\x1b[0m`);
  process.exit(1);
};
const run = (cmd, args, cwd, quiet = false) =>
  spawnSync(cmd, args, { cwd, stdio: quiet ? 'ignore' : 'inherit', shell: win && cmd.endsWith('.cmd') });

// ---------- backend: virtualenv ----------
const venvPy = join(backend, '.venv', win ? 'Scripts' : 'bin', win ? 'python.exe' : 'python');
const venvOk = () => existsSync(venvPy) && run(venvPy, ['-c', 'import django, lxml, rest_framework, corsheaders'], backend, true).status === 0;

if (!venvOk()) {
  log('Setting up Python environment for this system…');
  const candidates = win ? [['py', ['-3']], ['python', []], ['python3', []]] : [['python3', []], ['python', []]];
  const found = candidates.find(([c, a]) => run(c, [...a, '--version'], backend, true).status === 0);
  if (!found) die('Python 3 not found. Install Python 3.10+ (WSL/Ubuntu: sudo apt install python3 python3-venv).');
  rmSync(join(backend, '.venv'), { recursive: true, force: true }); // may be copied from another OS
  let r = run(found[0], [...found[1], '-m', 'venv', '.venv'], backend);
  if (r.status !== 0) die('Could not create venv. On Ubuntu/WSL run: sudo apt install python3-venv');
  r = run(venvPy, ['-m', 'pip', 'install', '-r', 'requirements.txt'], backend);
  if (r.status !== 0) die('pip install failed.');
}

// ---------- frontend: node_modules ----------
const nm = join(frontend, 'node_modules');
const stampFile = join(nm, '.platform');
const stamp = `${process.platform}-${process.arch}`;
const nodeOk = () =>
  existsSync(stampFile) &&
  readFileSync(stampFile, 'utf8').trim() === stamp &&
  run(process.execPath, ['--input-type=module', '-e', "await import('vite')"], frontend, true).status === 0;

const install = () => {
  const r = run(npm, ['install'], frontend);
  if (r.status !== 0) die('npm install failed.');
  writeFileSync(stampFile, stamp);
};

if (!nodeOk()) {
  log(`Installing frontend dependencies for ${stamp}…`);
  rmSync(nm, { recursive: true, force: true }); // native binaries differ per OS
  install();
  if (!nodeOk()) {
    // npm optional-dependency bug (npm/cli#4828): retry without the lockfile.
    log('Native module missing, retrying with a clean lockfile…');
    rmSync(nm, { recursive: true, force: true });
    rmSync(join(frontend, 'package-lock.json'), { force: true });
    install();
    if (!nodeOk()) die('Frontend dependencies could not be installed for this system.');
  }
}

if (process.argv.includes('--setup')) {
  log('Setup complete.');
  process.exit(0);
}

// ---------- start both servers ----------
const children = [];
const start = (name, cmd, args, cwd, env = {}) => {
  const c = spawn(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env }, shell: win && cmd.endsWith('.cmd') });
  c.on('exit', (code) => {
    log(`${name} stopped (${code ?? 'signal'}).`);
    shutdown(code ?? 0);
  });
  children.push(c);
};

let closing = false;
function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  for (const c of children) {
    if (c.exitCode !== null) continue;
    if (win) spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
    else c.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 300);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

log(`Backend  → http://localhost:${BACKEND_PORT}`);
log(`Frontend → http://localhost:${FRONTEND_PORT}   (Ctrl+C stops both)`);
start('backend', venvPy, ['manage.py', 'runserver', `127.0.0.1:${BACKEND_PORT}`], backend);
start('frontend', npm, ['run', 'dev', '--', '--port', FRONTEND_PORT, '--host', 'localhost'], frontend, {
  VITE_API_URL: process.env.VITE_API_URL || `http://localhost:${BACKEND_PORT}`,
});
