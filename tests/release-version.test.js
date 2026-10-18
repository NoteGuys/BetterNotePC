import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import packageInfo from '../package.json' with { type: 'json' };
import lock from '../package-lock.json' with { type: 'json' };
import { CURRENT_APP_VERSION, CURRENT_APP_DISPLAY_VERSION } from '../src/services/updateService.js';
import { GUIDE_VERSION } from '../src/components/Guide/guideContent.js';
import { TRANSLATIONS } from '../src/services/i18n.js';

test('Runtime, Settings, guide, npm lock and Windows manifest agree on the release version', () => {
  const manifest = readFileSync(new URL('../AppxManifest.xml', import.meta.url), 'utf8');
  const identity = manifest.match(/<Identity\b[^>]*>/)?.[0];
  assert.ok(identity);
  assert.match(packageInfo.version, /^\d+\.\d+\.\d+$/);
  assert.equal(packageInfo.build.buildVersion, packageInfo.version + '.0');
  assert.equal(identity.match(/\bVersion="([^"]+)"/)?.[1], packageInfo.build.buildVersion);
  assert.equal(lock.version, packageInfo.version);
  assert.equal(lock.packages[''].version, packageInfo.version);
  assert.equal(CURRENT_APP_VERSION, packageInfo.version);
  assert.equal(CURRENT_APP_DISPLAY_VERSION, packageInfo.build.buildVersion);
  assert.equal(GUIDE_VERSION, CURRENT_APP_DISPLAY_VERSION);
});

test('Every supported language supplies the current release notes without translation fallback', () => {
  for (const language of ['en', 'th', 'zh', 'ru']) {
    const translations = TRANSLATIONS[language];
    for (const [prefix, count] of [['updateChangelog', 4], ['updateFix', 6]]) {
      for (let i = 1; i <= count; i++) assert.ok(translations[prefix + i]?.trim(), language + ' ' + prefix + i);
    }
    assert.ok(translations.updateFix1.includes('Microsoft Edge'));
  }
});
