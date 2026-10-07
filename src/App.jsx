import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { Navbar } from './components/Common/Navbar';
import { DocumentTabBar } from './components/Common/DocumentTabBar';
import BackupStatusModal from './components/Library/BackupStatusModal';
import { UpdateNotificationModal } from './components/Common/UpdateNotificationModal';
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
import { flushLocalSaves, getLocalSaveSnapshot } from './services/localSaveService';
import { autoBackupService } from './services/autoBackupService';
import { checkForStoreUpdate } from './services/updateService';
import { exportNotebookToPdf } from './utils/pdfExportEngine';
import { getPaperSize } from './data/templates';
import { getAppTheme, setAppTheme, applyThemeToDom } from './services/userPreferences';
import { useLanguage } from './services/i18n';
import { MAX_OPEN_NOTEBOOK_TABS } from './utils/documentTabs';
import { localizeNotebookCopyName } from './utils/notebookNames';
import { subscribeNotebookCovers, setNotebookCoverLibraryVisible } from './services/notebookCoverService';

export function App() {
  const { language, t } = useLanguage();
  const [folders, setFolders] = useState([]);
  const [notebooks, setNotebooks] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [activeNotebookId, setActiveNotebookId] = useState(null);
  const [activeNotebookPageIndex, setActiveNotebookPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isClosingAfterSave, setIsClosingAfterSave] = useState(false);

  const isCoverLibraryVisible = !isLoading && !(activeNotebookId && notebooks.some(item => item.id === activeNotebookId));
  useLayoutEffect(() => {
    // Pause previews before an editor becomes interactive; resume only in the library.
    setNotebookCoverLibraryVisible(isCoverLibraryVisible);
    return () => setNotebookCoverLibraryVisible(false);
  }, [isCoverLibraryVisible]);

  useEffect(() => subscribeNotebookCovers(saved => {
    setNotebooks(items => items.map(item => item.id === saved.id
      ? { ...item, firstPageThumbnail: saved.firstPageThumbnail } : item));
  }), []);

  // Automatic Daily Microsoft Store Update Check
  const [updateModalData, setUpdateModalData] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const runStartupUpdateCheck = async () => {
      // Delay slightly (1500ms) so startup database loading settles smoothly
      await new Promise(r => setTimeout(r, 1500));
      if (!isMounted) return;

      try {
        const updateResult = await checkForStoreUpdate();
        if (isMounted && updateResult?.hasUpdate) {
          setUpdateModalData(updateResult);
          setIsUpdateModalOpen(true);
        }
      } catch (err) {
        console.warn('Startup update check notice:', err);
      }
    };

    runStartupUpdateCheck();
    return () => { isMounted = false; };
  }, []);

  // Multi-Document Tabs (Max 9) & Last Opened Page per notebook
  const [openTabs, setOpenTabs] = useState(() => {
    try {
      const saved = localStorage.getItem('betternote_open_tabs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.slice(0, MAX_OPEN_NOTEBOOK_TABS);
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

  useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('lang', language);
    }
  }, [language]);

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
  const [backupHub, setBackupHub] = useState({ open: false, tab: 'local', restore: null });
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [driveEmail, setDriveEmail] = useState('G:\\My Drive');
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  // Queue folder backups after idle edits, with periodic recovery checks.
  useEffect(() => {
    autoBackupService.startScheduledSync();
    const unsubscribe = autoBackupService.subscribe((status) => {
      setIsAutoSyncing(status.syncing);
    });
    return () => { unsubscribe(); autoBackupService.stopScheduledSync(); };
  }, []);

  // Normal close waits for committed local writes; failures keep this window open.
  useEffect(() => {
    const api = window.electronAPI;
    const labels = {
      title: 'BetterNote', message: t('localSaveCloseFailed'),
      keepOpen: t('localSaveKeepOpen'), retry: t('localSaveRetry')
    };
    const unsubscribe = api?.onCloseSaveRequest?.(async ({ requestId }) => {
      setIsClosingAfterSave(true);
      try {
        document.activeElement?.blur();
        await new Promise(resolve => requestAnimationFrame(resolve));
        await flushLocalSaves({ retry: true });
        api.completeCloseSaveRequest({ requestId, success: true });
      } catch (_) {
        setIsClosingAfterSave(false);
        api.completeCloseSaveRequest({ requestId, success: false, labels });
      }
    });
    const cancel = api?.onCloseSaveCancelled?.(() => setIsClosingAfterSave(false));
    api?.setLocalSaveGuardReady?.({ labels });
    const beforeUnload = event => {
      if (getLocalSaveSnapshot().status !== 'saved') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      unsubscribe?.(); cancel?.();
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [t]);

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
      setOpenTabs(prev => prev.filter(tab => allN.some(nb => nb.id === tab.id)).slice(0, MAX_OPEN_NOTEBOOK_TABS));
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
    const visited = new Set();
    while (curId && !visited.has(curId)) {
      visited.add(curId);
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

  const handleDeleteFolder = async (folderId, { throwOnFailure = false } = {}) => {
    try {
      const result = await deleteFolder(folderId);
      setFolders(result.folders);
      const moved = new Map(result.notebooks.map(notebook => [notebook.id, notebook]));
      setNotebooks(previous => previous.map(notebook => moved.get(notebook.id) || notebook));
      setCurrentFolderId(current => current === folderId ? result.parentId : current);
      return true;
    } catch (error) {
      console.error('Folder removal failed:', error);
      alert(t('localSaveFolderDeleteFailed'));
      if (throwOnFailure) throw error;
      return false;
    }
  };

  // =========================================================================
  // MULTI-DOCUMENT TAB OPERATIONS (Max 9, Exact Page Retention)
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

      if (prev.length < MAX_OPEN_NOTEBOOK_TABS) {
        return [...prev, newTab];
      }

      // Evict oldest / least-recently accessed tab (strictly cap at 9)
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
    const savedNotebook = await saveNotebook(notebook, { ensureUniqueName: true });
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

    setNotebooks(prev => [savedNotebook, ...prev]);
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
      await autoBackupService.pruneDeletedNotebook(target.name, target.id);
    }
  };

  const handleDuplicateNotebook = async (notebookId) => {
    try {
      const cloned = await duplicateNotebook(notebookId, { copySuffix: t('notebookCopySuffix') });
      setNotebooks(prev => [cloned, ...prev]);
      alert(t('duplicateSuccess') + ' "' + localizeNotebookCopyName(cloned.name, t('notebookCopySuffix')) + '"');
    } catch (err) {
      console.error(err);
      alert(t('cannotDuplicate') + ': ' + (err.code === 'NOTEBOOK_NOT_FOUND' ? t('duplicateNotebookNotFound') : err.message));
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

  const handleNotebookCommitted = useCallback(savedNotebook => {
    setNotebooks(prev => prev.map(nb => nb.id === savedNotebook.id ? savedNotebook : nb));
    setOpenTabs(prev => prev.map(tab => tab.id === savedNotebook.id ? { ...tab, title: savedNotebook.name } : tab));
  }, []);

  const handleNotebookUpdated = async updated => {
    const savedNotebook = await saveNotebook(updated, { ensureUniqueName: true });
    handleNotebookCommitted(savedNotebook);
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
        <p className="text-zinc-400 mt-3 text-sm">{t('loadingApp', 'กำลังเปิด BetterNote Pro Studio...')}</p>
      </div>
    );
  }

  // Find active notebook if opened
  const activeNotebook = activeNotebookId 
    ? notebooks.find(nb => nb.id === activeNotebookId) 
    : null;

  return (
    <div className="bn-app-root">
      {/* Pro Studio Multi-Document Tab Bar (Max 9) */}
      <DocumentTabBar 
        tabs={openTabs}
        activeTabId={activeNotebookId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onGoHome={handleBackToLibrary}
        onOpenBackupStatus={() => setBackupHub({ open: true, tab: 'local', restore: null })}
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
            onNotebookUpdated={handleNotebookCommitted}
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
            onOpenDriveModal={() => setBackupHub({ open: true, tab: 'drive', restore: null })}
            onOpenBackupStatus={(tab = 'local', restore = null) => setBackupHub({ open: true, tab, restore })}
            isDriveConnected={isDriveConnected}
            isSyncing={isAutoSyncing}
            currentTheme={theme}
            onToggleTheme={handleToggleTheme}
            onSelectTheme={handleSelectTheme}
            onTriggerAutoSync={(opts) => autoBackupService.runAutoBackup(opts)}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onOpenUpdateModal={(data) => {
              setUpdateModalData(data);
              setIsUpdateModalOpen(true);
            }}
          />
        )}
      </div>

      {isClosingAfterSave && (
        <div className="bn-local-close-overlay" role="status">
          <span>{t('localSaveClosing')}</span>
        </div>
      )}

      <BackupStatusModal isOpen={backupHub.open} initialTab={backupHub.tab}
        onClose={() => setBackupHub({ open: false, tab: 'local', restore: null })}
        notebooks={notebooks} onTriggerSync={opts => autoBackupService.runAutoBackup(opts)}
        onRestoreBackup={backupHub.restore} />

      {/* Microsoft Store Update Notification Modal */}
      <UpdateNotificationModal 
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateData={updateModalData}
      />
    </div>
  );
}

export default App;
