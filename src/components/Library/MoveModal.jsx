import React, { useState, useEffect } from 'react';
import { X, FolderInput, Folder, Home, Check } from 'lucide-react';
import { useLanguage } from '../../services/i18n';

export const MoveModal = ({ 
  isOpen, 
  item = null, 
  items = null, // Array of items for batch move: [{ id, name, type, folderId, parentId }]
  itemType = 'notebook', // 'notebook' or 'folder'
  folders = [], 
  onClose, 
  onConfirm 
}) => {
  const { t, language } = useLanguage();
  // Determine if single or batch (treat any provided array as batch, even with 1 selected item)
  const isBatch = Array.isArray(items);
  const moveItems = isBatch ? items : (item ? [item] : []);
  const singleItem = moveItems[0] || null;
  const singleItemType = singleItem?.type || itemType;

  const currentParentId = isBatch 
    ? null 
    : (singleItemType === 'notebook' ? (singleItem?.folderId ?? null) : (singleItem?.parentId ?? null));

  const [selectedFolderId, setSelectedFolderId] = useState(currentParentId);

  useEffect(() => {
    if (isOpen) {
      setSelectedFolderId(currentParentId);
    }
  }, [isOpen, singleItem?.id, currentParentId]);

  if (!isOpen || moveItems.length === 0) return null;

  // Set of all folder IDs that are being moved
  const movingFolderIds = new Set(
    moveItems
      .filter(it => (it.type || itemType) === 'folder')
      .map(it => it.id)
  );

  // Helper to check if a folder is a descendant of any moving folder
  const isDescendantOfAnyMovingFolder = (folderId) => {
    let curr = folders.find(f => f.id === folderId);
    while (curr && curr.parentId) {
      if (movingFolderIds.has(curr.parentId)) return true;
      curr = folders.find(f => f.id === curr.parentId);
    }
    return false;
  };

  // Valid folders exclude any folder being moved and any of their descendants
  const validFolders = folders.filter(f => {
    if (f.isDeleted) return false;
    if (movingFolderIds.has(f.id)) return false;
    if (isDescendantOfAnyMovingFolder(f.id)) return false;
    return true;
  });

  const handleConfirm = () => {
    if (isBatch) {
      onConfirm(moveItems, selectedFolderId);
    } else if (singleItem) {
      onConfirm(singleItem.id, selectedFolderId);
    }
    onClose();
  };

  const modalTitle = isBatch
    ? (language === 'en' ? `Move ${moveItems.length} selected items` : `ย้าย ${moveItems.length} รายการที่เลือก`)
    : (language === 'en'
        ? `Move ${singleItemType === 'folder' ? 'Folder' : 'Notebook'} "${singleItem?.name || ''}"`
        : `ย้าย ${singleItemType === 'folder' ? 'โฟลเดอร์' : 'สมุดโน้ต'} "${singleItem?.name || ''}"`);

  return (
    <div className="bn-move-overlay" onClick={onClose}>
      <div className="bn-move-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bn-move-header">
          <div className="bn-move-header-left">
            <div className="bn-move-icon-badge">
              <FolderInput size={20} />
            </div>
            <div>
              <h3 className="bn-move-title">{modalTitle}</h3>
              <p className="bn-move-subtitle">{t('selectDestinationFolder', 'เลือกโฟลเดอร์ปลายทางที่ต้องการย้ายไป')}</p>
            </div>
          </div>
          <button className="bn-move-close-btn" onClick={onClose} title={t('close', 'ปิด')}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Folder List */}
        <div className="bn-move-body">
          <div className="bn-move-list">
            {/* Root / Main level */}
            <button
              type="button"
              className={`bn-move-item ${selectedFolderId === null ? 'bn-move-item-active' : ''}`}
              onClick={() => setSelectedFolderId(null)}
            >
              <div className="bn-move-item-icon-wrap bn-move-root-icon">
                <Home size={17} />
              </div>
              <div className="bn-move-item-info">
                <div className="bn-move-item-row">
                  <span className="bn-move-item-name">{t('homeAllDocs', 'หน้าหลัก (เอกสารทั้งหมด)')}</span>
                  {!isBatch && currentParentId === null && (
                    <span className="bn-move-current-badge">{t('currentLocation', 'ตำแหน่งปัจจุบัน')}</span>
                  )}
                </div>
                <span className="bn-move-item-desc">{t('moveToRootDesc', 'ย้ายออกมาไว้ที่ชั้นนอกสุด')}</span>
              </div>
              {selectedFolderId === null && (
                <div className="bn-move-check-circle">
                  <Check size={14} />
                </div>
              )}
            </button>

            {/* Subfolders */}
            {validFolders.map(f => {
              const isSelected = selectedFolderId === f.id;
              const isCurrent = !isBatch && currentParentId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`bn-move-item ${isSelected ? 'bn-move-item-active' : ''}`}
                  onClick={() => setSelectedFolderId(f.id)}
                >
                  <div 
                    className="bn-move-item-icon-wrap" 
                    style={{ backgroundColor: `${f.color || '#3b82f6'}22`, color: f.color || '#3b82f6' }}
                  >
                    <Folder size={17} />
                  </div>
                  <div className="bn-move-item-info">
                    <div className="bn-move-item-row">
                      <span className="bn-move-item-name">{f.name}</span>
                      {isCurrent && (
                        <span className="bn-move-current-badge">{t('currentLocation', 'ตำแหน่งปัจจุบัน')}</span>
                      )}
                    </div>
                    <span className="bn-move-item-desc">{t('folder', 'โฟลเดอร์')}</span>
                  </div>
                  {isSelected && (
                    <div className="bn-move-check-circle">
                      <Check size={14} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bn-move-footer">
          <button
            type="button"
            className="bn-move-btn-cancel"
            onClick={onClose}
          >
            {t('cancel', 'ยกเลิก')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="bn-move-btn-confirm"
          >
            {t('moveHere', 'ย้ายมาที่นี่')}
          </button>
        </div>
      </div>
    </div>
  );
};
