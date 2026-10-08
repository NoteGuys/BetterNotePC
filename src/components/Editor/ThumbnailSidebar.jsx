import React, { useState, useEffect } from 'react';
import { X, Plus, FileText, Star, MoreVertical, Copy, Trash2 } from 'lucide-react';
import { useLanguage } from '../../services/i18n';
import { thumbnailLayout, thumbnailWindow } from '../../utils/thumbnailWindow.js';
import { requestPagePreview, cachedPagePreview } from '../../services/pagePreviewService.js';
import { appCacheService } from '../../services/appCacheService.js';

const PagePreview = React.memo(({ page, templateId, label }) => {
  const [preview, setPreview] = useState(() => cachedPagePreview(page, templateId)), [epoch, setEpoch] = useState(0);
  useEffect(() => appCacheService.subscribeClear(() => { setPreview(null); setEpoch(value => value + 1); }), []);
  useEffect(() => {
    const cached = cachedPagePreview(page, templateId);
    if (cached) setPreview(cached);
    return requestPagePreview(page, templateId, setPreview);
  }, [page, templateId, epoch]);
  return preview ? <img src={preview} alt={label} className="bn-thumbnail-img" /> : <div className="bn-thumbnail-paper-preview"><div className="bn-mini-lines">{[0,1,2,3].map(i => <div key={i} className="bn-mini-line" />)}</div></div>;
});


export const ThumbnailSidebar = ({
  pages,
  templateId,
  currentPageIndex,
  onSelectPage,
  onToggleFavoritePage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onInsertPageAfter,
  onInsertAfter,
  onClose
}) => {
  const { t, language } = useLanguage();
  const [menuOpenIndex, setMenuOpenIndex] = useState(null);

  const handleInsert = onInsertPageAfter || onInsertAfter;
  const listRef = React.useRef(null), frameRef = React.useRef(null);
  const [viewport, setViewport] = useState({ top: 0, height: 700, width: 208 });
  const offsets = React.useMemo(() => thumbnailLayout(pages, viewport.width), [pages, viewport.width]);
  const range = thumbnailWindow(offsets, Math.max(0, viewport.top - 16), viewport.height);
  const updateViewport = () => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const list = listRef.current;
      if (list) setViewport({ top: list.scrollTop, height: list.clientHeight, width: Math.max(1, list.clientWidth - 32) });
    });
  };
  useEffect(() => {
    const observer = new ResizeObserver(updateViewport);
    if (listRef.current) observer.observe(listRef.current);
    updateViewport();
    return () => { observer.disconnect(); if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); frameRef.current = null; };
  }, []);
  useEffect(() => {
    const list = listRef.current;
    if (!list || currentPageIndex < 0 || currentPageIndex >= pages.length) return;
    const top = 16 + offsets[currentPageIndex], bottom = offsets[currentPageIndex + 1];
    if (top < list.scrollTop) list.scrollTop = Math.max(0, top - 12);
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 12;
    updateViewport();
  }, [currentPageIndex, pages.length, viewport.width]);
  useEffect(() => { if (menuOpenIndex !== null && (menuOpenIndex < range.start || menuOpenIndex >= range.end)) setMenuOpenIndex(null); }, [range.start, range.end, menuOpenIndex]);

  // Close popover when clicking anywhere else outside the menu
  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (!e.target.closest('.bn-thumbnail-more-btn') && !e.target.closest('.bn-thumbnail-menu-popover')) {
        setMenuOpenIndex(null);
      }
    };
    window.addEventListener('pointerdown', handleDocumentClick);
    return () => window.removeEventListener('pointerdown', handleDocumentClick);
  }, []);

  return (
    <aside className="bn-thumbnail-sidebar">
      <div className="bn-thumbnail-sidebar-header">
        <div className="flex items-center gap-2">
          <FileText size={17} className="text-blue-500" />
          <h3 className="bn-thumbnail-title">{t('pageOverview', 'ภาพรวมหน้า')} ({pages.length})</h3>
        </div>
        <button className="bn-thumbnail-close-btn" onClick={onClose} title={t('closeSidebar', 'ปิดแถบนำทาง')}>
          <X size={18} />
        </button>
      </div>

      <div className="bn-thumbnail-list" ref={listRef} onScroll={updateViewport}>
        {range.start > 0 && <div aria-hidden="true" style={{ height: offsets[range.start] - 16, flexShrink: 0 }} />}
        {pages.slice(range.start, range.end).map((page, visibleIndex) => {
          const index = range.start + visibleIndex;
          const isActive = index === currentPageIndex;
          const pageRatio = (page.pageWidth && page.pageHeight) 
            ? (page.pageWidth / page.pageHeight) 
            : (3 / 4);

          return (
            <div 
              key={page.id || index}
              data-page-index={index}
              className={`bn-thumbnail-item ${isActive ? 'bn-thumbnail-item-active' : ''}`}
              onClick={() => onSelectPage(index)}
              title={`${t('goToPage', 'ข้ามไปหน้าที่')} ${index + 1}`}
              style={{ position: 'relative', flexShrink: 0 }}
            >
              {/* Thumbnail page preview miniature with accurate page aspect ratio */}
              <div 
                className="bn-thumbnail-card"
                style={{ 
                  aspectRatio: `${pageRatio}`,
                  maxHeight: '260px'
                }}
              >
                <PagePreview page={page} templateId={templateId} label={t("page", "หน้า") + " " + (index + 1)} />

                {/* Star Favorite Button */}
                <button
                  type="button"
                  className={`bn-thumbnail-star-btn ${page.isFavorite ? 'bn-thumbnail-star-active' : ''}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleFavoritePage) {
                      onToggleFavoritePage(index);
                    }
                  }}
                  title={page.isFavorite ? t('unstarPage', 'ยกเลิกรายการโปรดหน้านี้') : t('starPage', 'เพิ่มหน้านี้ในรายการโปรด')}
                >
                  <Star 
                    size={13} 
                    fill={page.isFavorite ? '#f59e0b' : 'none'} 
                    color={page.isFavorite ? '#f59e0b' : 'currentColor'}
                    className={page.isFavorite ? 'bn-star-gold' : ''}
                  />
                </button>

                {/* 3-Dots More Options Button */}
                <button
                  type="button"
                  className="bn-thumbnail-more-btn"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenIndex(menuOpenIndex === index ? null : index);
                  }}
                  title={t('managePageTooltip', 'จัดการหน้านี้ (ทำสำเนา, ลบ, เพิ่มหน้าต่อ)')}
                >
                  <MoreVertical size={14} />
                </button>

                <div className="bn-thumbnail-number">{index + 1}</div>
              </div>

              {/* 3-Dots Popover Menu (Positioned on .bn-thumbnail-item outside the card to prevent overflow clipping) */}
              {menuOpenIndex === index && (
                <div 
                  className="bn-thumbnail-menu-popover"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="bn-thumbnail-menu-item"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenIndex(null);
                      if (onDuplicatePage) onDuplicatePage(index);
                    }}
                  >
                    <Copy size={13} className="text-blue-400" />
                    <span>{t('duplicatePage', 'ทำสำเนาหน้านี้ (Duplicate)')}</span>
                  </button>

                  <button
                    type="button"
                    className="bn-thumbnail-menu-item"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenIndex(null);
                      if (handleInsert) handleInsert(index);
                    }}
                  >
                    <Plus size={13} className="text-emerald-400" />
                    <span>{t('insertPageAfter', 'เพิ่มหน้าต่อจากหน้านี้')}</span>
                  </button>

                  {pages.length > 1 && (
                    <button
                      type="button"
                      className="bn-thumbnail-menu-item bn-menu-item-danger"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenIndex(null);
                        if (onDeletePage) onDeletePage(index);
                      }}
                    >
                      <Trash2 size={13} className="text-red-400" />
                      <span>{t('deletePage', 'ลบหน้านี้')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {range.end < pages.length && <div aria-hidden="true" style={{ height: offsets.at(-1) - offsets[range.end] - 16, flexShrink: 0 }} />}
        {/* Add Page Button */}
        <button className="bn-thumbnail-add-btn" onClick={onAddPage} title={t('addPage', 'เพิ่มหน้าใหม่')}>
          <Plus size={20} />
          <span className="text-xs font-medium">{t('addPageShort', 'เพิ่มหน้า')}</span>
        </button>
      </div>
    </aside>
  );
};
