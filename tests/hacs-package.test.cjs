const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIRECTORY = path.join(ROOT, 'hollow-cards');
const DIST_DIRECTORY = path.join(ROOT, 'dist');

const digest = (filePath) => crypto
  .createHash('sha256')
  .update(fs.readFileSync(filePath))
  .digest('hex');

test('HACS manifest identifies Hollow Cards', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'hacs.json'), 'utf8'));
  assert.equal(manifest.name, 'Hollow Cards');
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

  assert.match(
    fs.readFileSync(path.join(DIST_DIRECTORY, 'hollow-cards-set.js'), 'utf8'),
    /import '\.\/hollow-cards\.js';/
  );
});
