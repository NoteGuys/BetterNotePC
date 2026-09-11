import React from 'react';
import { Home, X, FileText, ChevronDown } from 'lucide-react';

export const DocumentTabBar = ({
  tabs = [],
  activeTabId = null,
  onSelectTab,
  onCloseTab,
  onGoHome
}) => {
  return (
    <div className="bn-document-tab-bar" role="tablist">
      {/* 1. Leftmost Home / Library Button */}
      <button
        type="button"
        className={`bn-tab-home-btn ${activeTabId === null ? 'bn-tab-home-btn-active' : ''}`}
        onClick={onGoHome}
        title="คลังเอกสารทั้งหมด (Library)"
        aria-label="Home Library"
      >
        <Home size={17} />
      </button>

      {/* 2. Open Notebook Tabs List (Max 5 Stacked) */}
      <div className="bn-tab-list">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const displayPage = (tab.pageIndex !== undefined && tab.pageIndex !== null) 
            ? tab.pageIndex + 1 
            : 1;

          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              className={`bn-tab-item ${isActive ? 'bn-tab-item-active' : ''}`}
              onClick={() => onSelectTab(tab.id)}
              title={`${tab.title || 'ไม่มีชื่อ'} (หน้า ${displayPage})`}
            >
              {/* Document Icon */}
              <FileText size={14} className={isActive ? 'text-blue-400' : 'text-zinc-400'} />

              {/* Title with Ellipsis */}
              <span className="bn-tab-title">
                {tab.title || 'สมุดโน้ต'}
              </span>

              {/* Page Number Badge */}
              <span className="bn-tab-page-badge" title={`กำลังเปิดอยู่ที่หน้า ${displayPage}`}>
                {displayPage}
              </span>

              {/* Active Tab Indicator Chevron */}
              {isActive && (
                <ChevronDown size={13} className="text-white/60 ml-0.5 hidden sm:inline" />
              )}

              {/* Close Tab Button */}
              <button
                type="button"
                className="bn-tab-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                title={`ปิดแท็บ "${tab.title}"`}
                aria-label={`Close tab ${tab.title}`}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {/* 3. Drag Region & Window Spacer for Electron Frameless Buttons */}
      <div className="bn-tab-spacer" />
    </div>
  );
};
