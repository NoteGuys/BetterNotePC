import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../services/i18n';

export const PageNavigation = ({
  currentPageIndex,
  totalPageCount,
  onPrevPage,
  onNextPage
}) => {
  const { t } = useLanguage();
  if (!totalPageCount || totalPageCount <= 0) return null;

  return (
    <div className="bn-page-nav-bar bn-page-nav-compact">
      <button 
        className="bn-page-nav-btn"
        onClick={onPrevPage}
        disabled={currentPageIndex <= 0}
        title={t('prevPage', 'หน้าก่อนหน้า')}
      >
        <ChevronLeft size={16} />
      </button>

      <span className="bn-page-nav-counter">
        {t('pageOf', 'หน้า {current} / {total}', { current: currentPageIndex + 1, total: totalPageCount })}
      </span>

      <button 
        className="bn-page-nav-btn"
        onClick={onNextPage}
        disabled={currentPageIndex >= totalPageCount - 1}
        title={t('nextPage', 'หน้าถัดไป')}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};
