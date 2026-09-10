import React, { useState } from 'react';
import { X, Book, Folder, Check, FileUp, Sparkles, FileCode2 } from 'lucide-react';
import { NOTEBOOK_COVERS } from '../../data/covers';
import { PAPER_TEMPLATES, PAPER_SIZES, getPaperSize } from '../../data/templates';

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
    const name = notebookName.trim() || 'สมุดบันทึกไม่มีชื่อ';
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
        className="bn-modal-card bn-modal-md"
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
                {tab === 'notebook' ? 'สร้างสมุดโน้ตใหม่' : 'สร้างโฟลเดอร์ใหม่'}
              </h3>
              <p className="bn-settings-sub">
                {tab === 'notebook' ? 'เลือกขนาดกระดาษ ทิศทาง และแบบลายเส้นที่ต้องการ' : 'จัดระเบียบเอกสารของคุณด้วยโฟลเดอร์สีสันสวยงาม'}
              </p>
            </div>
          </div>
          <button 
            className="bn-modal-close-btn" 
            onClick={onClose}
            title="ปิดหน้าต่าง"
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
            <span>สมุดบันทึก & กระดาษ</span>
          </button>

          <button 
            type="button"
            className={`bn-settings-tab-item ${tab === 'folder' ? 'bn-settings-tab-item-active' : ''}`}
            onClick={() => setTab('folder')}
          >
            <Folder size={16} className={tab === 'folder' ? 'text-amber-400' : 'text-zinc-400'} />
            <span>โฟลเดอร์</span>
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
              <span>นำเข้าเอกสาร PDF...</span>
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
              <span>นำเข้าไฟล์ .bnote...</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="bn-modal-body">
          {tab === 'notebook' ? (
            <form onSubmit={handleCreateNotebook} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7', display: 'block', marginBottom: '6px' }}>
                  ชื่อสมุดโน้ต
                </label>
                <input 
                  type="text" 
                  className="bn-input" 
                  placeholder="เช่น สรุปชีววิทยา บทที่ 1, สมุดวางแผนประจำปี"
                  value={notebookName}
                  onChange={(e) => setNotebookName(e.target.value)}
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* Paper Size Selection */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7' }}>
                    ขนาดหน้ากระดาษ (Paper Size)
                  </label>
                  <span style={{ fontSize: '11px', color: '#60a5fa' }}>
                    {PAPER_SIZES.find(s => s.id === selectedSize)?.fullName || selectedSize}
                  </span>
                </div>
                <div className="bn-new-paper-grid">
                  {PAPER_SIZES.map(s => {
                    const isSel = selectedSize === s.id;
                    return (
                      <div
                        key={s.id}
                        className={`bn-new-paper-card ${isSel ? 'bn-new-paper-card-active' : ''}`}
                        onClick={() => setSelectedSize(s.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>{s.name}</span>
                          {s.badge && (
                            <span style={{ 
                              fontSize: '9px', 
                              fontWeight: 700, 
                              background: 'rgba(59, 130, 246, 0.25)', 
                              color: '#60a5fa', 
                              padding: '2px 5px', 
                              borderRadius: '4px' 
                            }}>
                              {s.badge}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: '#a1a1aa', marginTop: '3px' }}>
                          {s.width} × {s.height} px
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Paper Orientation */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7', display: 'block', marginBottom: '6px' }}>
                  ทิศทางหน้ากระดาษ
                </label>
                <div className="bn-new-orient-row">
                  <button
                    type="button"
                    className={`bn-new-orient-btn ${selectedOrientation === 'portrait' ? 'bn-new-orient-btn-active' : ''}`}
                    onClick={() => setSelectedOrientation('portrait')}
                  >
                    <div style={{ width: '12px', height: '16px', border: '1.5px solid currentColor', borderRadius: '2px' }} />
                    <span>แนวตั้ง (Portrait)</span>
                  </button>
                  <button
                    type="button"
                    className={`bn-new-orient-btn ${selectedOrientation === 'landscape' ? 'bn-new-orient-btn-active' : ''}`}
                    onClick={() => setSelectedOrientation('landscape')}
                  >
                    <div style={{ width: '16px', height: '12px', border: '1.5px solid currentColor', borderRadius: '2px' }} />
                    <span>แนวนอน (Landscape)</span>
                  </button>
                </div>
              </div>

              {/* Paper Template Selection */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7', display: 'block', marginBottom: '6px' }}>
                  เลือกรูปแบบหน้ากระดาษ (Paper Template)
                </label>
                <div className="bn-templates-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  {PAPER_TEMPLATES.map((tmpl) => (
                    <div 
                      key={tmpl.id}
                      className={`bn-template-card ${selectedTemplate === tmpl.id ? 'bn-template-card-selected' : ''}`}
                      onClick={() => setSelectedTemplate(tmpl.id)}
                    >
                      <div className="bn-template-radio">
                        {selectedTemplate === tmpl.id && <div className="bn-template-radio-inner"></div>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '12.5px', color: '#f4f4f5' }}>
                          {tmpl.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#a1a1aa' }}>
                          {tmpl.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cover Selection */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7', display: 'block', marginBottom: '6px' }}>
                  เลือกแบบปกสมุด (Cover Style)
                </label>
                <div className="bn-covers-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {NOTEBOOK_COVERS.slice(0, 8).map((cover) => (
                    <div 
                      key={cover.id}
                      className={`bn-cover-option ${selectedCover === cover.id ? 'bn-cover-option-selected' : ''}`}
                      style={{ background: cover.gradient, height: '60px' }}
                      onClick={() => setSelectedCover(cover.id)}
                      title={cover.name}
                    >
                      {selectedCover === cover.id && (
                        <div className="bn-cover-check">
                          <Check size={14} />
                        </div>
                      )}
                      <span className="bn-cover-option-title" style={{ fontSize: '10px' }}>{cover.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bn-modal-footer" style={{ padding: '12px 0 0 0', background: 'transparent' }}>
                <button type="button" className="bn-btn-secondary" onClick={onClose}>
                  ยกเลิก
                </button>
                <button type="submit" className="bn-btn-primary">
                  สร้างสมุดโน้ต
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateFolder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7', display: 'block', marginBottom: '6px' }}>
                  ชื่อโฟลเดอร์
                </label>
                <input 
                  type="text" 
                  className="bn-input" 
                  placeholder="เช่น วิชาเรียนเทอม 1, โครงการวิจัย, บันทึกส่วนตัว"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7', display: 'block', marginBottom: '8px' }}>
                  เลือกสีประจำโฟลเดอร์
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
                  ยกเลิก
                </button>
                <button type="submit" className="bn-btn-primary">
                  สร้างโฟลเดอร์
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
