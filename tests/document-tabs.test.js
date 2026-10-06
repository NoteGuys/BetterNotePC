import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_OPEN_NOTEBOOK_TABS, getDocumentTabLayout } from '../src/utils/documentTabs.js';
import { NOTEBOOK_COPY_LABELS, localizeNotebookCopyName } from '../src/utils/notebookNames.js';
import { TRANSLATIONS } from '../src/services/i18n.js';

for (const label of NOTEBOOK_COPY_LABELS) {
  test('Old copy chains display in ' + label + ' without altering their numeric suffixes', () => {
    const name = 'Physics(2) (สำเนา)(1) (Copy)';
    assert.equal(localizeNotebookCopyName(name, label), 'Physics(2) (' + label + ')(1) (' + label + ')');
    assert.equal(name, 'Physics(2) (สำเนา)(1) (Copy)');
    assert.equal(localizeNotebookCopyName('Test (副本)(12)', label), 'Test (' + label + ')(12)');
  });
}

test('Translation leaves ordinary notebook titles, embedded words and invalid inputs unchanged', () => {
  for (const name of ['Copy of Physics', 'สำเนา บทที่ 1', 'Experiment (Copy) notes', 'Test(Copy)', 'Test (Copy)(0)', 'Test (Copy)(01)', 'Test (Copy) final', 'My (สำเนา) thoughts', '', undefined, null]) {
    assert.equal(localizeNotebookCopyName(name, 'Копия'), name);
  }
  assert.equal(localizeNotebookCopyName('Test (สำเนา)', 'invalid'), 'Test (สำเนา)');
});

for (const locale of ['en', 'th', 'zh', 'ru']) {
  test('Notebook actions, copy suffix and tab accessibility labels are complete in ' + locale, () => {
    for (const key of ['rename', 'duplicate', 'exportPdf', 'move', 'moveToTrash', 'notebookCopySuffix', 'duplicateNotebookNotFound', 'duplicateSuccess', 'cannotDuplicate', 'closeTab', 'libraryTooltip', 'page', 'openedOnPage']) {
      assert.equal(typeof TRANSLATIONS[locale][key], 'string', key);
      assert.ok(TRANSLATIONS[locale][key].length, key);
    }
    assert.ok(NOTEBOOK_COPY_LABELS.includes(TRANSLATIONS[locale].notebookCopySuffix));
  });
}

test('Tab capacity is nine and short or empty tab lists have finite dimensions', () => {
  assert.equal(MAX_OPEN_NOTEBOOK_TABS, 9);
  for (const count of [0, 1, 3, 9, NaN, -1]) {
    for (const available of [0, 100, 600, 1200, NaN]) {
      const layout = getDocumentTabLayout(available, count);
      for (const key of ['activeWidth', 'inactiveWidth', 'gap', 'overlap']) assert.ok(Number.isFinite(layout[key]), key);
    }
  }
});

test('Every visible overlapping tab keeps a body, title area and unobstructed close button', () => {
  for (let count = 2; count <= 9; count++) {
    for (const available of [400, 650, 900, 1400]) {
      for (const hasActive of [true, false]) {
        const layout = getDocumentTabLayout(available, count, hasActive);
        for (const width of [layout.inactiveWidth, layout.activeWidth]) {
          assert.ok(width >= 80 && width <= 180);
          assert.ok(width - layout.overlap >= 60, 'Too little clickable surface');
        }
        const activeCount = hasActive ? 1 : 0;
        const occupied = layout.activeWidth * activeCount + layout.inactiveWidth * (count - activeCount) + layout.gap * (count - 1) - layout.overlap * (count - 1);
        assert.equal(layout.scrolls, occupied > available + 1);
        if (!layout.scrolls) assert.ok(occupied <= available + 1);
      }
    }
  }
});

test('Wide screens show full tabs and narrow screens retain readable minimum widths with scrolling', () => {
  const wide = getDocumentTabLayout(1800, 9);
  assert.equal(wide.stacked, false);
  assert.equal(wide.scrolls, false);
  const moderate = getDocumentTabLayout(650, 9);
  assert.equal(moderate.stacked, true);
  assert.equal(moderate.scrolls, false);
  const narrow = getDocumentTabLayout(300, 9);
  assert.equal(narrow.stacked, true);
  assert.equal(narrow.scrolls, true);
  assert.equal(narrow.inactiveWidth, 80);
});
