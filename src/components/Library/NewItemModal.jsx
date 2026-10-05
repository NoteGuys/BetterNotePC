import React, { useState } from 'react';
import { X, Book, Folder, Check, FileUp, Sparkles, FileCode2 } from 'lucide-react';
import { NOTEBOOK_COVERS } from '../../data/covers';
import { PAPER_TEMPLATES, PAPER_SIZES, getPaperSize } from '../../data/templates';
import { PaperTemplatePreview } from '../Common/PaperTemplatePreview';
import { useLanguage } from '../../services/i18n';

const FOLDER_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Rose
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#64748b'  // Slate
];

export const NewItemModal = ({ 
  isOpen, 
  onClose, 
  onCreateFolder, 
  onCreateNotebook, 
  onOpenPdfImport,
  onOpenBnoteImport,
  currentFolderId 
}) => {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState('notebook'); // 'notebook' | 'folder'
  
  // Folder state
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0]);

  // Notebook state
  const [notebookName, setNotebookName] = useState('');
  const [selectedCover, setSelectedCover] = useState(NOTEBOOK_COVERS[0].id);
  const [selectedTemplate, setSelectedTemplate] = useState(PAPER_TEMPLATES[0].id);
  const [selectedSize, setSelectedSize] = useState('A4');
  const [selectedOrientation, setSelectedOrientation] = useState('portrait');

  if (!isOpen) return null;

  const isWhiteboard = selectedTemplate === 'whiteboard';
  const selectedPaper = PAPER_TEMPLATES.find(item => item.id === selectedTemplate) || PAPER_TEMPLATES[0];

  const handleCreateFolder = (e) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    onCreateFolder({
      id: `folder-${Date.now()}`,
      name: folderName.trim(),
      parentId: currentFolderId,
      color: folderColor,
      createdAt: Date.now()
    });

    setFolderName('');
    onClose();
  };

  const handleCreateNotebook = (e) => {
    e.preventDefault();
    const name = notebookName.trim() || t('untitled', 'สมุดบันทึกไม่มีชื่อ');
    const sizeDim = getPaperSize(selectedSize, selectedOrientation);

    onCreateNotebook({
      id: `nb-${Date.now()}`,
      name,
      folderId: currentFolderId,
      coverId: selectedCover,
      templateId: selectedTemplate,
      sizeId: selectedSize,
      orientation: selectedOrientation,
      pageWidth: sizeDim.width,
      pageHeight: sizeDim.height,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pageCount: 1,
      isPdf: false
    });

    setNotebookName('');
    onClose();
  };

  return (
    <div className="bn-modal-backdrop" onClick={onClose}>
      <div 
        className={`bn-modal-card ${tab === 'notebook' ? 'bn-create-notebook-modal' : 'bn-modal-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bn-settings-header">
          <div className="bn-settings-header-left">
            <div className="bn-settings-icon-badge">
              {tab === 'notebook' ? <Book size={20} className="text-blue-400" /> : <Folder size={20} className="text-amber-400" />}
            </div>
            <div>
              <h3 className="bn-settings-title">
                {tab === 'notebook' ? t('newNotebookTitle', 'สร้างสมุดโน้ตใหม่') : t('newFolderTitle', 'สร้างโฟลเดอร์ใหม่')}
              </h3>
              <p className="bn-settings-sub">
                {tab === 'notebook' ? t('newNotebookSub', 'เลือกขนาดกระดาษ ทิศทาง และแบบลายเส้นที่ต้องการ') : t('newFolderSub', 'จัดระเบียบเอกสารของคุณด้วยโฟลเดอร์สีสันสวยงาม')}
              </p>
            </div>
          </div>
          <button 
            className="bn-modal-close-btn" 
            onClick={onClose}
            title={t('close', 'ปิดหน้าต่าง')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bn-settings-tabs-bar">
          <button 
            type="button"
            className={`bn-settings-tab-item ${tab === 'notebook' ? 'bn-settings-tab-item-active' : ''}`}
            onClick={() => setTab('notebook')}
          >
            <Book size={16} className={tab === 'notebook' ? 'text-blue-400' : 'text-zinc-400'} />
            <span>{t('notebookTab', 'สมุดบันทึก & กระดาษ')}</span>
          </button>

          <button 
            type="button"
            className={`bn-settings-tab-item ${tab === 'folder' ? 'bn-settings-tab-item-active' : ''}`}
            onClick={() => setTab('folder')}
          >
            <Folder size={16} className={tab === 'folder' ? 'text-amber-400' : 'text-zinc-400'} />
            <span>{t('folderTab', 'โฟลเดอร์')}</span>
          </button>

          {onOpenPdfImport && (
            <button 
              type="button"
              className="bn-settings-tab-item"
              onClick={() => {
                onClose();
                onOpenPdfImport();
              }}
            >
              <FileUp size={16} className="text-emerald-400" />
              <span>{t('importPdfTab', 'นำเข้าเอกสาร PDF...')}</span>
            </button>
          )}

          {onOpenBnoteImport && (
            <button 
              type="button"
              className="bn-settings-tab-item"
              onClick={() => {
                onClose();
                onOpenBnoteImport();
              }}
            >
              <FileCode2 size={16} className="text-purple-400" />
              <span>{t('importBnoteTab', 'นำเข้าไฟล์ .bnote...')}</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="bn-modal-body">
          {tab === 'notebook' ? (
            <form onSubmit={handleCreateNotebook} className="bn-create-notebook-form">
              <div className="bn-create-notebook-layout">
                <aside className="bn-create-notebook-settings">
                  <div className="bn-create-field">
                    <label htmlFor="bn-new-notebook-name">{t('notebookNameLabel', 'Notebook name')}</label>
                    <input id="bn-new-notebook-name" type="text" className="bn-input" placeholder={t('notebookNamePlaceholder')}
                      value={notebookName} onChange={e => setNotebookName(e.target.value)} autoFocus />
                  </div>
                  <div className="bn-create-selected-paper">
                    <div className="bn-create-large-preview"><PaperTemplatePreview templateId={selectedTemplate} landscape={!isWhiteboard && selectedOrientation === 'landscape'} /></div>
                    <strong>{t('template_' + selectedTemplate.replace(/-/g, '_'), selectedPaper.name)}</strong>
                    <span>{isWhiteboard ? t('whiteboardUnlimited', 'Unlimited writing space') : `${selectedSize} · ${t(selectedOrientation, selectedOrientation)}`}</span>
                  </div>
                  {isWhiteboard ? <div className="bn-create-whiteboard-note">{t('whiteboardCreateHelp', 'Pan in any direction. PDF export fits all content on one page with a clean margin.')}</div> : <>
                    <div className="bn-create-field">
                      <label>{t('paperSizeLabel', 'Paper size')}</label>
                      <div className="bn-create-size-options">
                        {PAPER_SIZES.map(size => <button key={size.id} type="button" aria-pressed={selectedSize === size.id}
                          className={`bn-create-size-option ${selectedSize === size.id ? 'is-selected' : ''}`} onClick={() => setSelectedSize(size.id)}>
                          <strong>{size.name}</strong><span>{size.id === 'A4' ? '210 × 297' : size.id === 'A3' ? '297 × 420' : '420 × 594'} mm</span>
                        </button>)}
                      </div>
                    </div>
                    <div className="bn-create-field">
                      <label>{t('orientationLabel', 'Orientation')}</label>
                      <div className="bn-new-orient-row">
                        {['portrait', 'landscape'].map(direction => <button key={direction} type="button" aria-pressed={selectedOrientation === direction}
                          className={`bn-new-orient-btn ${selectedOrientation === direction ? 'bn-new-orient-btn-active' : ''}`} onClick={() => setSelectedOrientation(direction)}>
                          <span className={`bn-create-orientation-icon ${direction}`} />{t(direction, direction)}
                        </button>)}
                      </div>
                    </div>
                  </>}
                  <div className="bn-create-field">
                    <label>{t('coverStyleLabel', 'Cover style')}</label>
                    <div className="bn-create-cover-options">
                      {NOTEBOOK_COVERS.slice(0, 8).map(cover => <button key={cover.id} type="button" title={cover.name} aria-label={cover.name}
                        aria-pressed={selectedCover === cover.id} className={`bn-create-cover-option ${selectedCover === cover.id ? 'is-selected' : ''}`}
                        style={{ background: cover.gradient }} onClick={() => setSelectedCover(cover.id)}>
                        {selectedCover === cover.id && <Check size={16} />}<span>{cover.name}</span>
                      </button>)}
                    </div>
                  </div>
                </aside>
                <section className="bn-create-paper-gallery">
                  <div className="bn-create-gallery-heading">
                    <h4>{t('paperTemplateLabel', 'Paper template')}</h4>
                    <p>{t('paperGalleryHelp', 'Choose a paper style. The larger preview shows its pattern clearly.')}</p>
                  </div>
                  <div className="bn-create-template-grid">
                    {PAPER_TEMPLATES.map(template => <button key={template.id} type="button" aria-pressed={selectedTemplate === template.id}
                      className={`bn-create-template-tile ${selectedTemplate === template.id ? 'is-selected' : ''}`} onClick={() => setSelectedTemplate(template.id)}>
                      <div className="bn-create-tile-preview">
                        <PaperTemplatePreview templateId={template.id} landscape={template.id !== 'whiteboard' && selectedOrientation === 'landscape'} />
                        {selectedTemplate === template.id && <span className="bn-create-template-check"><Check size={15} /></span>}
                      </div>
                      <strong>{t('template_' + template.id.replace(/-/g, '_'), template.name)}</strong>
                      <span>{t('template_desc_' + template.id.replace(/-/g, '_'), template.description)}</span>
                    </button>)}
                  </div>
                </section>
              </div>
              <div className="bn-modal-footer bn-create-notebook-footer">
                <span>{t('paperSelectionReady', 'Your paper is ready to create')}</span>
                <button type="button" className="bn-btn-secondary" onClick={onClose}>{t('cancel', 'Cancel')}</button>
                <button type="submit" className="bn-btn-primary">{t('createNotebookBtn', 'Create notebook')}</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateFolder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7', display: 'block', marginBottom: '6px' }}>
                  {t('folderNameLabel', 'ชื่อโฟลเดอร์')}
                </label>
                <input 
                  type="text" 
                  className="bn-input" 
                  placeholder={t('folderNamePlaceholder', 'เช่น วิชาเรียนเทอม 1, โครงการวิจัย, บันทึกส่วนตัว')}
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7', display: 'block', marginBottom: '8px' }}>
                  {t('folderColorLabel', 'เลือกสีประจำโฟลเดอร์')}
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {FOLDER_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        border: folderColor === color ? '3px solid #ffffff' : '2px solid transparent',
                        boxShadow: folderColor === color ? '0 0 10px rgba(255,255,255,0.4)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      onClick={() => setFolderColor(color)}
                    >
                      {folderColor === color && <Check size={16} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bn-modal-footer" style={{ padding: '12px 0 0 0', background: 'transparent' }}>
                <button type="button" className="bn-btn-secondary" onClick={onClose}>
                  {t('cancel', 'ยกเลิก')}
                </button>
                <button type="submit" className="bn-btn-primary">
                  {t('createFolderBtn', 'สร้างโฟลเดอร์')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
