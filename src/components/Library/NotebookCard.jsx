import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  Star, 
  Edit3, 
  Copy, 
  Download, 
  FolderInput, 
  Share2, 
  Link, 
  Trash2, 
  User,
  FileText,
  Check
} from 'lucide-react';
import { NOTEBOOK_COVERS } from '../../data/covers';
import { getFirstPageByNotebookId } from '../../services/db';

export const NotebookCard = ({ 
  notebook, 
  folders = [], 
  onClick, 
  onDelete, 
  onDuplicate, 
  onExportPdf, 
  onMoveToFolder,
  onRename,
  onToggleFavorite,
  onShare,
  onCopyLink,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [firstPageThumbnail, setFirstPageThumbnail] = useState(notebook.pdfCoverSnapshot || null);
  const menuRef = useRef(null);

  const cover = NOTEBOOK_COVERS.find(c => c.id === notebook.coverId) || NOTEBOOK_COVERS[0];

  useEffect(() => {
    let isMounted = true;
    if (notebook.pdfCoverSnapshot) {
      setFirstPageThumbnail(notebook.pdfCoverSnapshot);
      return;
    }

    if (!notebook.isPdf) return;

    const loadPageThumbnail = async () => {
      try {
        const firstPage = await getFirstPageByNotebookId(notebook.id);
        if (isMounted && firstPage) {
          const thumb = firstPage.thumbnailUrl || firstPage.pdfPageImage;
          if (thumb) {
            setFirstPageThumbnail(thumb);
          }
        }
      } catch (err) {
        console.warn('Could not load first page thumbnail:', err);
      }
    };

    loadPageThumbnail();
    return () => { isMounted = false; };
  }, [notebook.id, notebook.pdfCoverSnapshot, notebook.isPdf]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Thai Date formatting matching Goodnotes: "1 ก.ค. 2569 เมื่อ1:07 PM"
  const formatThaiDate = (timestamp) => {
    if (!timestamp) return '1 ก.ค. 2569 เมื่อ1:07 PM';
    const date = new Date(timestamp);
    const months = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear() + 543;
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day} ${month} ${year} เมื่อ${hours}:${minutes} ${ampm}`;
  };

  const handleDragStart = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', notebook.id);
    e.dataTransfer.setData('application/betternote-notebook', notebook.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleCardClick = (e) => {
    if (isSelectMode) {
      e.stopPropagation();
      if (onToggleSelect) onToggleSelect(notebook.id, 'notebook');
      return;
    }
    if (onClick) onClick(e);
  };

  return (
    <div 
      className={`bn-gn-notebook-card ${isDragging ? 'opacity-50 scale-95' : ''} ${isSelected ? 'bn-card-is-selected' : ''}`}
      draggable={!isSelectMode}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Realistic 3D Book Cover with Pages on the Right Edge */}
      <div 
        className="bn-gn-book-wrapper"
        onClick={handleCardClick}
        title={isSelectMode ? `คลิกเพื่อ${isSelected ? 'ยกเลิกเลือก' : 'เลือก'} "${notebook.name}"` : `คลิกเปิดสมุด "${notebook.name}" (${notebook.pageCount || 1} หน้า)`}
      >
        {/* Simulated White Paper Pages Edge (Goodnotes 3D Look) */}
        <div className="bn-gn-book-paper-edge" />

        {/* Notebook Main Cover */}
        <div 
          className={`bn-gn-book-cover ${isSelected ? 'bn-card-selected' : ''}`}
          style={{ 
            background: notebook.isPdf 
              ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' 
              : (cover.gradient || '#2563eb')
          }}
        >
          {/* Left Spine Shadow */}
          <div className="bn-gn-book-spine" />

          {/* Multi-Select Checkbox Badge (Top-Left) */}
          {isSelectMode && (
            <div 
              className={`bn-select-checkbox ${isSelected ? 'bn-select-checkbox-checked' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleSelect) onToggleSelect(notebook.id, 'notebook');
              }}
              title={isSelected ? 'ยกเลิกการเลือก' : 'เลือกสมุดเล่มนี้'}
            >
              {isSelected && <Check size={13} strokeWidth={3} />}
            </div>
          )}

          {/* Top-Right Favorite Star Button */}
          {!isSelectMode && (
            <button 
              className={`bn-gn-book-star-btn ${notebook.isFavorite ? 'bn-star-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleFavorite) onToggleFavorite(notebook.id);
              }}
              title={notebook.isFavorite ? "นำออกจากรายการโปรด" : "เพิ่มเป็นรายการโปรด"}
            >
              <Star 
                size={14} 
                fill={notebook.isFavorite ? '#f59e0b' : 'none'}
                color={notebook.isFavorite ? '#f59e0b' : 'rgba(255, 255, 255, 0.7)'}
                className={notebook.isFavorite ? 'bn-star-gold' : ''}
              />
            </button>
          )}

          {/* Book Cover Content / First Page Thumbnail */}
          <div className="bn-gn-book-content">
            {firstPageThumbnail ? (
              <div className="bn-gn-firstpage-preview">
                <img 
                  src={firstPageThumbnail} 
                  alt={notebook.name} 
                  className="bn-gn-firstpage-img" 
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-2 text-center h-full">
                {notebook.isPdf ? (
                  <FileText size={24} className="text-red-400 mb-1 drop-shadow" />
                ) : null}
                <span 
                  className="font-bold text-xs leading-snug line-clamp-3"
                  style={{ color: cover.textColor || '#ffffff' }}
                >
                  {notebook.name}
                </span>
              </div>
            )}
          </div>

          {/* Bottom Center Circular User Avatar Badge (Goodnotes Style) */}
          <div className="bn-gn-book-avatar-badge" title="ผู้สร้างเอกสาร">
            <div className="bn-gn-avatar-circle">
              <User size={13} className="text-white" />
              <div className="bn-gn-avatar-check">✓</div>
            </div>
          </div>
        </div>
      </div>

      {/* Title & Date Details Below Cover */}
      <div className="bn-gn-book-meta">
        <div 
          className="bn-gn-book-title-row"
          onClick={handleCardClick}
        >
          <span className="bn-gn-book-name truncate" title={notebook.name}>
            {notebook.name}
          </span>
          {!isSelectMode && (
            <button
              className="bn-gn-chevron-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              title="ตัวเลือกสมุดบันทึก"
            >
              <ChevronDown size={14} />
            </button>
          )}
        </div>

        {/* Date in Thai Format */}
        <div className="bn-gn-book-subtext">
          {formatThaiDate(notebook.updatedAt || notebook.createdAt)}
        </div>
      </div>

      {/* Goodnotes Notebook Context Menu (Screenshot 3) */}
      {showMenu && (
        <div 
          ref={menuRef}
          className="bn-gn-context-menu bn-gn-notebook-menu"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Rename */}
          <button 
            className="bn-gn-action-item"
            onClick={() => {
              setShowMenu(false);
              if (onRename) onRename(notebook);
            }}
          >
            <Edit3 size={16} />
            <span>ตั้งชื่อใหม่</span>
          </button>

          {/* 2. Duplicate */}
          <button 
            className="bn-gn-action-item"
            onClick={() => {
              setShowMenu(false);
              if (onDuplicate) onDuplicate(notebook.id);
            }}
          >
            <Copy size={16} />
            <span>ทำสำเนา</span>
          </button>

          {/* 3. Export PDF */}
          <button 
            className="bn-gn-action-item"
            onClick={() => {
              setShowMenu(false);
              if (onExportPdf) onExportPdf(notebook);
            }}
          >
            <Download size={16} />
            <span>นำออกเป็น PDF</span>
          </button>

          {/* 4. Move */}
          <button 
            className="bn-gn-action-item"
            onClick={() => {
              setShowMenu(false);
              if (onMoveToFolder) onMoveToFolder(notebook);
            }}
          >
            <FolderInput size={16} />
            <span>ย้าย</span>
          </button>

          {/* 5. Share */}
          <button 
            className="bn-gn-action-item"
            onClick={() => {
              setShowMenu(false);
              if (onShare) onShare(notebook);
            }}
          >
            <Share2 size={16} />
            <span>แชร์...</span>
          </button>

          {/* 6. Copy Link */}
          <button 
            className="bn-gn-action-item"
            onClick={() => {
              setShowMenu(false);
              if (onCopyLink) onCopyLink(notebook);
            }}
          >
            <Link size={16} />
            <span>คัดลอกลิงก์</span>
          </button>

          <div className="bn-gn-menu-divider" />

          {/* 7. Move to Trash */}
          <button 
            className="bn-gn-action-item bn-gn-action-danger"
            onClick={() => {
              setShowMenu(false);
              if (onDelete) onDelete(notebook.id);
            }}
          >
            <Trash2 size={16} />
            <span>ย้ายไปยังถังขยะ</span>
          </button>
        </div>
      )}
    </div>
  );
};
