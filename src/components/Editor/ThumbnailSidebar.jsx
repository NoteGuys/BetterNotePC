import React, { useState, useEffect } from 'react';
import { X, Plus, FileText, Star, MoreVertical, Copy, Trash2 } from 'lucide-react';
import { useLanguage } from '../../services/i18n';

export const ThumbnailSidebar = ({
  pages,
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
  const activeItemRef = React.useRef(null);

  // Auto-scroll sidebar list to keep active page thumbnail visible (strictly container-scoped, zero window bleed)
  useEffect(() => {
    if (activeItemRef.current) {
      const container = activeItemRef.current.closest('.bn-thumbnail-list');
      if (container) {
        const itemTop = activeItemRef.current.offsetTop;
        const itemHeight = activeItemRef.current.offsetHeight;
        const cTop = container.scrollTop;
        const cHeight = container.clientHeight;

        if (itemTop < cTop) {
          container.scrollTo({ top: Math.max(0, itemTop - 12), behavior: 'smooth' });
        } else if (itemTop + itemHeight > cTop + cHeight) {
          container.scrollTo({ top: itemTop + itemHeight - cHeight + 12, behavior: 'smooth' });
        }
      }
    }
  }, [currentPageIndex]);

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

      <div className="bn-thumbnail-list">
        {pages.map((page, index) => {
          const isActive = index === currentPageIndex;
          const pageRatio = (page.pageWidth && page.pageHeight) 
            ? (page.pageWidth / page.pageHeight) 
            : (3 / 4);

          return (
            <div 
              key={page.id || index}
              ref={isActive ? activeItemRef : null}
              className={`bn-thumbnail-item ${isActive ? 'bn-thumbnail-item-active' : ''}`}
              onClick={() => onSelectPage(index)}
              title={`${t('goToPage', 'ข้ามไปหน้าที่')} ${index + 1}`}
              style={{ position: 'relative' }}
            >
              {/* Thumbnail page preview miniature with accurate page aspect ratio */}
              <div 
                className="bn-thumbnail-card"
                style={{ 
                  aspectRatio: `${pageRatio}`,
                  maxHeight: '260px'
                }}
              >
                {(page.thumbnailUrl || page.pdfPageImage) ? (
                  <img 
                    src={page.thumbnailUrl || page.pdfPageImage} 
                    alt={`${t('page', 'หน้า')} ${index + 1}`} 
                    className="bn-thumbnail-img"
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                      background: '#090d16'
                    }}
                  />
                ) : (
                  <div className="bn-thumbnail-paper-preview">
                    {/* Miniature simulated lines */}
                    <div className="bn-mini-lines">
                      <div className="bn-mini-line"></div>
                      <div className="bn-mini-line"></div>
                      <div className="bn-mini-line"></div>
                      <div className="bn-mini-line"></div>
                    </div>
                  </div>
                )}

                {/* Real-time Ink Strokes Overlay: renders user's handwriting live on thumbnail */}
                {page.strokes && page.strokes.length > 0 && (
                  <svg
                    viewBox={`0 0 ${page.pageWidth || 1200} ${page.pageHeight || 1600}`}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                      zIndex: 3
                    }}
                  >
                    {page.strokes.map((stroke, sIdx) => {
                      if (!stroke.points || stroke.points.length < 2) return null;
                      const pts = stroke.points;
                      let d = `M ${pts[0].x} ${pts[0].y}`;
                      for (let i = 1; i < pts.length; i++) {
                        d += ` L ${pts[i].x} ${pts[i].y}`;
                      }
                      return (
                        <path
                          key={sIdx}
                          d={d}
                          stroke={stroke.color || '#2563eb'}
                          strokeWidth={Math.max(4, (stroke.width || 4) * 1.5)}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={stroke.tool === 'highlighter' ? 0.38 : 1}
                        />
                      );
                    })}
                  </svg>
                )}

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
                  title={language === 'en' ? 'Manage this page (duplicate, delete, insert after)' : 'จัดการหน้านี้ (ทำสำเนา, ลบ, เพิ่มหน้าต่อ)'}
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

        {/* Add Page Button */}
        <button className="bn-thumbnail-add-btn" onClick={onAddPage} title={t('addPage', 'เพิ่มหน้าใหม่')}>
          <Plus size={20} />
          <span className="text-xs font-medium">{t('addPageShort', 'เพิ่มหน้า')}</span>
        </button>
      </div>
    </aside>
  );
};
