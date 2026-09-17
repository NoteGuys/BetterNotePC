import React, { useState, useRef } from 'react';
import { X, FileUp, FileText, CheckCircle2, AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { importPdfAsNotebook } from '../../services/pdfService';
import { useLanguage } from '../../services/i18n';

export const PdfImportModal = ({ isOpen, onClose, onImportSuccess, currentFolderId }) => {
  const { t } = useLanguage();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentImportIndex, setCurrentImportIndex] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const [pageProgress, setPageProgress] = useState({ current: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const addValidPdfFiles = (filesList) => {
    const newPdfs = [];
    let nonPdfCount = 0;

    for (const file of filesList) {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // Avoid duplicate by name & size
        if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
          newPdfs.push(file);
        }
      } else {
        nonPdfCount++;
      }
    }

    if (newPdfs.length > 0) {
      setSelectedFiles(prev => [...prev, ...newPdfs]);
      setErrorMsg('');
    }

    if (nonPdfCount > 0 && newPdfs.length === 0) {
      setErrorMsg(t('pdfErrorInvalid', 'กรุณาเลือกไฟล์เอกสาร .pdf เท่านั้น'));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addValidPdfFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addValidPdfFiles(Array.from(e.target.files));
    }
    // Reset file input value so re-selecting the same file triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (indexToRemove) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setErrorMsg('');
  };

  const handleStartImport = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setErrorMsg('');
    const importedNotebooks = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setCurrentImportIndex(i);
        setCurrentFileName(file.name);
        setPageProgress({ current: 0, total: 0 });

        const notebook = await importPdfAsNotebook(
          file, 
          currentFolderId, 
          (current, total) => {
            setPageProgress({ current, total });
          }
        );
        importedNotebooks.push(notebook);
      }

      setIsProcessing(false);
      setSelectedFiles([]);
      onImportSuccess(importedNotebooks);
      onClose();
    } catch (err) {
      console.error('Batch PDF Import error:', err);
      setErrorMsg(t('pdfErrorGeneric', 'เกิดข้อผิดพลาดในการนำเข้า PDF: {error}', { error: err.message || t('pdfErrorCorrupt', 'ไฟล์อาจเสียหายหรือไม่รองรับ') }));
      setIsProcessing(false);
    }
  };

  const totalSizeMb = (selectedFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2);

  return (
    <div className="bn-modal-backdrop" onClick={!isProcessing ? onClose : undefined}>
      <div className="bn-modal-content" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
        <div className="bn-modal-header">
          <div>
            <h2 className="bn-modal-title">{t('pdfImportTitle', 'นำเข้าไฟล์เอกสาร PDF')}</h2>
            <p className="bn-modal-subtitle">
              {t('pdfImportSubtitle', 'แปลงหน้า PDF เป็นสมุดบันทึก รองรับการเลือกและอัพโหลดพร้อมกันหลายไฟล์')}
            </p>
          </div>
          <button className="bn-modal-close-btn" onClick={onClose} disabled={isProcessing} title={t('close', 'ปิด')}>
            <X size={20} />
          </button>
        </div>

        <div className="bn-modal-body">
          {/* Hidden File Input supporting multiple files */}
          <input 
            type="file" 
            ref={fileInputRef} 
            multiple
            accept=".pdf,application/pdf" 
            style={{ display: 'none' }} 
            onChange={handleFileChange} 
          />

          {/* Dropzone */}
          <div 
            className={`bn-dropzone ${dragActive ? 'bn-dropzone-active' : ''} ${selectedFiles.length > 0 ? 'bn-dropzone-has-file' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            style={{ padding: selectedFiles.length > 0 ? '20px' : '36px 20px', cursor: isProcessing ? 'default' : 'pointer' }}
          >
            <div className="bn-dropzone-placeholder flex flex-col items-center">
              <FileUp size={40} className="text-blue-400 mb-2" />
              <span className="font-semibold text-sm text-zinc-100 text-center">
                {t('pdfDragDropHint', 'ลากไฟล์ PDF หลายๆ ไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์')}
              </span>
              <span className="text-xs text-zinc-400 mt-1 text-center">
                {t('pdfDropSubhint', 'รองรับการเลือกพร้อมกันหลายไฟล์ (.pdf) เรนเดอร์คมชัดระดับ Hi-DPI')}
              </span>
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="mt-4 p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 mb-2">
                <span className="text-xs font-semibold text-zinc-200">
                  {t('pdfSelectedCount', 'เลือกแล้ว {count} ไฟล์ ({size} MB)', { count: selectedFiles.length, size: totalSizeMb })}
                </span>
                {!isProcessing && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Plus size={13} />
                      {t('pdfAddMore', 'เพิ่มไฟล์อีก')}
                    </button>
                    <span className="text-zinc-600">|</span>
                    <button
                      type="button"
                      className="text-xs text-zinc-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                      onClick={handleClearAll}
                    >
                      <Trash2 size={13} />
                      {t('pdfClearAll', 'ล้างทั้งหมด')}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {selectedFiles.map((file, idx) => (
                  <div 
                    key={`${file.name}-${idx}`} 
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/30 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      <FileText size={15} className="text-red-400 flex-shrink-0" />
                      <span className="truncate text-zinc-200 font-medium" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-[11px] text-zinc-400 flex-shrink-0">
                        ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>

                    {!isProcessing && (
                      <button
                        type="button"
                        className="text-zinc-500 hover:text-red-400 p-0.5 rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(idx);
                        }}
                        title={t('pdfRemoveFile', 'ลบไฟล์นี้ออก')}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          {isProcessing && (
            <div className="bn-import-progress-box mt-4 p-3 bg-blue-950/20 border border-blue-900/40 rounded-xl">
              <div className="flex items-center justify-between text-xs text-zinc-200 mb-1">
                <span className="flex items-center gap-1.5 font-medium text-blue-400">
                  <Loader2 size={14} className="animate-spin text-blue-400" />
                  {t('pdfImportingItem', 'กำลังนำเข้าไฟล์ที่ {current} จาก {total}', { current: currentImportIndex + 1, total: selectedFiles.length })}
                </span>
                <span className="font-mono text-zinc-400">
                  {t('pdfPageProgress', 'หน้า {current} จาก {total}', { current: pageProgress.current, total: pageProgress.total })}
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 truncate mb-2">
                📄 {currentFileName}
              </div>
              <div className="bn-progress-bar-bg">
                <div 
                  className="bn-progress-bar-fill"
                  style={{ width: `${pageProgress.total ? (pageProgress.current / pageProgress.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="bn-alert bn-alert-error mt-3">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        <div className="bn-modal-footer">
          <button className="bn-btn-secondary" onClick={onClose} disabled={isProcessing}>
            {t('cancel', 'ยกเลิก')}
          </button>
          <button 
            className="bn-btn-primary flex items-center gap-2"
            onClick={handleStartImport}
            disabled={selectedFiles.length === 0 || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t('pdfImportingBtn', 'กำลังนำเข้า {current}/{total}...', { current: currentImportIndex + 1, total: selectedFiles.length })}</span>
              </>
            ) : (
              <>
                <FileText size={16} />
                <span>
                  {selectedFiles.length > 0 
                    ? t('pdfStartImportCount', 'เริ่มนำเข้า PDF ({count} ไฟล์)', { count: selectedFiles.length })
                    : t('pdfStartImport', 'เริ่มนำเข้า PDF')}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
