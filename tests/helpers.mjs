import { spawn } from 'node:child_process';

export async function launch(t, cli, cwd, args = [], env = process.env) {
  const child = cli.endsWith('.js')
    ? spawn(process.execPath, [cli, ...args], { cwd, env })
    : spawn(cli, args, { cwd, env });
  t.after(() => child.kill('SIGKILL'));
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exit = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  const url = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Launch timed out: ${stderr}`)), 10000);
    child.stdout.on('data', () => {
      const match = stdout.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    exit.then((result) => {
      clearTimeout(timer);
      reject(new Error(`Exited before listening: ${JSON.stringify(result)}`));
    }, reject);
  });
  // Invalid-input tests consume exit instead of url.
  url.catch(() => {});
  return { child, url, exit, output: () => ({ stdout, stderr }) };
}
