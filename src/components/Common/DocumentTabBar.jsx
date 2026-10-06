import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Home, X, FileText, ChevronDown } from 'lucide-react';
import { LocalSaveStatus } from './LocalSaveStatus';
import { useLanguage } from '../../services/i18n';
import { getDocumentTabLayout } from '../../utils/documentTabs';
import { localizeNotebookCopyName } from '../../utils/notebookNames';

export const DocumentTabBar = ({
  tabs = [],
  activeTabId = null,
  onSelectTab,
  onCloseTab,
  onGoHome
}) => {
  const { t } = useLanguage();
  const listRef = useRef(null);
  const tabRefs = useRef(new Map());
  const [availableWidth, setAvailableWidth] = useState(0);
  const hasActiveTab = tabs.some(tab => tab.id === activeTabId);
  const layout = useMemo(() => getDocumentTabLayout(availableWidth, tabs.length, hasActiveTab),
    [availableWidth, tabs.length, hasActiveTab]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let frame = 0;
    const measure = () => setAvailableWidth(previous => list.clientWidth === previous ? previous : list.clientWidth);
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    observer?.observe(list);
    window.addEventListener('resize', schedule);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  useLayoutEffect(() => {
    const list = listRef.current;
    const active = tabRefs.current.get(activeTabId);
    if (!list || !active) return;
    // Scroll this strip only; scrolling the notebook would move the writing surface.
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < list.scrollLeft) list.scrollLeft = left;
    else if (right > list.scrollLeft + list.clientWidth) list.scrollLeft = right - list.clientWidth;
  }, [activeTabId, availableWidth, tabs.length, layout]);

  const handleTabKeyDown = (event, index) => {
    if (event.target !== event.currentTarget) return;
    let target = index;
    if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = tabs.length - 1;
    else if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelectTab(tabs[target].id);
    tabRefs.current.get(tabs[target].id)?.focus({ preventScroll: true });
  };

  return (
    <div className="bn-document-tab-bar" role="tablist">
      <button
        type="button"
        className={'bn-tab-home-btn ' + (activeTabId === null ? 'bn-tab-home-btn-active' : '')}
        onClick={onGoHome}
        title={t('libraryTooltip')}
        aria-label={t('libraryTooltip')}
      >
        <Home size={17} />
      </button>
      <div ref={listRef} className={'bn-tab-list ' + (layout.stacked ? 'bn-tabs-stacked' : '')}
        style={{ gap: layout.gap, '--bn-tab-overlap': layout.overlap + 'px' }}>
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const displayPage = (tab.pageIndex ?? 0) + 1;
          const displayTitle = localizeNotebookCopyName(tab.title || t('untitled'), t('notebookCopySuffix'));
          const width = isActive ? layout.activeWidth : layout.inactiveWidth;
          const label = displayTitle + ' (' + t('page') + ' ' + displayPage + ')';
          return (
            <div
              key={tab.id}
              ref={element => element ? tabRefs.current.set(tab.id, element) : tabRefs.current.delete(tab.id)}
              role="tab"
              tabIndex={isActive || (!hasActiveTab && index === 0) ? 0 : -1}
              aria-selected={isActive}
              aria-label={label}
              data-notebook-id={tab.id}
              className={['bn-tab-item', isActive ? 'bn-tab-item-active' : '', width < 120 ? 'bn-tab-item-compact' : ''].join(' ')}
              style={{ width, flexBasis: width, marginLeft: index ? -layout.overlap : 0,
                zIndex: isActive ? 100 : index + 1,
                '--bn-tab-tail': layout.stacked && index < tabs.length - 1 ? layout.overlap + 'px' : '0px' }}
              onClick={() => onSelectTab(tab.id)}
              onKeyDown={event => handleTabKeyDown(event, index)}
              title={label}
            >
              <FileText size={14} className={'bn-tab-document-icon ' + (isActive ? 'text-blue-400' : 'text-zinc-400')} />
              <span className="bn-tab-title">{displayTitle}</span>
              <span className="bn-tab-page-badge" title={t('openedOnPage') + ' ' + displayPage}>{displayPage}</span>
              {isActive && <ChevronDown size={13} className="bn-tab-chevron text-white/60" />}
              <button
                type="button"
                className="bn-tab-close-btn"
                onClick={event => { event.stopPropagation(); onCloseTab(tab.id); }}
                title={t('closeTab') + ' "' + displayTitle + '"'}
                aria-label={t('closeTab') + ' ' + displayTitle}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="bn-tab-spacer" />
      <LocalSaveStatus />
    </div>
  );
};
