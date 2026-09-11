import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Folder,
  Folder as FolderIcon,
  FolderInput,
  Star,
  Check,
  CheckCircle,
  CheckSquare,
  Square,
  Copy,
  BookOpen, 
  ArrowLeft,
  Settings,
  Cloud,
  RotateCcw,
  Trash2,
  Share2,
  FileText,
  X,
  Store,
  ChevronDown,
  Upload,
  Download,
  HardDrive,
  FileCode2,
  FolderSync,
  ShieldCheck
} from 'lucide-react';
import { StudioSidebar } from './StudioSidebar';
import { FolderCard } from './FolderCard';
import { NotebookCard } from './NotebookCard';
import { NewItemModal } from './NewItemModal';
import { PdfImportModal } from './PdfImportModal';
import { RenameModal } from './RenameModal';
import { MoveModal } from './MoveModal';
import { SearchModal } from './SearchModal';
import { SettingsModal } from './SettingsModal';
import BackupStatusModal from './BackupStatusModal';
import { getAllFavoritePages, savePage } from '../../services/db';
import { importBnoteFile } from '../../services/fileSystemService';

export const LibraryView = ({
  folders = [],
  notebooks = [],
  currentFolderId,
  folderChain = [],
  onNavigateFolder,
  onOpenNotebook,
  onCreateFolder,
  onUpdateFolder,
  onCreateNotebook,
  onUpdateNotebook,
  onDuplicateNotebook,
  onMoveNotebookToFolder,
  onExportNotebookPdf,
  onDeleteFolder,
  onDeleteNotebook,
  onImportPdfSuccess,
  onImportBnoteSuccess,
  onOpenDriveModal,
  isDriveConnected,
  isSyncing,
  currentTheme,
  onToggleTheme,
  onSelectTheme,
  onTriggerAutoSync,
  onExportBackup,
  onImportBackup
}) => {
  const [activeView, setActiveView] = useState('documents'); // 'documents', 'favorites', 'shared', 'marketplace', 'trash'
  const [favTab, setFavTab] = useState('all'); // 'all', 'documents', 'pages'
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState('name-asc'); // 'name-asc', 'name-desc', 'number-asc', 'number-desc', 'date-desc', 'date-asc'
  const [favoritePages, setFavoritePages] = useState([]);
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isBackupStatusModalOpen, setIsBackupStatusModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const backupFileInputRef = React.useRef(null);
  const bnoteFileInputRef = React.useRef(null);
  const sortMenuRef = React.useRef(null);
  const newMenuRef = React.useRef(null);

  // Multi-Select Batch State
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [batchMoveItems, setBatchMoveItems] = useState(null);

  // Cloud Backup Auto-Detection on Empty Library (for seamless new machine migration)
  const [cloudBackupDetected, setCloudBackupDetected] = useState(null);
  const [isAutoRestoring, setIsAutoRestoring] = useState(false);

  React.useEffect(() => {
    let isCancelled = false;
    async function checkCloudBackupsOnEmpty() {
      if (notebooks.length === 0) {
        try {
          const { autoBackupService } = await import('../../services/autoBackupService');
          const scan = await autoBackupService.scanAvailableBackups();
          if (!isCancelled && scan && scan.success && scan.count > 0) {
            setCloudBackupDetected(scan);
          }
        } catch (_) {}
      } else if (notebooks.length > 0) {
        setCloudBackupDetected(null);
      }
    }
    checkCloudBackupsOnEmpty();
    return () => { isCancelled = true; };
  }, [notebooks.length]);

  const handleExecuteCloudRestore = async () => {
    setIsAutoRestoring(true);
    try {
      const { autoBackupService } = await import('../../services/autoBackupService');
      const res = await autoBackupService.restoreFromCloudBackup(cloudBackupDetected?.folder);
      if (res.success) {
        setCloudBackupDetected(null);
        window.location.reload();
      } else {
        alert('กู้คืนไม่สำเร็จ: ' + (res.reason || 'ไม่พบไฟล์สำรอง'));
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการกู้คืน: ' + err.message);
    } finally {
      setIsAutoRestoring(false);
    }
  };

  // Clear selection on view or folder change
  React.useEffect(() => {
    setSelectedItemIds(new Set());
    setIsSelectMode(false);
  }, [activeView, currentFolderId]);

  // Load favorite pages
  const loadFavorites = React.useCallback(async () => {
    try {
      const favs = await getAllFavoritePages();
      setFavoritePages(Array.isArray(favs) ? favs : []);
    } catch (err) {
      console.warn('Could not load favorite pages:', err);
      setFavoritePages([]);
    }
  }, []);

  React.useEffect(() => {
    if (activeView === 'favorites') {
      loadFavorites();
    }
  }, [loadFavorites, activeView]);

  const handleToggleFavoritePage = async (page) => {
    try {
      const updated = { ...page, isFavorite: !page.isFavorite, updatedAt: Date.now() };
      await savePage(updated);
      await loadFavorites();
      showToast(page.isFavorite ? 'นำหน้าออกจากรายการโปรดแล้ว' : 'เพิ่มหน้าในรายการโปรดแล้ว ⭐');
    } catch (err) {
      console.error('Failed to toggle page favorite:', err);
    }
  };

  // Modals for Rename and Move
  const [renameItem, setRenameItem] = useState(null); // { item, type: 'folder' | 'notebook' }
  const [moveItem, setMoveItem] = useState(null); // { item, type: 'folder' | 'notebook' }

  // Keyboard shortcut Ctrl+K / Cmd+K for global search
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Dynamic outside click listener: only listens when a menu is actually open
  React.useEffect(() => {
    if (!showSortMenu && !showNewMenu) return;

    const handleOutsideClick = (e) => {
      if (showSortMenu && sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setShowSortMenu(false);
      }
      if (showNewMenu && newMenuRef.current && !newMenuRef.current.contains(e.target)) {
        setShowNewMenu(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handleOutsideClick);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [showSortMenu, showNewMenu]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Upload/Import .bnote file handler
  const handleBnoteFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('กำลังนำเข้าไฟล์ .bnote...');
      const importedNb = await importBnoteFile(file, currentFolderId);
      if (onImportBnoteSuccess) {
        onImportBnoteSuccess(importedNb);
      } else if (onImportPdfSuccess) {
        onImportPdfSuccess(importedNb);
      }
      showToast(`นำเข้าสมุดโน้ต "${importedNb.name}" สำเร็จ! 📘`);
      if (onTriggerAutoSync) onTriggerAutoSync();
    } catch (err) {
      console.error('Failed to import .bnote:', err);
      alert('เกิดข้อผิดพลาดในการนำเข้า .bnote: ' + err.message);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const currentFolder = folders.find(f => f.id === currentFolderId);

  // Filter items based on active view and search
  const isItemDeleted = (item) => !!item?.isDeleted;
  const isItemFavorite = (item) => !item?.isDeleted && !!item?.isFavorite;

  // Favorite & Trash counts for sidebar badges
  const favoriteCount = 
    (folders || []).filter(isItemFavorite).length + 
    (notebooks || []).filter(isItemFavorite).length +
    (favoritePages || []).length;

  const trashCount = 
    (folders || []).filter(isItemDeleted).length + 
    (notebooks || []).filter(isItemDeleted).length;

  // Active items (Folders)
  let visibleFolders = (folders || []).filter(f => {
    if (!f) return false;
    if (activeView === 'trash') return !!f.isDeleted;
    if (f.isDeleted) return false;
    if (activeView === 'favorites') return !!f.isFavorite;
    if (activeView === 'documents') {
      return currentFolderId === null ? !f.parentId : f.parentId === currentFolderId;
    }
    return false;
  });

  // Active items (Notebooks)
  let visibleNotebooks = (notebooks || []).filter(nb => {
    if (!nb) return false;
    if (activeView === 'trash') return !!nb.isDeleted;
    if (nb.isDeleted) return false;
    if (activeView === 'favorites') return !!nb.isFavorite;
    if (activeView === 'documents') {
      return currentFolderId === null ? !nb.folderId : nb.folderId === currentFolderId;
    }
    return false;
  });

  // Search Filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    visibleFolders = visibleFolders.filter(f => String(f?.name || '').toLowerCase().includes(q));
    visibleNotebooks = visibleNotebooks.filter(nb => String(nb?.name || '').toLowerCase().includes(q));
  }

  // Safe & Robust Sorting (Supports Name asc/desc, Natural numbers 1-9/9-1, and Date newest/oldest)
  const sortComparator = (a, b) => {
    const nameA = String(a?.name || '').trim();
    const nameB = String(b?.name || '').trim();

    const numMatchA = nameA.match(/\d+/);
    const numMatchB = nameB.match(/\d+/);
    const numA = numMatchA ? parseInt(numMatchA[0], 10) : null;
    const numB = numMatchB ? parseInt(numMatchB[0], 10) : null;

    switch (sortBy) {
      case 'name-asc':
      case 'name':
        return nameA.localeCompare(nameB, 'th', { numeric: false });

      case 'name-desc':
        return nameB.localeCompare(nameA, 'th', { numeric: false });

      case 'number-asc':
      case 'number':
        if (numA !== null && numB !== null) {
          if (numA !== numB) return numA - numB;
          return nameA.localeCompare(nameB, 'th', { numeric: true, sensitivity: 'base' });
        }
        if (numA !== null && numB === null) return -1;
        if (numA === null && numB !== null) return 1;
        return nameA.localeCompare(nameB, 'th', { numeric: true, sensitivity: 'base' });

      case 'number-desc':
        if (numA !== null && numB !== null) {
          if (numA !== numB) return numB - numA;
          return nameB.localeCompare(nameA, 'th', { numeric: true, sensitivity: 'base' });
        }
        if (numA !== null && numB === null) return -1;
        if (numA === null && numB !== null) return 1;
        return nameB.localeCompare(nameA, 'th', { numeric: true, sensitivity: 'base' });

      case 'date-desc':
      case 'date': {
        const timeA = a?.updatedAt || a?.createdAt || 0;
        const timeB = b?.updatedAt || b?.createdAt || 0;
        if (timeB !== timeA) return timeB - timeA;
        return nameA.localeCompare(nameB, 'th');
      }

      case 'date-asc': {
        const timeA = a?.updatedAt || a?.createdAt || 0;
        const timeB = b?.updatedAt || b?.createdAt || 0;
        if (timeA !== timeB) return timeA - timeB;
        return nameA.localeCompare(nameB, 'th');
      }

      default:
        return nameA.localeCompare(nameB, 'th');
    }
  };

  const getSortLabel = () => {
    switch (sortBy) {
      case 'name-asc':
      case 'name':
        return 'ชื่อ (ก - ฮ)';
      case 'name-desc':
        return 'ชื่อ (ฮ - ก)';
      case 'number-asc':
      case 'number':
        return 'ตัวเลข (1 - 9)';
      case 'number-desc':
        return 'ตัวเลข (9 - 1)';
      case 'date-desc':
      case 'date':
        return 'วันที่ (ล่าสุด)';
      case 'date-asc':
        return 'วันที่ (เก่าสุด)';
      default:
        return 'ชื่อ (ก - ฮ)';
    }
  };

  visibleFolders.sort(sortComparator);
  visibleNotebooks.sort(sortComparator);

  const getItemCount = (folderId) => {
    const subF = (folders || []).filter(f => f && !f.isDeleted && f.parentId === folderId).length;
    const subN = (notebooks || []).filter(nb => nb && !nb.isDeleted && nb.folderId === folderId).length;
    return subF + subN;
  };

  // Folder Actions
  const handleUpdateFolder = async (folderId, updates) => {
    const target = folders.find(f => f.id === folderId);
    if (target) {
      const updated = { ...target, ...updates, updatedAt: Date.now() };
      if (onUpdateFolder) {
        await onUpdateFolder(updated);
      } else {
        await onCreateFolder(updated);
      }
    }
  };

  const handleToggleFavoriteFolder = (folderId) => {
    const target = folders.find(f => f.id === folderId);
    if (target) {
      handleUpdateFolder(folderId, { isFavorite: !target.isFavorite });
      showToast(target.isFavorite ? 'นำออกจากรายการโปรดแล้ว' : 'เพิ่มเป็นรายการโปรดแล้ว ⭐');
    }
  };

  const handleSoftDeleteFolder = (folderId) => {
    handleUpdateFolder(folderId, { isDeleted: true, deletedAt: Date.now() });
    showToast('ย้ายโฟลเดอร์ไปยังถังขยะแล้ว 🗑️');
  };

  const handleRestoreFolder = (folderId) => {
    handleUpdateFolder(folderId, { isDeleted: false, deletedAt: null });
    showToast('กู้คืนโฟลเดอร์เรียบร้อยแล้ว ✨');
  };

  // Notebook Actions
  const handleUpdateNotebook = async (notebookId, updates) => {
    const target = notebooks.find(nb => nb.id === notebookId);
    if (target) {
      const updated = { ...target, ...updates, updatedAt: Date.now() };
      if (onUpdateNotebook) {
        await onUpdateNotebook(updated);
      } else {
        await onCreateNotebook(updated);
      }
    }
  };

  const handleToggleFavoriteNotebook = (notebookId) => {
    const target = notebooks.find(nb => nb.id === notebookId);
    if (target) {
      handleUpdateNotebook(notebookId, { isFavorite: !target.isFavorite });
      showToast(target.isFavorite ? 'นำออกจากรายการโปรดแล้ว' : 'เพิ่มเป็นรายการโปรดแล้ว ⭐');
    }
  };

  const handleSoftDeleteNotebook = (notebookId) => {
    handleUpdateNotebook(notebookId, { isDeleted: true, deletedAt: Date.now() });
    showToast('ย้ายสมุดไปยังถังขยะแล้ว 🗑️');
  };

  const handleRestoreNotebook = (notebookId) => {
    handleUpdateNotebook(notebookId, { isDeleted: false, deletedAt: null });
    showToast('กู้คืนสมุดเรียบร้อยแล้ว ✨');
  };

  const handleShare = (item) => {
    showToast(`พร้อมแชร์ "${item.name}" แล้ว`);
  };

  const handleCopyLink = (item) => {
    try {
      navigator.clipboard?.writeText(window.location.href);
      showToast(`คัดลอกลิงก์ของ "${item.name}" เรียบร้อยแล้ว 🔗`);
    } catch (_) {
      showToast(`คัดลอกลิงก์สำเร็จ 🔗`);
    }
  };

  // Rename Confirmation
  const handleConfirmRename = (newName) => {
    if (!renameItem) return;
    if (renameItem.type === 'folder') {
      handleUpdateFolder(renameItem.item.id, { name: newName });
    } else {
      handleUpdateNotebook(renameItem.item.id, { name: newName });
    }
    showToast('เปลี่ยนชื่อสำเร็จ!');
  };

  // Move Confirmation
  const handleConfirmMove = (itemId, targetFolderId) => {
    if (!moveItem) return;
    if (moveItem.type === 'notebook') {
      onMoveNotebookToFolder(itemId, targetFolderId);
    } else {
      handleUpdateFolder(itemId, { parentId: targetFolderId });
    }
    showToast('ย้ายตำแหน่งสำเร็จ!');
  };

  // Navigate Up
  const handleNavigateUp = () => {
    if (currentFolder && currentFolder.parentId) {
      onNavigateFolder(currentFolder.parentId);
    } else {
      onNavigateFolder(null);
    }
  };

  // Multi-Select Batch Operations
  const toggleSelectItem = (id, type) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectMode = () => {
    setIsSelectMode(prev => {
      if (prev) {
        setSelectedItemIds(new Set());
      }
      return !prev;
    });
  };

  const allVisibleItemIds = [
    ...visibleFolders.map(f => f.id),
    ...visibleNotebooks.map(nb => nb.id)
  ];
  const isAllSelected = allVisibleItemIds.length > 0 && allVisibleItemIds.every(id => selectedItemIds.has(id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(allVisibleItemIds));
    }
  };

  const selectedFolders = folders.filter(f => selectedItemIds.has(f.id));
  const selectedNotebooks = notebooks.filter(nb => selectedItemIds.has(nb.id));
  const selectedCount = selectedItemIds.size;

  const handleBatchMove = () => {
    if (selectedCount === 0) return;
    const itemsToMove = [
      ...selectedFolders.map(f => ({ ...f, type: 'folder' })),
      ...selectedNotebooks.map(nb => ({ ...nb, type: 'notebook' }))
    ];
    setBatchMoveItems(itemsToMove);
  };

  const handleConfirmBatchMove = async (items, targetFolderId) => {
    try {
      const list = Array.isArray(items) ? items : (items ? [items] : []);
      for (const item of list) {
        if (item?.type === 'notebook') {
          if (onMoveNotebookToFolder) {
            await onMoveNotebookToFolder(item.id, targetFolderId);
          }
        } else if (item?.type === 'folder') {
          await handleUpdateFolder(item.id, { parentId: targetFolderId });
        }
      }
      setSelectedItemIds(new Set());
      setIsSelectMode(false);
      setBatchMoveItems(null);
      showToast(`ย้าย ${list.length} รายการสำเร็จ! 📁`);
    } catch (err) {
      console.error('Error during batch move:', err);
      showToast('เกิดข้อผิดพลาดในการย้ายไฟล์');
    }
  };

  const handleBatchDuplicate = async () => {
    if (selectedNotebooks.length === 0) {
      showToast('การทำสำเนารองรับเฉพาะสมุดบันทึก');
      return;
    }
    try {
      for (const nb of selectedNotebooks) {
        if (onDuplicateNotebook) {
          await onDuplicateNotebook(nb.id);
        }
      }
      const count = selectedNotebooks.length;
      setSelectedItemIds(new Set());
      setIsSelectMode(false);
      showToast(`ทำสำเนา ${count} เล่มเรียบร้อยแล้ว ✨`);
    } catch (err) {
      console.error('Error during batch duplicate:', err);
      showToast('เกิดข้อผิดพลาดในการทำสำเนา');
    }
  };

  const handleBatchExportPdf = async () => {
    if (selectedNotebooks.length === 0) {
      showToast('การส่งออก PDF รองรับเฉพาะสมุดบันทึก');
      return;
    }
    try {
      showToast(`กำลังเริ่มส่งออก PDF ${selectedNotebooks.length} เล่ม...`);
      for (const nb of selectedNotebooks) {
        if (onExportNotebookPdf) {
          await onExportNotebookPdf(nb);
        }
      }
      showToast(`ส่งออก PDF สำเร็จ ${selectedNotebooks.length} เล่ม! 📄`);
    } catch (err) {
      console.error('Error during batch export:', err);
      showToast('เกิดข้อผิดพลาดในการส่งออก PDF');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedCount === 0) return;
    try {
      if (activeView === 'trash') {
        if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบถาวร ${selectedCount} รายการนี้? การกระทำนี้ไม่สามารถย้อนกลับได้`)) {
          return;
        }
        for (const f of selectedFolders) {
          if (onDeleteFolder) await onDeleteFolder(f.id);
        }
        for (const nb of selectedNotebooks) {
          if (onDeleteNotebook) await onDeleteNotebook(nb.id);
        }
        showToast(`ลบถาวร ${selectedCount} รายการเรียบร้อยแล้ว`);
      } else {
        for (const f of selectedFolders) {
          await handleSoftDeleteFolder(f.id);
        }
        for (const nb of selectedNotebooks) {
          await handleSoftDeleteNotebook(nb.id);
        }
        showToast(`ย้าย ${selectedCount} รายการไปยังถังขยะแล้ว 🗑️`);
      }
      setSelectedItemIds(new Set());
      setIsSelectMode(false);
    } catch (err) {
      console.error('Error during batch delete:', err);
      showToast('เกิดข้อผิดพลาดในการลบ');
    }
  };

  const handleExitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedItemIds(new Set());
  };

  return (
    <div className="bn-studio-layout">
      {/* 1. Left Sidebar (Studio Style) */}
      <StudioSidebar 
        activeView={activeView}
        onSelectView={(view) => {
          setActiveView(view);
          if (view !== 'documents') {
            onNavigateFolder(null);
          }
        }}
        favoriteCount={favoriteCount}
        trashCount={trashCount}
        currentTheme={currentTheme}
        onToggleTheme={onToggleTheme}
      />

      {/* 2. Main Content Workspace */}
      <div className="bn-studio-main">
        {/* Top Header Section */}
        <header className="bn-gn-topbar">
          {/* Left: Breadcrumbs & Back Arrow & Title */}
          <div className="bn-gn-topbar-left">
            {/* Small breadcrumb above title */}
            <div className="bn-gn-breadcrumb-row">
              <span 
                className="hover:underline cursor-pointer"
                onClick={() => { setActiveView('documents'); onNavigateFolder(null); }}
              >
                เอกสาร
              </span>
              {folderChain.map((f, idx) => (
                <React.Fragment key={f.id}>
                  <span className="text-zinc-600">›</span>
                  <span 
                    className={`cursor-pointer ${idx === folderChain.length - 1 ? 'text-zinc-300 font-medium' : 'text-zinc-400 hover:underline'}`}
                    onClick={() => onNavigateFolder(f.id)}
                  >
                    {f.name}
                  </span>
                </React.Fragment>
              ))}
            </div>

            {/* Title with Back Arrow if inside folder or non-documents view */}
            <div className="bn-gn-title-row">
              {(currentFolderId !== null || activeView !== 'documents') && (
                <button 
                  className="bn-gn-back-btn" 
                  onClick={() => {
                    if (currentFolderId !== null) {
                      handleNavigateUp();
                    } else {
                      setActiveView('documents');
                    }
                  }}
                  title="ย้อนกลับ"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <h2 className="bn-gn-title">
                {activeView === 'favorites' ? 'รายการโปรด' :
                 activeView === 'trash' ? 'ลบทิ้ง (ถังขยะ)' :
                 activeView === 'shared' ? 'แชร์' :
                 activeView === 'marketplace' ? 'มาร์เก็ตเพลส' :
                 (currentFolder ? currentFolder.name : 'เอกสาร')}
              </h2>
            </div>
          </div>

          {/* Right: Actions, Search, Cloud, + New Button & Sort */}
          <div className="bn-gn-topbar-right">
            {/* Search Trigger Button (Global Search across all notebooks & folders) */}
            <button
              className="bn-gn-search-trigger"
              onClick={() => setIsSearchModalOpen(true)}
              title="ค้นหาเอกสาร สมุดโน้ต หรือโฟลเดอร์ทั้งหมด (Ctrl+K)"
            >
              <Search size={15} className="text-zinc-400" />
              <span className="text-xs text-zinc-300 hidden sm:inline">ค้นหาเอกสาร...</span>
              <kbd className="hidden md:inline text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700 ml-1">Ctrl+K</kbd>
            </button>

            {/* Google Drive Auto-Sync Status Pill & Backup Inspection Trigger */}
            <div 
              className="bn-gn-cloud-pill cursor-pointer hover:border-emerald-500/50 transition-colors"
              onClick={() => setIsBackupStatusModalOpen(true)}
              title="Google Drive: H:\My Drive\BetterNote.AppPC (คลิกเพื่อตรวจสอบสถานะ Backup & รายการไฟล์)"
            >
              <span className={`bn-pulse-dot ${isSyncing ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <Cloud size={14} className={isSyncing ? 'text-amber-400 animate-pulse' : 'text-emerald-400'} />
              <span className="text-[11px] font-medium hidden md:inline text-zinc-300">
                {isSyncing ? 'กำลังซิงค์...' : 'Drive'}
              </span>
            </div>

            {/* Direct Backup Status Inspector Button */}
            <button
              className="bn-gn-icon-btn text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 transition-colors"
              onClick={() => setIsBackupStatusModalOpen(true)}
              title="ตรวจสอบสถานะ Backup (ดูไฟล์ไหนถูกสำรองแล้ว เวลาเท่าไร ที่ไหน)"
            >
              <ShieldCheck size={18} />
            </button>

            {/* Settings Button - Opens Full SettingsModal */}
            <button
              className="bn-gn-icon-btn"
              onClick={() => setIsSettingsModalOpen(true)}
              title="การตั้งค่า & สำรองข้อมูล (Google Drive, สำรอง/กู้คืน, ค่าเริ่มต้น)"
            >
              <Settings size={18} />
            </button>

            <input 
              type="file" 
              ref={backupFileInputRef} 
              accept=".json,.bnote" 
              style={{ display: 'none' }} 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && onImportBackup) onImportBackup(file);
              }} 
            />

            <input 
              type="file" 
              ref={bnoteFileInputRef} 
              accept=".bnote" 
              style={{ display: 'none' }} 
              onChange={handleBnoteFileSelect} 
            />

            {/* Studio Blue Pill "+ ใหม่" Button */}
            <div className="bn-gn-menu-anchor" ref={newMenuRef}>
              <button
                type="button"
                className="bn-gn-new-pill-btn"
                onClick={() => setIsNewItemModalOpen(true)}
                title="สร้างสมุดโน้ตใหม่ (เลือกกระดาษและขนาด)"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>ใหม่</span>
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNewMenu(prev => !prev);
                    setShowSortMenu(false);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 0 2px 4px', cursor: 'pointer' }}
                  title="ตัวเลือกเพิ่มเติม"
                >
                  <ChevronDown size={13} className={`transition-transform duration-150 ${showNewMenu ? 'rotate-180' : ''}`} />
                </span>
              </button>

              {showNewMenu && (
                <div 
                  className="bn-gn-dropdown-popover"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="bn-gn-popover-item"
                    onClick={() => {
                      setShowNewMenu(false);
                      setIsNewItemModalOpen(true);
                    }}
                  >
                    <BookOpen size={16} className="text-blue-400" />
                    <span>สมุดบันทึกใหม่...</span>
                  </button>

                  <button
                    type="button"
                    className="bn-gn-popover-item"
                    onClick={() => {
                      setShowNewMenu(false);
                      setIsNewItemModalOpen(true);
                    }}
                  >
                    <FolderIcon size={16} className="text-amber-400" />
                    <span>โฟลเดอร์ใหม่...</span>
                  </button>

                  <button
                    type="button"
                    className="bn-gn-popover-item"
                    onClick={() => {
                      setShowNewMenu(false);
                      setIsPdfModalOpen(true);
                    }}
                  >
                    <FileText size={16} className="text-red-400" />
                    <span>นำเข้าไฟล์ PDF...</span>
                  </button>

                  <button
                    type="button"
                    className="bn-gn-popover-item"
                    onClick={() => {
                      setShowNewMenu(false);
                      bnoteFileInputRef.current?.click();
                    }}
                  >
                    <FileCode2 size={16} className="text-purple-400" />
                    <span>นำเข้าไฟล์ .bnote...</span>
                  </button>

                  <div className="w-full h-px bg-zinc-800 my-1" />

                  <button
                    type="button"
                    className="bn-gn-popover-item"
                    onClick={() => {
                      setShowNewMenu(false);
                      setIsSettingsModalOpen(true);
                    }}
                  >
                    <FolderSync size={16} className="text-emerald-400" />
                    <span>ดึงข้อมูลสำรองจาก Google Drive...</span>
                  </button>

                  <button
                    type="button"
                    className="bn-gn-popover-item"
                    onClick={() => {
                      setShowNewMenu(false);
                      setIsBackupStatusModalOpen(true);
                    }}
                  >
                    <ShieldCheck size={16} className="text-emerald-400" />
                    <span>ตรวจสอบสถานะการ Backup (ดูไฟล์และเวลา)...</span>
                  </button>
                </div>
              )}
            </div>

            {/* Sort Dropdown Button ("ชื่อ ⌵", "ตัวเลข ⌵", "วันที่ ⌵") */}
            <div className="bn-gn-menu-anchor" ref={sortMenuRef}>
              <button
                type="button"
                id="bn-sort-dropdown-btn"
                className={`bn-gn-sort-btn ${showSortMenu ? 'bn-sort-active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSortMenu(prev => !prev);
                  setShowNewMenu(false);
                }}
                title="เรียงลำดับเอกสาร (ชื่อ, ตัวเลข, วันที่)"
              >
                <span>{getSortLabel()}</span>
                <ChevronDown size={13} className={`transition-transform duration-150 ${showSortMenu ? 'rotate-180' : ''}`} />
              </button>

              {showSortMenu && (
                <div 
                  className="bn-gn-dropdown-popover"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="bn-sort-section-header">
                    <span>เรียงตามชื่อ</span>
                  </div>
                  <button
                    type="button"
                    className={`bn-gn-popover-item ${sortBy === 'name-asc' || sortBy === 'name' ? 'bn-popover-item-active' : ''}`}
                    onClick={(e) => { 
                      e.stopPropagation();
                      setSortBy('name-asc'); 
                      setShowSortMenu(false); 
                      showToast('จัดเรียงตาม: ชื่อ (ก - ฮ / A - Z)'); 
                    }}
                  >
                    <span>ชื่อ (ก - ฮ / A - Z)</span>
                    {(sortBy === 'name-asc' || sortBy === 'name') && <Check size={14} color="#60a5fa" />}
                  </button>
                  <button
                    type="button"
                    className={`bn-gn-popover-item ${sortBy === 'name-desc' ? 'bn-popover-item-active' : ''}`}
                    onClick={(e) => { 
                      e.stopPropagation();
                      setSortBy('name-desc'); 
                      setShowSortMenu(false); 
                      showToast('จัดเรียงตาม: ชื่อ (ฮ - ก / Z - A)'); 
                    }}
                  >
                    <span>ชื่อ (ฮ - ก / Z - A)</span>
                    {sortBy === 'name-desc' && <Check size={14} color="#60a5fa" />}
                  </button>

                  <div className="bn-sort-divider" />
                  <div className="bn-sort-section-header">
                    <span>เรียงตามตัวเลข</span>
                  </div>
                  <button
                    type="button"
                    className={`bn-gn-popover-item ${sortBy === 'number-asc' || sortBy === 'number' ? 'bn-popover-item-active' : ''}`}
                    onClick={(e) => { 
                      e.stopPropagation();
                      setSortBy('number-asc'); 
                      setShowSortMenu(false); 
                      showToast('จัดเรียงตาม: ตัวเลข (1 - 9 / น้อยไปมาก)'); 
                    }}
                  >
                    <span>ตัวเลข (1 - 9 / น้อยไปมาก)</span>
                    {(sortBy === 'number-asc' || sortBy === 'number') && <Check size={14} color="#60a5fa" />}
                  </button>
                  <button
                    type="button"
                    className={`bn-gn-popover-item ${sortBy === 'number-desc' ? 'bn-popover-item-active' : ''}`}
                    onClick={(e) => { 
                      e.stopPropagation();
                      setSortBy('number-desc'); 
                      setShowSortMenu(false); 
                      showToast('จัดเรียงตาม: ตัวเลข (9 - 1 / มากไปน้อย)'); 
                    }}
                  >
                    <span>ตัวเลข (9 - 1 / มากไปน้อย)</span>
                    {sortBy === 'number-desc' && <Check size={14} color="#60a5fa" />}
                  </button>

                  <div className="bn-sort-divider" />
                  <div className="bn-sort-section-header">
                    <span>เรียงตามวันที่แก้ไข</span>
                  </div>
                  <button
                    type="button"
                    className={`bn-gn-popover-item ${sortBy === 'date-desc' || sortBy === 'date' ? 'bn-popover-item-active' : ''}`}
                    onClick={(e) => { 
                      e.stopPropagation();
                      setSortBy('date-desc'); 
                      setShowSortMenu(false); 
                      showToast('จัดเรียงตาม: วันที่แก้ไข (ล่าสุดก่อน)'); 
                    }}
                  >
                    <span>วันที่แก้ไข (ล่าสุดก่อน)</span>
                    {(sortBy === 'date-desc' || sortBy === 'date') && <Check size={14} color="#60a5fa" />}
                  </button>
                  <button
                    type="button"
                    className={`bn-gn-popover-item ${sortBy === 'date-asc' ? 'bn-popover-item-active' : ''}`}
                    onClick={(e) => { 
                      e.stopPropagation();
                      setSortBy('date-asc'); 
                      setShowSortMenu(false); 
                      showToast('จัดเรียงตาม: วันที่แก้ไข (เก่าสุดก่อน)'); 
                    }}
                  >
                    <span>วันที่แก้ไข (เก่าสุดก่อน)</span>
                    {sortBy === 'date-asc' && <Check size={14} color="#60a5fa" />}
                  </button>
                </div>
              )}
            </div>

            {/* Multi-Select Circle Button */}
            <button
              type="button"
              className={`bn-gn-icon-btn ${isSelectMode ? 'bn-select-mode-active' : ''}`}
              onClick={handleToggleSelectMode}
              title={isSelectMode ? "ยกเลิกโหมดเลือกหลายไฟล์" : "เลือกหลายรายการเพื่อลบ คัดลอก ส่งออก หรือย้าย"}
            >
              <CheckCircle size={18} />
            </button>
          </div>
        </header>

        {/* Cloud Migration Auto-Restore Banner (Shown if library has 0 notes and cloud backup is found) */}
        {cloudBackupDetected && (
          <div className="bn-cloud-migration-banner" style={{
            margin: '12px 20px',
            padding: '14px 20px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.25), rgba(16, 185, 129, 0.2))',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0
              }}>
                <Cloud size={20} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                  ☁️ ตรวจพบข้อมูลสำรองจาก Google Drive ({cloudBackupDetected.folder})
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
                  มีสมุดโน้ตสำรองทั้งหมด <strong>{cloudBackupDetected.count} เล่ม</strong> คุณต้องการกู้คืนข้อมูลทั้งหมดลงเครื่องนี้ทันทีหรือไม่?
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleExecuteCloudRestore}
                disabled={isAutoRestoring}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FolderSync size={16} className={isAutoRestoring ? 'animate-spin' : ''} />
                <span>{isAutoRestoring ? 'กำลังกู้คืนข้อมูล...' : 'กู้คืนข้อมูลทั้งหมดทันที'}</span>
              </button>
              <button
                type="button"
                onClick={() => setCloudBackupDetected(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                ปิด
              </button>
            </div>
          </div>
        )}

        {/* Floating Batch Actions Bar (Visible when isSelectMode is active) */}
        {isSelectMode && (
          <div className="bn-batch-bar-container">
            <div className="bn-batch-action-bar">
              <div className="bn-batch-left">
                <button 
                  type="button"
                  className="bn-batch-select-all-btn"
                  onClick={handleSelectAll}
                >
                  {isAllSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                  <span>{isAllSelected ? 'ยกเลิกเลือก' : 'เลือกทั้งหมด'}</span>
                </button>
                <span className="bn-batch-count-badge">
                  เลือก {selectedCount} รายการ
                </span>
              </div>

              <div className="bn-batch-right">
                <button
                  type="button"
                  className="bn-batch-btn"
                  disabled={selectedCount === 0}
                  onClick={handleBatchMove}
                  title="ย้ายรายการที่เลือกไปยังโฟลเดอร์อื่น"
                >
                  <FolderInput size={15} />
                  <span>ย้าย</span>
                </button>

                <button
                  type="button"
                  className="bn-batch-btn"
                  disabled={selectedNotebooks.length === 0}
                  onClick={handleBatchDuplicate}
                  title="ทำสำเนาสมุดโน้ตที่เลือก"
                >
                  <Copy size={15} />
                  <span>ทำสำเนา ({selectedNotebooks.length})</span>
                </button>

                <button
                  type="button"
                  className="bn-batch-btn"
                  disabled={selectedNotebooks.length === 0}
                  onClick={handleBatchExportPdf}
                  title="ส่งออกสมุดโน้ตที่เลือกเป็น PDF"
                >
                  <Download size={15} />
                  <span>ส่งออก PDF ({selectedNotebooks.length})</span>
                </button>

                <button
                  type="button"
                  className="bn-batch-btn bn-batch-btn-danger"
                  disabled={selectedCount === 0}
                  onClick={handleBatchDelete}
                  title={activeView === 'trash' ? 'ลบถาวร' : 'ย้ายไปยังถังขยะ'}
                >
                  <Trash2 size={15} />
                  <span>{activeView === 'trash' ? 'ลบถาวร' : 'ลบทิ้ง'}</span>
                </button>

                <button
                  type="button"
                  className="bn-batch-done-btn"
                  onClick={handleExitSelectMode}
                  title="ออกจากโหมดเลือก"
                >
                  เสร็จสิ้น
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className="bn-gn-content-area">
          {/* Marketplace View */}
          {activeView === 'marketplace' && (
            <div className="p-8 text-center max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
                <Store size={32} className="text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">มาร์เก็ตเพลส BetterNote</h3>
              <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                ค้นพบเทมเพลตกระดาษ แพลนเนอร์ สติกเกอร์ และหน้าปกสมุดกว่า 500+ รายการที่ออกแบบมาเพื่อคุณ
              </p>
              <button 
                className="bn-btn-primary px-4 py-2 rounded-xl text-xs font-semibold"
                onClick={() => setActiveView('documents')}
              >
                กลับสู่หน้าเอกสาร
              </button>
            </div>
          )}

          {/* Shared View */}
          {activeView === 'shared' && (
            <div className="p-8 text-center max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/15 flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                <Share2 size={30} className="text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">เอกสารที่แชร์ร่วมกัน</h3>
              <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                ยังไม่มีเอกสารที่แชร์กับผู้อื่น คุณสามารถแชร์สมุดบันทึกหรือส่งออกเป็น PDF ได้ตลอดเวลา
              </p>
            </div>
          )}

          {/* Favorites View (With Category Tabs & Categorized Sections) */}
          {activeView === 'favorites' && (
            <div className="bn-fav-wrapper">
              {/* Category Segmented Tabs */}
              <div className="bn-fav-tabs-bar">
                <div className="bn-fav-tabs">
                  <button 
                    type="button"
                    className={`bn-fav-tab-btn ${favTab === 'all' ? 'bn-fav-tab-active' : ''}`}
                    onClick={() => setFavTab('all')}
                  >
                    <span>ทั้งหมด</span>
                    <span className="bn-fav-tab-badge">
                      {visibleFolders.length + visibleNotebooks.length + favoritePages.length}
                    </span>
                  </button>
                  <button 
                    type="button"
                    className={`bn-fav-tab-btn ${favTab === 'documents' ? 'bn-fav-tab-active' : ''}`}
                    onClick={() => setFavTab('documents')}
                  >
                    <Folder size={14} />
                    <span>ไฟล์และโฟลเดอร์</span>
                    <span className="bn-fav-tab-badge">
                      {visibleFolders.length + visibleNotebooks.length}
                    </span>
                  </button>
                  <button 
                    type="button"
                    className={`bn-fav-tab-btn ${favTab === 'pages' ? 'bn-fav-tab-active' : ''}`}
                    onClick={() => setFavTab('pages')}
                  >
                    <FileText size={14} />
                    <span>หน้ากระดาษ</span>
                    <span className="bn-fav-tab-badge">
                      {favoritePages.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Favorites Content */}
              {favTab === 'all' && (
                <>
                  {visibleFolders.length === 0 && visibleNotebooks.length === 0 && favoritePages.length === 0 ? (
                    <div className="bn-gn-empty-state">
                      <div className="bn-gn-empty-icon">⭐</div>
                      <h4 className="text-sm font-semibold text-zinc-200 mb-1">ยังไม่มีรายการโปรด</h4>
                      <p className="text-xs text-zinc-500 max-w-xs">
                        กดที่ไอคอนรูปดาวบนโฟลเดอร์ สมุดบันทึก หรือหน้ากระดาษเพื่อเพิ่มเข้ามาในหน้านี้
                      </p>
                    </div>
                  ) : (
                    <div className="bn-fav-sections-container">
                      {/* Section 1: Documents & Folders */}
                      {(visibleFolders.length > 0 || visibleNotebooks.length > 0) && (
                        <div className="bn-fav-section">
                          <div className="bn-fav-section-title">
                            <Folder size={16} />
                            <span>ไฟล์และโฟลเดอร์โปรด ({visibleFolders.length + visibleNotebooks.length})</span>
                          </div>
                          <div className="bn-gn-grid">
                            {visibleFolders.map(f => (
                              <div key={f.id} className="relative group">
                                <FolderCard 
                                  folder={f}
                                  count={getItemCount(f.id)}
                                  onClick={() => onNavigateFolder(f.id)}
                                  onDelete={() => handleSoftDeleteFolder(f.id)}
                                  onRename={(target) => setRenameItem({ item: target, type: 'folder' })}
                                  onMove={(target) => setMoveItem({ item: target, type: 'folder' })}
                                  onUpdateFolder={handleUpdateFolder}
                                  onToggleFavorite={handleToggleFavoriteFolder}
                                  onDropNotebook={onMoveNotebookToFolder}
                                  isSelectMode={isSelectMode}
                                  isSelected={selectedItemIds.has(f.id)}
                                  onToggleSelect={toggleSelectItem}
                                />
                              </div>
                            ))}
                            {visibleNotebooks.map(nb => (
                              <div key={nb.id} className="relative group">
                                <NotebookCard 
                                  notebook={nb}
                                  folders={folders}
                                  onClick={() => onOpenNotebook(nb.id)}
                                  onDelete={() => handleSoftDeleteNotebook(nb.id)}
                                  onDuplicate={onDuplicateNotebook}
                                  onExportPdf={onExportNotebookPdf}
                                  onMoveToFolder={(target) => setMoveItem({ item: target, type: 'notebook' })}
                                  onRename={(target) => setRenameItem({ item: target, type: 'notebook' })}
                                  onToggleFavorite={handleToggleFavoriteNotebook}
                                  onShare={handleShare}
                                  onCopyLink={handleCopyLink}
                                  isSelectMode={isSelectMode}
                                  isSelected={selectedItemIds.has(nb.id)}
                                  onToggleSelect={toggleSelectItem}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section 2: Bookmarked Pages */}
                      {favoritePages.length > 0 && (
                        <div className="bn-fav-section">
                          <div className="bn-fav-section-title">
                            <FileText size={16} />
                            <span>หน้ากระดาษที่ติดดาวไว้ ({favoritePages.length} หน้า)</span>
                          </div>
                          <div className="bn-gn-pages-grid">
                            {favoritePages.map(p => {
                              const parentNb = (notebooks || []).find(n => n && n.id === p.notebookId);
                              const nbTitle = parentNb ? parentNb.name : 'สมุดบันทึก';
                              return (
                                <div 
                                  key={p.id} 
                                  className="bn-gn-fav-page-card"
                                  onClick={() => onOpenNotebook(p.notebookId, p.pageIndex)}
                                  title={`คลิกเพื่อเปิด "${nbTitle}" หน้า ${p.pageIndex + 1}`}
                                >
                                  <div className="bn-gn-fav-page-preview">
                                    <span className="bn-gn-fav-page-badge">
                                      หน้า {p.pageIndex + 1}
                                    </span>
                                    <button
                                      type="button"
                                      className="bn-gn-fav-page-star-btn bn-star-active"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleFavoritePage(p);
                                      }}
                                      title="นำหน้านี้ออกจากรายการโปรด"
                                    >
                                      <Star size={13} fill="#f59e0b" color="#f59e0b" className="bn-star-gold" />
                                    </button>
                                    {p.pdfPageImage ? (
                                      <img 
                                        src={p.pdfPageImage} 
                                        alt={`หน้า ${p.pageIndex + 1}`}
                                        className="bn-gn-fav-page-img"
                                      />
                                    ) : (
                                      <div className="bn-gn-fav-page-mock">
                                        <div className="bn-gn-page-rule-line" />
                                        <div className="bn-gn-page-rule-line" />
                                        <div className="bn-gn-page-rule-line" />
                                        <div className="bn-gn-page-rule-line" />
                                        {p.strokes && p.strokes.length > 0 ? (
                                          <div className="bn-gn-page-drawn-indicator">
                                            มีบันทึกเขียน ({p.strokes.length} เส้น)
                                          </div>
                                        ) : (
                                          <div className="bn-gn-page-blank-indicator">
                                            หน้าว่าง
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="bn-gn-fav-page-meta">
                                    <span className="bn-gn-fav-page-name truncate" title={nbTitle}>
                                      {nbTitle}
                                    </span>
                                    <span className="bn-gn-fav-page-sub">
                                      หน้า {p.pageIndex + 1}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {favTab === 'documents' && (
                <>
                  {visibleFolders.length === 0 && visibleNotebooks.length === 0 ? (
                    <div className="bn-gn-empty-state">
                      <div className="bn-gn-empty-icon">📁</div>
                      <h4 className="text-sm font-semibold text-zinc-200 mb-1">ยังไม่มีไฟล์หรือโฟลเดอร์โปรด</h4>
                      <p className="text-xs text-zinc-500 max-w-xs">
                        กดที่ไอคอนรูปดาวบนโฟลเดอร์หรือสมุดโน้ตเพื่อบันทึกไว้ในหมวดหมู่นี้
                      </p>
                    </div>
                  ) : (
                    <div className="bn-gn-grid">
                      {visibleFolders.map(f => (
                        <div key={f.id} className="relative group">
                          <FolderCard 
                            folder={f}
                            count={getItemCount(f.id)}
                            onClick={() => onNavigateFolder(f.id)}
                            onDelete={() => handleSoftDeleteFolder(f.id)}
                            onRename={(target) => setRenameItem({ item: target, type: 'folder' })}
                            onMove={(target) => setMoveItem({ item: target, type: 'folder' })}
                            onUpdateFolder={handleUpdateFolder}
                            onToggleFavorite={handleToggleFavoriteFolder}
                            onDropNotebook={onMoveNotebookToFolder}
                            isSelectMode={isSelectMode}
                            isSelected={selectedItemIds.has(f.id)}
                            onToggleSelect={toggleSelectItem}
                          />
                        </div>
                      ))}
                      {visibleNotebooks.map(nb => (
                        <div key={nb.id} className="relative group">
                          <NotebookCard 
                            notebook={nb}
                            folders={folders}
                            onClick={() => onOpenNotebook(nb.id)}
                            onDelete={() => handleSoftDeleteNotebook(nb.id)}
                            onDuplicate={onDuplicateNotebook}
                            onExportPdf={onExportNotebookPdf}
                            onMoveToFolder={(target) => setMoveItem({ item: target, type: 'notebook' })}
                            onRename={(target) => setRenameItem({ item: target, type: 'notebook' })}
                            onToggleFavorite={handleToggleFavoriteNotebook}
                            onShare={handleShare}
                            onCopyLink={handleCopyLink}
                            isSelectMode={isSelectMode}
                            isSelected={selectedItemIds.has(nb.id)}
                            onToggleSelect={toggleSelectItem}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {favTab === 'pages' && (
                <>
                  {favoritePages.length === 0 ? (
                    <div className="bn-gn-empty-state">
                      <div className="bn-gn-empty-icon">📄</div>
                      <h4 className="text-sm font-semibold text-zinc-200 mb-1">ยังไม่มีหน้ากระดาษที่ติดดาวไว้</h4>
                      <p className="text-xs text-zinc-500 max-w-xs">
                        กดไอคอนรูปดาว ⭐ ที่แถบเครื่องมือด้านบนขณะเขียนสมุดโน้ต เพื่อบันทึกหน้านั้นไว้ที่นี่
                      </p>
                    </div>
                  ) : (
                    <div className="bn-gn-pages-grid">
                      {favoritePages.map(p => {
                        const parentNb = (notebooks || []).find(n => n && n.id === p.notebookId);
                        const nbTitle = parentNb ? parentNb.name : 'สมุดบันทึก';
                        return (
                          <div 
                            key={p.id} 
                            className="bn-gn-fav-page-card"
                            onClick={() => onOpenNotebook(p.notebookId, p.pageIndex)}
                            title={`คลิกเพื่อเปิด "${nbTitle}" หน้า ${p.pageIndex + 1}`}
                          >
                            <div className="bn-gn-fav-page-preview">
                              <span className="bn-gn-fav-page-badge">
                                หน้า {p.pageIndex + 1}
                              </span>
                              <button
                                type="button"
                                className="bn-gn-fav-page-star-btn bn-star-active"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleFavoritePage(p);
                                }}
                                title="นำหน้านี้ออกจากรายการโปรด"
                              >
                                <Star size={13} fill="#f59e0b" color="#f59e0b" className="bn-star-gold" />
                              </button>
                              {p.pdfPageImage ? (
                                <img 
                                  src={p.pdfPageImage} 
                                  alt={`หน้า ${p.pageIndex + 1}`}
                                  className="bn-gn-fav-page-img"
                                />
                              ) : (
                                <div className="bn-gn-fav-page-mock">
                                  <div className="bn-gn-page-rule-line" />
                                  <div className="bn-gn-page-rule-line" />
                                  <div className="bn-gn-page-rule-line" />
                                  <div className="bn-gn-page-rule-line" />
                                  {p.strokes && p.strokes.length > 0 ? (
                                    <div className="bn-gn-page-drawn-indicator">
                                      มีบันทึกเขียน ({p.strokes.length} เส้น)
                                    </div>
                                  ) : (
                                    <div className="bn-gn-page-blank-indicator">
                                      หน้าว่าง
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="bn-gn-fav-page-meta">
                              <span className="bn-gn-fav-page-name truncate" title={nbTitle}>
                                {nbTitle}
                              </span>
                              <span className="bn-gn-fav-page-sub">
                                หน้า {p.pageIndex + 1}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Documents & Trash Grid */}
          {(activeView === 'documents' || activeView === 'trash') && (
            <>
              {visibleFolders.length === 0 && visibleNotebooks.length === 0 ? (
                <div className="bn-gn-empty-state">
                  <div className="bn-gn-empty-icon">
                    {activeView === 'trash' ? '🗑️' : '📁'}
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-200 mb-1">
                    {activeView === 'trash' ? 'ถังขยะว่างเปล่า' :
                     searchQuery ? 'ไม่พบเอกสารที่ค้นหา' : 'โฟลเดอร์นี้ยังว่างเปล่า'}
                  </h4>
                  <p className="text-xs text-zinc-500 max-w-xs">
                    {activeView === 'trash' 
                      ? 'ไม่มีเอกสารหรือโฟลเดอร์ที่ถูกลบ' 
                      : 'กดปุ่ม "+ ใหม่" ด้านบนเพื่อเริ่มสร้างสมุดบันทึกหรือโฟลเดอร์'}
                  </p>
                </div>
              ) : (
                <div className="bn-gn-grid">
                  {/* Folders */}
                  {visibleFolders.map(f => (
                    <div key={f.id} className="relative group">
                      <FolderCard 
                        folder={f}
                        count={getItemCount(f.id)}
                        onClick={() => {
                          if (activeView !== 'trash') {
                            onNavigateFolder(f.id);
                          }
                        }}
                        onDelete={activeView === 'trash' ? () => onDeleteFolder(f.id) : () => handleSoftDeleteFolder(f.id)}
                        onRename={(target) => setRenameItem({ item: target, type: 'folder' })}
                        onMove={(target) => setMoveItem({ item: target, type: 'folder' })}
                        onUpdateFolder={handleUpdateFolder}
                        onToggleFavorite={handleToggleFavoriteFolder}
                        onDropNotebook={onMoveNotebookToFolder}
                        isSelectMode={isSelectMode}
                        isSelected={selectedItemIds.has(f.id)}
                        onToggleSelect={toggleSelectItem}
                      />
                      {activeView === 'trash' && (
                        <div className="mt-1 flex justify-center gap-2">
                          <button
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-md"
                            onClick={() => handleRestoreFolder(f.id)}
                          >
                            <RotateCcw size={12} />
                            <span>กู้คืน</span>
                          </button>
                          <button
                            className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 bg-red-500/10 px-2.5 py-1 rounded-md"
                            onClick={() => onDeleteFolder(f.id)}
                          >
                            <Trash2 size={12} />
                            <span>ลบถาวร</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Notebooks */}
                  {visibleNotebooks.map(nb => (
                    <div key={nb.id} className="relative group">
                      <NotebookCard 
                        notebook={nb}
                        folders={folders}
                        onClick={() => {
                          if (activeView !== 'trash') {
                            onOpenNotebook(nb.id);
                          }
                        }}
                        onDelete={activeView === 'trash' ? () => onDeleteNotebook(nb.id) : () => handleSoftDeleteNotebook(nb.id)}
                        onDuplicate={onDuplicateNotebook}
                        onExportPdf={onExportNotebookPdf}
                        onMoveToFolder={(target) => setMoveItem({ item: target, type: 'notebook' })}
                        onRename={(target) => setRenameItem({ item: target, type: 'notebook' })}
                        onToggleFavorite={handleToggleFavoriteNotebook}
                        onShare={handleShare}
                        onCopyLink={handleCopyLink}
                        isSelectMode={isSelectMode}
                        isSelected={selectedItemIds.has(nb.id)}
                        onToggleSelect={toggleSelectItem}
                      />
                      {activeView === 'trash' && (
                        <div className="mt-1 flex justify-center gap-2">
                          <button
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-md"
                            onClick={() => handleRestoreNotebook(nb.id)}
                          >
                            <RotateCcw size={12} />
                            <span>กู้คืน</span>
                          </button>
                          <button
                            className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 bg-red-500/10 px-2.5 py-1 rounded-md"
                            onClick={() => onDeleteNotebook(nb.id)}
                          >
                            <Trash2 size={12} />
                            <span>ลบถาวร</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="bn-gn-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      <NewItemModal 
        isOpen={isNewItemModalOpen}
        onClose={() => setIsNewItemModalOpen(false)}
        onCreateFolder={onCreateFolder}
        onCreateNotebook={onCreateNotebook}
        onOpenPdfImport={() => setIsPdfModalOpen(true)}
        onOpenBnoteImport={() => bnoteFileInputRef.current?.click()}
        currentFolderId={currentFolderId}
      />

      <PdfImportModal 
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onImportSuccess={onImportPdfSuccess}
        currentFolderId={currentFolderId}
      />

      <RenameModal 
        isOpen={!!renameItem}
        initialName={renameItem?.item?.name || ''}
        title={renameItem?.type === 'folder' ? 'ตั้งชื่อโฟลเดอร์ใหม่' : 'ตั้งชื่อสมุดบันทึกใหม่'}
        onClose={() => setRenameItem(null)}
        onConfirm={handleConfirmRename}
      />

      <MoveModal 
        isOpen={!!moveItem}
        item={moveItem?.item}
        itemType={moveItem?.type}
        folders={folders.filter(f => !f.isDeleted)}
        onClose={() => setMoveItem(null)}
        onConfirm={handleConfirmMove}
      />

      {/* Batch Move Modal */}
      <MoveModal 
        isOpen={!!batchMoveItems}
        items={batchMoveItems}
        folders={folders.filter(f => !f.isDeleted)}
        onClose={() => setBatchMoveItems(null)}
        onConfirm={handleConfirmBatchMove}
      />

      {/* Global Search Across Everything */}
      <SearchModal 
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        folders={folders}
        notebooks={notebooks}
        onOpenNotebook={onOpenNotebook}
        onNavigateFolder={(folderId) => {
          setActiveView('documents');
          onNavigateFolder(folderId);
        }}
      />

      {/* Complete Settings Modal (Google Drive, Backups, Paper Defaults, Theme) */}
      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        isDriveConnected={isDriveConnected}
        driveUserEmail="H:\My Drive\BetterNote.AppPC"
        isSyncing={isSyncing}
        currentTheme={currentTheme}
        onSelectTheme={onSelectTheme}
        onTriggerAutoSync={onTriggerAutoSync}
        onExportBackup={onExportBackup}
        onImportBackup={onImportBackup}
        onOpenDriveModal={onOpenDriveModal}
      />

      {/* Backup Inspection & Status Modal */}
      <BackupStatusModal 
        isOpen={isBackupStatusModalOpen}
        onClose={() => setIsBackupStatusModalOpen(false)}
        notebooks={notebooks}
        onTriggerSync={onTriggerAutoSync}
        onRestoreBackup={handleExecuteCloudRestore}
      />
    </div>
  );
};
