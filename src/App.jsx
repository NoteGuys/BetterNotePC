import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Common/Navbar';
import { DocumentTabBar } from './components/Common/DocumentTabBar';
import { GoogleDriveModal } from './components/Common/GoogleDriveModal';
import { LibraryView } from './components/Library/LibraryView';
import { NoteEditor } from './components/Editor/NoteEditor';
import { 
  seedInitialData, 
  getAllFolders, 
  getAllNotebooks, 
  saveFolder, 
  deleteFolder, 
  saveNotebook, 
  deleteNotebook,
  duplicateNotebook,
  moveNotebookToFolder,
  getPagesByNotebookId,
  getSetting,
  savePage
} from './services/db';
import { exportFullBackup, importFullBackup, importBnoteFile } from './services/fileSystemService';
import { autoBackupService } from './services/autoBackupService';
import { exportNotebookToPdf } from './utils/pdfExportEngine';
import { getPaperSize } from './data/templates';
import { getAppTheme, setAppTheme, applyThemeToDom } from './services/userPreferences';

export function App() {
  const [folders, setFolders] = useState([]);
  const [notebooks, setNotebooks] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [activeNotebookId, setActiveNotebookId] = useState(null);
  const [activeNotebookPageIndex, setActiveNotebookPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Multi-Document Tabs (Max 5 Stacked) & Last Opened Page per notebook
  const [openTabs, setOpenTabs] = useState(() => {
    try {
      const saved = localStorage.getItem('betternote_open_tabs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.slice(0, 5);
      }
    } catch (_) {}
    return [];
  });

  const [notebookPageMap, setNotebookPageMap] = useState(() => {
    try {
      const saved = localStorage.getItem('betternote_notebook_page_cache');
      if (saved) {
        return JSON.parse(saved) || {};
      }
    } catch (_) {}
    return {};
  });

  // Persist openTabs to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem('betternote_open_tabs', JSON.stringify(openTabs));
    } catch (_) {}
  }, [openTabs]);

  // Persist notebookPageMap whenever changed
  useEffect(() => {
    try {
      localStorage.setItem('betternote_notebook_page_cache', JSON.stringify(notebookPageMap));
    } catch (_) {}
  }, [notebookPageMap]);

  // App Theme state (dark / light)
  const [theme, setTheme] = useState(() => getAppTheme());

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    setAppTheme(nextTheme);
    applyThemeToDom(nextTheme);
  };

  const handleSelectTheme = (newTheme) => {
    setTheme(newTheme);
    setAppTheme(newTheme);
    applyThemeToDom(newTheme);
  };

  // Cloud & Google Drive auto-sync state
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(true); // G: drive local sync is connected!
  const [driveEmail, setDriveEmail] = useState('G:\\My Drive');
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  // Start background auto-backup service (every 1 hour & on close)
  useEffect(() => {
    autoBackupService.startScheduledSync();
    const unsubscribe = autoBackupService.subscribe((status) => {
      setIsAutoSyncing(status.syncing);
    });
    return () => unsubscribe();
  }, []);

  // Load all library data
  const loadData = useCallback(async () => {
    try {
      await seedInitialData();
      const [allF, allN, connected, email] = await Promise.all([
        getAllFolders(),
        getAllNotebooks(),
        getSetting('gdrive_connected'),
        getSetting('gdrive_user_email')
      ]);

      setFolders(allF);
      setNotebooks(allN);
      setIsDriveConnected(!!connected);
      setDriveEmail(email || '');
      // Prune any stale tabs for notebooks that no longer exist
      setOpenTabs(prev => prev.filter(tab => allN.some(nb => nb.id === tab.id)).slice(0, 5));
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build folder navigation chain for breadcrumb
  const getFolderChain = () => {
    const chain = [];
    let curId = currentFolderId;
    while (curId) {
      const f = folders.find(item => item.id === curId);
      if (!f) break;
      chain.unshift(f);
      curId = f.parentId;
    }
    return chain;
  };

  // Folder Operations
  const handleCreateFolder = async (folder) => {
    await saveFolder(folder);
    setFolders(prev => [...prev, folder]);
  };

  const handleUpdateFolder = async (folder) => {
    await saveFolder(folder);
    setFolders(prev => prev.map(f => f.id === folder.id ? folder : f));
  };

  const handleDeleteFolder = async (folderId) => {
    await deleteFolder(folderId);
    setFolders(prev => prev.filter(f => f.id !== folderId));
  };

  // =========================================================================
  // MULTI-DOCUMENT TAB OPERATIONS (Max 5 Stacked, Exact Page Retention)
  // =========================================================================

  // Open Notebook with Tab Support
  const handleOpenNotebook = (notebookId, targetPageIndex = null) => {
    const targetNb = notebooks.find(nb => nb.id === notebookId);
    if (!targetNb) return;

    // Determine target page index with prioritized fallbacks
    let pageIdx = 0;
    const existingTab = openTabs.find(t => t.id === notebookId);

    if (targetPageIndex !== null && targetPageIndex !== undefined && targetPageIndex >= 0) {
      pageIdx = targetPageIndex;
    } else if (existingTab && existingTab.pageIndex !== undefined) {
      pageIdx = existingTab.pageIndex;
    } else if (notebookPageMap[notebookId] !== undefined) {
      pageIdx = notebookPageMap[notebookId];
    } else if (targetNb.lastOpenedPageIndex !== undefined) {
      pageIdx = targetNb.lastOpenedPageIndex;
    }

    setOpenTabs(prev => {
      const now = Date.now();
      const tabIdx = prev.findIndex(t => t.id === notebookId);
      if (tabIdx !== -1) {
        // Tab exists: update lastAccessed and pageIndex
        const updated = [...prev];
        updated[tabIdx] = {
          ...updated[tabIdx],
          title: targetNb.name,
          pageIndex: pageIdx,
          lastAccessed: now
        };
        return updated;
      }

      // Tab does not exist: create new tab
      const newTab = {
        id: targetNb.id,
        title: targetNb.name,
        pageIndex: pageIdx,
        lastAccessed: now
      };

      if (prev.length < 5) {
        return [...prev, newTab];
      }

      // Evict oldest / least-recently accessed tab (strictly cap at 5)
      const sortedByAccess = [...prev].sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
      const evictId = sortedByAccess[0].id;
      const remaining = prev.filter(t => t.id !== evictId);
      return [...remaining, newTab];
    });

    setActiveNotebookId(notebookId);
    setActiveNotebookPageIndex(pageIdx);
  };

  // Switch between open tabs
  const handleSelectTab = (tabId) => {
    if (tabId === activeNotebookId) return;

    const targetTab = openTabs.find(t => t.id === tabId);
    if (!targetTab) return;

    setOpenTabs(prev => prev.map(t => t.id === tabId ? { ...t, lastAccessed: Date.now() } : t));
    setActiveNotebookId(tabId);
    setActiveNotebookPageIndex(targetTab.pageIndex || 0);
  };

  // Close a specific tab
  const handleCloseTab = (tabId) => {
    const tabIndex = openTabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const remainingTabs = openTabs.filter(t => t.id !== tabId);
    setOpenTabs(remainingTabs);

    // If the closed tab was the active notebook:
    if (activeNotebookId === tabId) {
      if (remainingTabs.length > 0) {
        // Switch to the adjacent tab (same index or previous)
        const nextIndex = Math.min(tabIndex, remainingTabs.length - 1);
        const nextTab = remainingTabs[nextIndex];
        setActiveNotebookId(nextTab.id);
        setActiveNotebookPageIndex(nextTab.pageIndex || 0);
      } else {
        // No tabs left: return to Library
        setActiveNotebookId(null);
        setActiveNotebookPageIndex(0);
      }
    }
  };

  // Sync active page changes in real-time from NoteEditor
  const handlePageChanged = useCallback((newPageIndex) => {
    setActiveNotebookPageIndex(prev => (prev === newPageIndex ? prev : newPageIndex));
    if (activeNotebookId) {
      setOpenTabs(prev => {
        const cur = prev.find(t => t.id === activeNotebookId);
        if (cur && cur.pageIndex === newPageIndex) return prev;
        return prev.map(t => t.id === activeNotebookId ? { ...t, pageIndex: newPageIndex } : t);
      });
      setNotebookPageMap(prev => {
        if (prev[activeNotebookId] === newPageIndex) return prev;
        return { ...prev, [activeNotebookId]: newPageIndex };
      });
    }
  }, [activeNotebookId]);

  const handleBackToLibrary = () => {
    setActiveNotebookId(null);
  };

  // Notebook Operations
  const handleCreateNotebook = async (notebook) => {
    await saveNotebook(notebook);
    const sizeDim = getPaperSize(notebook.sizeId || 'A4', notebook.orientation || 'portrait');
    // Create initial page for new notebook
    const page0 = {
      id: `${notebook.id}_page_0`,
      notebookId: notebook.id,
      pageIndex: 0,
      templateId: notebook.templateId || 'ruled',
      sizeId: notebook.sizeId || 'A4',
      orientation: notebook.orientation || 'portrait',
      pageWidth: notebook.pageWidth || sizeDim.width,
      pageHeight: notebook.pageHeight || sizeDim.height,
      strokes: [],
      textElements: [],
      imageElements: [],
      updatedAt: Date.now()
    };
    await savePage(page0);

    setNotebooks(prev => [notebook, ...prev]);
    // Automatically open the new notebook in tabs!
    handleOpenNotebook(notebook.id, 0);
  };

  const handleDeleteNotebook = async (notebookId) => {
    const target = notebooks.find(nb => nb.id === notebookId);
    await deleteNotebook(notebookId);
    setNotebooks(prev => prev.filter(nb => nb.id !== notebookId));

    // Remove from openTabs if currently open
    setOpenTabs(prev => {
      const remaining = prev.filter(t => t.id !== notebookId);
      if (activeNotebookId === notebookId) {
        if (remaining.length > 0) {
          const nextTab = remaining[0];
          setActiveNotebookId(nextTab.id);
          setActiveNotebookPageIndex(nextTab.pageIndex || 0);
        } else {
          setActiveNotebookId(null);
          setActiveNotebookPageIndex(0);
        }
      }
      return remaining;
    });

    if (target?.name) {
      await autoBackupService.pruneDeletedNotebook(target.name);
    }
  };

  const handleDuplicateNotebook = async (notebookId) => {
    try {
      const cloned = await duplicateNotebook(notebookId);
      setNotebooks(prev => [cloned, ...prev]);
      alert(`ทำสำเนาสำเร็จ! สร้างสมุด: "${cloned.name}"`);
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถทำสำเนาได้: ' + err.message);
    }
  };

  const handleMoveNotebookToFolder = async (notebookId, targetFolderId) => {
    try {
      await moveNotebookToFolder(notebookId, targetFolderId);
      setNotebooks(prev => prev.map(nb => nb.id === notebookId ? { ...nb, folderId: targetFolderId, updatedAt: Date.now() } : nb));
    } catch (err) {
      console.error('Failed to move notebook:', err);
      alert('ไม่สามารถย้ายไฟล์ได้: ' + err.message);
    }
  };

  const handleNotebookUpdated = async (updated) => {
    await saveNotebook(updated);
    setNotebooks(prev => prev.map(nb => nb.id === updated.id ? updated : nb));
    // Update title in openTabs immediately
    setOpenTabs(prev => prev.map(t => t.id === updated.id ? { ...t, title: updated.name } : t));
  };

  // Import PDF Success handler (supports single notebook or array from batch import)
  const handleImportPdfSuccess = (newPdfNotebookOrArray) => {
    if (Array.isArray(newPdfNotebookOrArray)) {
      if (newPdfNotebookOrArray.length === 0) return;
      setNotebooks(prev => [...newPdfNotebookOrArray, ...prev]);
      handleOpenNotebook(newPdfNotebookOrArray[0].id, 0);
    } else if (newPdfNotebookOrArray) {
      setNotebooks(prev => [newPdfNotebookOrArray, ...prev]);
      handleOpenNotebook(newPdfNotebookOrArray.id, 0);
    }
  };

  // Import .bnote Success handler
  const handleImportBnoteSuccess = (newNotebook) => {
    setNotebooks(prev => [newNotebook, ...prev.filter(nb => nb.id !== newNotebook.id)]);
    handleOpenNotebook(newNotebook.id, 0);
    autoBackupService.runAutoBackup();
  };

  // Export full backup
  const handleExportBackup = async () => {
    try {
      await exportFullBackup();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการสำรองข้อมูล: ' + err.message);
    }
  };

  // Import backup or .bnote file
  const handleImportBackup = async (file) => {
    try {
      if (file.name.endsWith('.bnote')) {
        const importedNb = await importBnoteFile(file, currentFolderId);
        await loadData();
        handleOpenNotebook(importedNb.id, 0);
        alert(`นำเข้าไฟล์ .bnote สำเร็จ! เปิดสมุด "${importedNb.name}" เรียบร้อยแล้ว สามารถแก้ไขข้อความและลายเส้นต่อได้ทันที`);
        autoBackupService.runAutoBackup();
        return;
      }

      const result = await importFullBackup(file);
      alert(`กู้คืนข้อมูลสำเร็จ! นำเข้าแล้ว ${result.notebooksCount} สมุดบันทึก`);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการกู้คืน: ' + err.message);
    }
  };

  // Direct Export Notebook to PDF from Library View
  const handleExportNotebookPdf = async (nb) => {
    try {
      const pages = await getPagesByNotebookId(nb.id);
      if (!pages || pages.length === 0) {
        alert('สมุดเล่มนี้ยังไม่มีหน้าเอกสาร');
      }
      alert(`กำลังส่งออก PDF สำหรับสมุด "${nb.name}"... ระบบจะเริ่มดาวน์โหลดทันทีที่ประมวลผลเสร็จสิ้น`);
      await exportNotebookToPdf(nb, pages);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการส่งออก PDF: ' + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="bn-loading-screen">
        <div className="bn-spinner"></div>
        <p className="text-zinc-400 mt-3 text-sm">กำลังเปิด BetterNote Pro Studio...</p>
      </div>
    );
  }

  // Find active notebook if opened
  const activeNotebook = activeNotebookId 
    ? notebooks.find(nb => nb.id === activeNotebookId) 
    : null;

  return (
    <div className="bn-app-root">
      {/* Pro Studio Multi-Document Tab Bar (Max 5 Stacked) */}
      <DocumentTabBar 
        tabs={openTabs}
        activeTabId={activeNotebookId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onGoHome={handleBackToLibrary}
      />

      {/* Main Workspace: NoteEditor or LibraryView */}
      <div className="bn-main-workspace">
        {activeNotebook ? (
          <NoteEditor 
            key={activeNotebook.id}
            notebook={activeNotebook}
            initialPageIndex={activeNotebookPageIndex}
            onPageChanged={handlePageChanged}
            onBackToLibrary={handleBackToLibrary}
            onNotebookUpdated={handleNotebookUpdated}
          />
        ) : (
          /* Full-Screen Library View */
          <LibraryView 
            folders={folders}
            notebooks={notebooks}
            currentFolderId={currentFolderId}
            folderChain={getFolderChain()}
            onNavigateFolder={(id) => setCurrentFolderId(id)}
            onOpenNotebook={handleOpenNotebook}
            onCreateFolder={handleCreateFolder}
            onUpdateFolder={handleUpdateFolder}
            onCreateNotebook={handleCreateNotebook}
            onUpdateNotebook={handleNotebookUpdated}
            onDuplicateNotebook={handleDuplicateNotebook}
            onMoveNotebookToFolder={handleMoveNotebookToFolder}
            onExportNotebookPdf={handleExportNotebookPdf}
            onDeleteFolder={handleDeleteFolder}
            onDeleteNotebook={handleDeleteNotebook}
            onImportPdfSuccess={handleImportPdfSuccess}
            onImportBnoteSuccess={handleImportBnoteSuccess}
            onOpenDriveModal={() => setIsDriveModalOpen(true)}
            isDriveConnected={isDriveConnected}
            isSyncing={isAutoSyncing}
            currentTheme={theme}
            onToggleTheme={handleToggleTheme}
            onSelectTheme={handleSelectTheme}
            onTriggerAutoSync={(opts) => autoBackupService.runAutoBackup(opts)}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
          />
        )}
      </div>

      {/* Google Drive / Cloud Sync Modal */}
      <GoogleDriveModal 
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        onSyncComplete={loadData}
      />
    </div>
  );
}

export default App;
