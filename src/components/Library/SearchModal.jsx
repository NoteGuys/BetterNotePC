import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  Folder as FolderIcon, 
  BookOpen, 
  FileText, 
  ChevronRight,
  Clock
} from 'lucide-react';
import { getFolderIconComponent } from '../../data/folderCustomization';

export const SearchModal = ({ 
  isOpen, 
  onClose, 
  folders = [], 
  notebooks = [], 
  onOpenNotebook, 
  onNavigateFolder 
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  // Search across ALL non-deleted folders and notebooks
  const activeFolders = folders.filter(f => !f.isDeleted);
  const activeNotebooks = notebooks.filter(nb => !nb.isDeleted);

  const matchedFolders = q 
    ? activeFolders.filter(f => f.name.toLowerCase().includes(q))
    : [];

  const matchedNotebooks = q
    ? activeNotebooks.filter(nb => nb.name.toLowerCase().includes(q))
    : [];

  // If no query, show recently updated items (up to 6)
  const recentNotebooks = [...activeNotebooks]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 6);

  const getFolderPath = (folderId) => {
    if (!folderId) return 'เอกสาร (หน้าหลัก)';
    const chain = [];
    let curId = folderId;
    while (curId) {
      const f = folders.find(item => item.id === curId);
      if (!f) break;
      chain.unshift(f.name);
      curId = f.parentId;
    }
    return chain.join(' › ');
  };

  return (
    <div className="bn-modal-backdrop" onClick={onClose}>
      <div 
        className="bn-modal-card bn-modal-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="bn-search-bar-top">
          <Search size={20} className="text-blue-400" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="ค้นหาเอกสาร สมุดโน้ต หรือโฟลเดอร์ทั้งหมด..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bn-search-input"
          />
          {query && (
            <button 
              className="bn-btn-icon"
              style={{ width: '24px', height: '24px' }}
              onClick={() => setQuery('')}
              title="ล้างข้อความ"
            >
              <X size={14} />
            </button>
          )}
          <span 
            className="bn-search-esc-tag"
            onClick={onClose}
          >
            Esc
          </span>
        </div>

        {/* Results List Pane */}
        <div className="bn-search-results-pane">
          {q ? (
            matchedFolders.length === 0 && matchedNotebooks.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#71717a' }}>
                <Search size={36} style={{ margin: '0 auto 10px auto', opacity: 0.35 }} />
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#d4d4d8', margin: 0 }}>
                  ไม่พบเอกสารที่ตรงกับ "{query}"
                </p>
                <p style={{ fontSize: '12px', color: '#71717a', margin: '4px 0 0 0' }}>
                  ลองค้นหาด้วยคำอื่น หรือชื่อโฟลเดอร์
                </p>
              </div>
            ) : (
              <>
                {/* Matched Folders */}
                {matchedFolders.length > 0 && (
                  <div>
                    <div className="bn-search-section-label">
                      <FolderIcon size={13} />
                      <span>โฟลเดอร์ ({matchedFolders.length})</span>
                    </div>
                    <div className="bn-search-list">
                      {matchedFolders.map(f => {
                        const IconComponent = getFolderIconComponent(f.icon) || FolderIcon;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            className="bn-search-entry-btn"
                            onClick={() => {
                              onNavigateFolder(f.id);
                              onClose();
                            }}
                          >
                            <div className="bn-search-entry-left">
                              <div 
                                className="bn-search-entry-icon"
                                style={{ backgroundColor: f.color || '#3b82f6' }}
                              >
                                <IconComponent size={17} className="text-white" />
                              </div>
                              <div className="bn-search-entry-text">
                                <div className="bn-search-entry-title">
                                  {f.name}
                                </div>
                                <div className="bn-search-entry-path">
                                  {getFolderPath(f.parentId)}
                                </div>
                              </div>
                            </div>
                            <ChevronRight size={15} style={{ color: '#71717a' }} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Matched Notebooks */}
                {matchedNotebooks.length > 0 && (
                  <div>
                    <div className="bn-search-section-label">
                      <BookOpen size={13} />
                      <span>สมุดโน้ต & PDF ({matchedNotebooks.length})</span>
                    </div>
                    <div className="bn-search-list">
                      {matchedNotebooks.map(nb => (
                        <button
                          key={nb.id}
                          type="button"
                          className="bn-search-entry-btn"
                          onClick={() => {
                            onOpenNotebook(nb.id);
                            onClose();
                          }}
                        >
                          <div className="bn-search-entry-left">
                            <div 
                              className="bn-search-entry-icon"
                              style={{ 
                                background: nb.isPdf 
                                  ? 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)' 
                                  : 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                                borderRadius: '7px'
                              }}
                            >
                              {nb.isPdf ? (
                                <FileText size={17} className="text-white" />
                              ) : (
                                <BookOpen size={17} className="text-white" />
                              )}
                            </div>
                            <div className="bn-search-entry-text">
                              <div className="bn-search-entry-title">
                                {nb.name}
                              </div>
                              <div className="bn-search-entry-path">
                                📁 {getFolderPath(nb.folderId)} • {nb.pageCount || 1} หน้า
                              </div>
                            </div>
                          </div>
                          <ChevronRight size={15} style={{ color: '#71717a' }} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )
          ) : (
            /* Recent Documents when no query */
            <div>
              <div className="bn-search-section-label">
                <Clock size={13} />
                <span>เอกสารที่เปิดใช้งานล่าสุด</span>
              </div>
              <div className="bn-search-list">
                {recentNotebooks.map(nb => (
                  <button
                    key={nb.id}
                    type="button"
                    className="bn-search-entry-btn"
                    onClick={() => {
                      onOpenNotebook(nb.id);
                      onClose();
                    }}
                  >
                    <div className="bn-search-entry-left">
                      <div 
                        className="bn-search-entry-icon"
                        style={{ 
                          background: nb.isPdf 
                            ? 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)' 
                            : 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                          borderRadius: '7px'
                        }}
                      >
                        {nb.isPdf ? (
                          <FileText size={17} className="text-white" />
                        ) : (
                          <BookOpen size={17} className="text-white" />
                        )}
                      </div>
                      <div className="bn-search-entry-text">
                        <div className="bn-search-entry-title">
                          {nb.name}
                        </div>
                        <div className="bn-search-entry-path">
                          📁 {getFolderPath(nb.folderId)}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={15} style={{ color: '#71717a' }} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
