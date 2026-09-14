const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIRECTORY = path.join(ROOT, 'hollow-cards');
const DIST_DIRECTORY = path.join(ROOT, 'dist');
const DOCUMENTATION_URL = 'https://github.com/MrHollowX/hollow-cards';

const digest = (filePath) => crypto
  .createHash('sha256')
  .update(fs.readFileSync(filePath))
  .digest('hex');

test('HACS manifest identifies Hollow Cards', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'hacs.json'), 'utf8'));
  assert.equal(manifest.name, 'Hollow Cards');
  assert.equal(manifest.content_in_root, false);
});

test('release metadata identifies the stable 1.0.0 package', () => {
  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  assert.match(changelog, /^## \[1\.0\.0\] - 2026-09-14$/m);

  const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'validate.yml'), 'utf8');
  assert.match(workflow, /uses:\s+hacs\/action@main/);
  assert.match(workflow, /category:\s+plugin/);
});

test('every card exposes Home Assistant documentation metadata', () => {
  const sourceFiles = fs.readdirSync(SOURCE_DIRECTORY)
    .filter((file) => file.endsWith('.js'))
    .sort();

  for (const file of sourceFiles) {
    const source = fs.readFileSync(path.join(SOURCE_DIRECTORY, file), 'utf8');
    assert.match(
      source,
      new RegExp(`documentationURL\\s*:\\s*['"]${DOCUMENTATION_URL.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}['"]`),
      `Missing card-picker documentation URL: ${file}`,
    );
  }
});

test('HACS dist mirrors every source card module', () => {
  const sourceFiles = fs.readdirSync(SOURCE_DIRECTORY)
    .filter((file) => file.endsWith('.js'))
    .sort();

  for (const file of sourceFiles) {
    const distPath = path.join(DIST_DIRECTORY, file);
    assert.ok(fs.existsSync(distPath), `Missing HACS module: dist/${file}`);
    assert.equal(
      digest(path.join(SOURCE_DIRECTORY, file)),
      digest(distPath),
      `HACS module is stale: dist/${file}`
    );
  }
});

test('HACS entry points load the complete card set', () => {
  const entryPoint = fs.readFileSync(path.join(DIST_DIRECTORY, 'hollow-cards.js'), 'utf8');
  const expectedImports = fs.readdirSync(SOURCE_DIRECTORY)
    .filter((file) => file.endsWith('.js'))
    .sort()
    .map((file) => `import './${file}';`);

  for (const importStatement of expectedImports) {
    assert.match(entryPoint, new RegExp(importStatement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal(fs.existsSync(path.join(DIST_DIRECTORY, 'hollow-cards-set.js')), false);
});
