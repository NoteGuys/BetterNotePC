import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  Star, 
  Check, 
  Edit3, 
  FolderInput, 
  Trash2,
  Folder as DefaultFolderIcon
} from 'lucide-react';
import { 
  GOODNOTES_FOLDER_COLORS, 
  GOODNOTES_FOLDER_ICONS, 
  getFolderIconComponent 
} from '../../data/folderCustomization';

export const FolderCard = ({ 
  folder, 
  count = 0, 
  onClick, 
  onDelete, 
  onRename,
  onMove,
  onUpdateFolder,
  onToggleFavorite,
  onDropNotebook,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('color'); // 'color' or 'icon'
  const [isDragOver, setIsDragOver] = useState(false);
  const menuRef = useRef(null);

  // Close context menu on click outside
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

  const currentColor = folder.color || '#ef4444';
  const currentIconId = folder.icon || 'apple';
  const IconComp = getFolderIconComponent(currentIconId);

  // Thai Date formatting matching Goodnotes: "30 มิ.ย. 2569 เมื่อ9:23 AM"
  const formatThaiDate = (timestamp) => {
    if (!timestamp) return '30 มิ.ย. 2569 เมื่อ9:23 AM';
    const date = new Date(timestamp);
    const months = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear() + 543; // Buddhist Era
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day} ${month} ${year} เมื่อ${hours}:${minutes} ${ampm}`;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const notebookId = e.dataTransfer.getData('application/betternote-notebook') || e.dataTransfer.getData('text/plain');
    if (notebookId && onDropNotebook) {
      onDropNotebook(notebookId, folder.id);
    }
  };

  const handleSelectColor = (colHex) => {
    if (onUpdateFolder) {
      onUpdateFolder(folder.id, { color: colHex });
    }
  };

  const handleSelectIcon = (iconId) => {
    if (onUpdateFolder) {
      onUpdateFolder(folder.id, { icon: iconId });
    }
  };

  const handleFolderClick = (e) => {
    if (isSelectMode) {
      e.stopPropagation();
      if (onToggleSelect) onToggleSelect(folder.id, 'folder');
      return;
    }
    if (onClick) onClick(e);
  };

  return (
    <div 
      className={`bn-gn-folder-card ${isDragOver ? 'bn-folder-drag-over' : ''} ${isSelected ? 'bn-card-is-selected' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Goodnotes Curved Folder Shape Graphic */}
      <div 
        className="bn-gn-folder-graphic-wrapper"
        onClick={handleFolderClick}
        title={isSelectMode ? `คลิกเพื่อ${isSelected ? 'ยกเลิกเลือก' : 'เลือก'} "${folder.name}"` : `เปิดโฟลเดอร์ "${folder.name}" (${count} รายการ)`}
      >
        <div 
          className={`bn-gn-folder-graphic ${isSelected ? 'bn-card-selected' : ''}`}
          style={{ '--folder-bg': currentColor }}
        >
          {/* Top Folder Tab */}
          <div className="bn-gn-folder-tab" />

          {/* Folder Body */}
          <div className="bn-gn-folder-body">
            {/* Multi-Select Checkbox Badge (Top-Left) */}
            {isSelectMode && (
              <div 
                className={`bn-select-checkbox ${isSelected ? 'bn-select-checkbox-checked' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onToggleSelect) onToggleSelect(folder.id, 'folder');
                }}
                title={isSelected ? 'ยกเลิกการเลือก' : 'เลือกโฟลเดอร์นี้'}
              >
                {isSelected && <Check size={13} strokeWidth={3} />}
              </div>
            )}

            {/* Center Custom Icon */}
            <div className="bn-gn-folder-center-icon">
              {IconComp ? (
                <IconComp size={24} strokeWidth={1.8} className="text-white/85 drop-shadow-sm" />
              ) : (
                <DefaultFolderIcon size={24} className="text-white/80" />
              )}
            </div>

            {/* Top-Right Favorite Star */}
            {!isSelectMode && (
              <button 
                className={`bn-gn-folder-star-btn ${folder.isFavorite ? 'bn-star-active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onToggleFavorite) onToggleFavorite(folder.id);
                }}
                title={folder.isFavorite ? "นำออกจากรายการโปรด" : "เพิ่มเป็นรายการโปรด"}
              >
                <Star 
                  size={14} 
                  fill={folder.isFavorite ? '#f59e0b' : 'none'}
                  color={folder.isFavorite ? '#f59e0b' : 'rgba(255, 255, 255, 0.7)'}
                  className={folder.isFavorite ? 'bn-star-gold' : ''}
                />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Folder Name & Details Below */}
      <div className="bn-gn-folder-meta">
        <div 
          className="bn-gn-folder-title-row"
          onClick={handleFolderClick}
        >
          <span className="bn-gn-folder-name truncate" title={folder.name}>
            {folder.name}
          </span>
          {!isSelectMode && (
            <button
              className="bn-gn-chevron-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              title="ตัวเลือกโฟลเดอร์"
            >
              <ChevronDown size={14} />
            </button>
          )}
        </div>

        {/* Date Subtitle in Thai Format */}
        <div className="bn-gn-folder-subtext">
          {formatThaiDate(folder.updatedAt || folder.createdAt)}
        </div>
      </div>

      {/* Goodnotes Folder Context Menu Popup (Screenshots 4 & 5) */}
      {showMenu && (
        <div 
          ref={menuRef}
          className="bn-gn-context-menu"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Color & Icon Tabs Header */}
          <div className="bn-gn-menu-tabs">
            <button
              className={`bn-gn-menu-tab ${activeTab === 'color' ? 'bn-gn-tab-active' : ''}`}
              onClick={() => setActiveTab('color')}
            >
              สี
            </button>
            <button
              className={`bn-gn-menu-tab ${activeTab === 'icon' ? 'bn-gn-tab-active' : ''}`}
              onClick={() => setActiveTab('icon')}
            >
              ไอคอน
            </button>
          </div>

          {/* Tab Content 1: Color Picker (9 Colors) */}
          {activeTab === 'color' && (
            <div className="bn-gn-color-grid">
              {GOODNOTES_FOLDER_COLORS.map(col => {
                const isSelected = currentColor.toLowerCase() === col.hex.toLowerCase();
                return (
                  <button
                    key={col.id}
                    className={`bn-gn-color-swatch ${isSelected ? 'bn-gn-swatch-selected' : ''}`}
                    style={{ backgroundColor: col.hex }}
                    onClick={() => handleSelectColor(col.hex)}
                    title={col.label}
                  >
                    {isSelected && <Check size={14} className="text-white mx-auto stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Tab Content 2: Icon Grid (21 Icons) */}
          {activeTab === 'icon' && (
            <div className="bn-gn-icon-grid">
              {GOODNOTES_FOLDER_ICONS.map(ic => {
                const IconComponent = ic.icon;
                const isSelected = currentIconId === ic.id;
                return (
                  <button
                    key={ic.id}
                    className={`bn-gn-icon-btn ${isSelected ? 'bn-gn-icon-btn-selected' : ''}`}
                    onClick={() => handleSelectIcon(ic.id)}
                    title={ic.label}
                  >
                    <IconComponent size={20} strokeWidth={1.8} className="text-zinc-200" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Action Menu Items Below */}
          <div className="bn-gn-menu-actions">
            <button 
              className="bn-gn-action-item"
              onClick={() => {
                setShowMenu(false);
                if (onRename) onRename(folder);
              }}
            >
              <Edit3 size={16} />
              <span>ตั้งชื่อใหม่</span>
            </button>

            <button 
              className="bn-gn-action-item"
              onClick={() => {
                setShowMenu(false);
                if (onMove) onMove(folder);
              }}
            >
              <FolderInput size={16} />
              <span>ย้าย</span>
            </button>

            <div className="bn-gn-menu-divider" />

            <button 
              className="bn-gn-action-item bn-gn-action-danger"
              onClick={() => {
                setShowMenu(false);
                if (onDelete) onDelete(folder.id);
              }}
            >
              <Trash2 size={16} />
              <span>ย้ายไปยังถังขยะ</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
