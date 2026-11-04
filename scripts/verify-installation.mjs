import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';
const profile = process.env.DSH_PROFILE_DIR || join(homedir(), '.dsh/profiles/desktop');
const source = JSON.parse(await readFile('package.json', 'utf8'));
const active = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'));
const directory = join(profile, 'node_modules', source.name);
const installed = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
assert.equal(installed.version, source.version);
assert.ok(active.dsh.profile.bundles.includes(source.name), 'Theme bundle must be enabled');
const checks = [];
for (const file of ['package.json', ...source.files]) {
  const local = await readFile(file);
  assert.deepEqual(await readFile(join(directory, file)), local, `Installed ${file} differs from deliverable`);
  checks.push(file);
}
const archive = `dist/${source.name}-${source.version}.tgz`;
const sha256 = createHash('sha256').update(await readFile(archive)).digest('hex');
assert.equal((await readFile(`${archive}.sha256`, 'utf8')).split(' ')[0], sha256);
const report = {
  checkedAt: new Date().toISOString(), name: source.name, version: source.version,
  compatibleDsh: source.engines.dsh, desktopProfileEnabled: true,
  installedFilesMatchDeliverable: checks, archiveSha256: sha256,
  hostEntry: 'No-op; appearance runs in the DSH client',
  nativeThemePreferenceChanged: false,
  note: 'Filesystem verification. Authenticated desktop screenshots and offline browser regression are separate evidence.',
};
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/installation-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
