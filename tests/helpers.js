import { spawn } from 'node:child_process';
export async function launch(directory, environment = {}) {
  const child = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, NODE_ENV: 'test', CMS_DEMO: 'true', CMS_DATA_DIR: directory, PORT: '0', ...environment }, stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = '';
  child.stderr.on('data', data => { errors += data; });
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`Startup timeout: ${errors}`)); }, 10000);
    child.stdout.on('data', data => { const match = String(data).match(/listening on (\d+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${errors}`)); });
  });
  return { child, url: `http://127.0.0.1:${port}` };
}
