import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PageNavigation = ({
  currentPageIndex,
  totalPageCount,
  onPrevPage,
  onNextPage
}) => {
  if (!totalPageCount || totalPageCount <= 0) return null;

  return (
    <div className="bn-page-nav-bar bn-page-nav-compact">
      <button 
        className="bn-page-nav-btn"
        onClick={onPrevPage}
        disabled={currentPageIndex <= 0}
        title="หน้าก่อนหน้า"
      >
        <ChevronLeft size={16} />
      </button>

      <span className="bn-page-nav-counter">
        หน้า {currentPageIndex + 1} / {totalPageCount}
      </span>

      <button 
        className="bn-page-nav-btn"
        onClick={onNextPage}
        disabled={currentPageIndex >= totalPageCount - 1}
        title="หน้าถัดไป"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};
