// Layout only: opening, saving and closing notebooks remain in App.
export const MAX_OPEN_NOTEBOOK_TABS = 9;
const MIN_TAB_WIDTH = 80;
const COMFORTABLE_TAB_WIDTH = 132;
const MAX_TAB_WIDTH = 180;
const STACK_OVERLAP = 20;

export const getDocumentTabLayout = (availableWidth, tabCount, hasActiveTab = true) => {
  const count = Number.isFinite(tabCount) ? Math.max(0, Math.floor(tabCount)) : 0;
  const available = Number.isFinite(availableWidth) ? Math.max(0, availableWidth) : 0;
  if (!count) return { stacked: false, activeWidth: 0, inactiveWidth: 0, overlap: 0, gap: 3, scrolls: false };
  const normalWidth = Math.min(MAX_TAB_WIDTH, (available - 3 * (count - 1)) / count);
  if (normalWidth >= COMFORTABLE_TAB_WIDTH || count === 1) {
    const width = Math.max(MIN_TAB_WIDTH, normalWidth);
    return { stacked: false, activeWidth: width, inactiveWidth: width, overlap: 0, gap: 3, scrolls: width * count + 3 * (count - 1) > available + 1 };
  }
  const activeCount = hasActiveTab ? 1 : 0;
  const inactiveWidth = Math.max(MIN_TAB_WIDTH, Math.min(COMFORTABLE_TAB_WIDTH,
    (available + STACK_OVERLAP * (count - 1) - COMFORTABLE_TAB_WIDTH * activeCount) / (count - activeCount)));
  const needed = COMFORTABLE_TAB_WIDTH * activeCount + inactiveWidth * (count - activeCount) - STACK_OVERLAP * (count - 1);
  return { stacked: true, activeWidth: COMFORTABLE_TAB_WIDTH, inactiveWidth, overlap: STACK_OVERLAP, gap: 0, scrolls: needed > available + 1 };
};
