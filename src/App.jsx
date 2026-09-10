import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Common/Navbar';
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
    // Automatically open the new notebook
    setActiveNotebookId(notebook.id);
  };

  const handleDeleteNotebook = async (notebookId) => {
    const target = notebooks.find(nb => nb.id === notebookId);
    await deleteNotebook(notebookId);
    setNotebooks(prev => prev.filter(nb => nb.id !== notebookId));
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
  };

  // Import PDF Success handler (supports single notebook or array from batch import)
  const handleImportPdfSuccess = (newPdfNotebookOrArray) => {
    if (Array.isArray(newPdfNotebookOrArray)) {
      if (newPdfNotebookOrArray.length === 0) return;
      setNotebooks(prev => [...newPdfNotebookOrArray, ...prev]);
      setActiveNotebookId(newPdfNotebookOrArray[0].id);
    } else if (newPdfNotebookOrArray) {
      setNotebooks(prev => [newPdfNotebookOrArray, ...prev]);
      setActiveNotebookId(newPdfNotebookOrArray.id);
    }
  };

  // Import .bnote Success handler
  const handleImportBnoteSuccess = (newNotebook) => {
    setNotebooks(prev => [newNotebook, ...prev.filter(nb => nb.id !== newNotebook.id)]);
    setActiveNotebookId(newNotebook.id);
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
        setActiveNotebookId(importedNb.id);
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
    <div className="flex flex-col h-screen overflow-hidden">
      {/* If inside a notebook editor, render full-screen NoteEditor */}
      {activeNotebook ? (
        <NoteEditor 
          notebook={activeNotebook}
          initialPageIndex={activeNotebookPageIndex}
          onBackToLibrary={() => {
            setActiveNotebookId(null);
            setActiveNotebookPageIndex(0);
          }}
          onNotebookUpdated={handleNotebookUpdated}
        />
      ) : (
        /* Full-Screen Goodnotes Library View */
        <LibraryView 
          folders={folders}
          notebooks={notebooks}
          currentFolderId={currentFolderId}
          folderChain={getFolderChain()}
          onNavigateFolder={(id) => setCurrentFolderId(id)}
          onOpenNotebook={(id, pageIndex = 0) => {
            setActiveNotebookId(id);
            setActiveNotebookPageIndex(pageIndex || 0);
          }}
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
