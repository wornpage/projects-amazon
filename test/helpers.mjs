import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

export function temporaryDirectory() {
  const parent = resolve(tmpdir());
  const directory = mkdtempSync(join(parent, 'projects-amazon-test-'));
  return { directory, remove() {
    if (!resolve(directory).startsWith(parent + sep) || !directory.includes('projects-amazon-test-')) throw new Error('Refusing to remove an unexpected path.');
    rmSync(directory, { recursive: true, force: true });
  } };
}

export async function browserSession(origin) {
  const response = await fetch(new URL('/api/workspace', origin));
  const workspace = await response.json();
  const cookie = response.headers.get('set-cookie').split(';')[0];
  return { workspace, cookie, async post(path, body) {
    const response = await fetch(new URL(path, origin), { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'X-Demo-Session': workspace.sessionId, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  } };
}
