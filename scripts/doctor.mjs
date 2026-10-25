// Local readiness checks only. Never calls a model or changes a workspace.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, FILES, FIXTURE } from '../lib/store.mjs';
import { getBrowser, closeBrowser } from '../lib/browser.mjs';

let failures = 0;
function report(ok, description) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${description}`);
  if (!ok) failures++;
}
report(Number(process.versions.node.split('.')[0]) >= 22, `Node ${process.versions.node} (22+ required)`);
for (const file of ['server.mjs', 'lib/store.mjs', 'lib/provider.mjs', 'lib/runner.mjs', 'lib/browser.mjs', 'public/app.js', 'public/anatomy.mjs', 'scripts/evaluate.mjs']) {
  const result = spawnSync(process.execPath, ['--check', path.join(ROOT, file)], { encoding: 'utf8', windowsHide: true });
  report(result.status === 0, `Syntax: ${file}`);
  if (result.status !== 0) console.error(result.stderr || result.error?.message);
}
for (const file of [...FILES, 'PROJECT.md']) {
  try { await fs.access(path.join(FIXTURE, file)); report(true, `Starter application: ${file}`); }
  catch { report(false, `Starter application missing: ${file}`); }
}
try {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setContent('<button id="check">Local browser works</button>');
  await page.locator('#check').click();
  report(true, `Browser launches and interacts: Chromium ${browser.version()}`);
} catch (error) { report(false, `Browser: ${error.message}`); }
finally { await closeBrowser().catch(() => {}); }
console.log('\nNo model requests made. Use npm test for the full isolated test suite.');
console.log('Live provider access and model behavior still require Save & test and real rehearsal runs.');
process.exitCode = failures ? 1 : 0;
