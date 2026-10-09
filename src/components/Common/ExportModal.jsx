import React, { useState } from 'react';
import { X, FileText, Image as ImageIcon, Database, Download, CheckCircle2, FileEdit, FileCheck } from 'lucide-react';
import { exportNotebookToPdf, exportSinglePageToPdf, exportPageAsImage } from '../../utils/pdfExportEngine';
import { saveFileToDisk } from '../../services/fileSystemService';
import { usePenButtonTap } from '../../utils/usePenButtonTap';
import { useLanguage } from '../../services/i18n';
import { localizeNotebookCopyName } from '../../utils/notebookNames';

const EXPORT_ERROR_TRANSLATIONS = {
  'bnote-empty':'bnoteEmpty',
  'bnote-invalid':'bnoteInvalid',
  'bnote-incomplete':'bnoteIncomplete',
  'bnote-too-large':'bnoteTooLarge',
  'bnote-timeout':'bnoteTimeout',
  'bnote-save-failed':'bnoteSaveFailed',
  'bnote-restart-required':'bnoteRestartRequired',
  "pdf-restart-required": "exportDialogPdfRestart",
  "pdf-print-failed": "exportDialogPdfPrintFailed",
  "pdf-load-failed": "exportDialogPdfLoadFailed",
  "pdf-export-timeout": "exportDialogPdfBatchTimeout",
  "pdf-temp-unavailable": "exportDialogPdfTempFailed",
  "pdf-page-count": "exportDialogPdfCountFailed",
  "pdf-merge-failed": "exportDialogPdfMergeFailed",
  "pdf-page-unavailable": "exportDialogPdfPageFailed",
  "pdf-session-expired": "exportDialogPdfExpired",
  "pdf-export-busy": "exportDialogPdfBusy",
  "pdf-invalid-request": "exportDialogPdfCountFailed",
  "สมุดบันทึกไม่มีหน้าเอกสารให้ส่งออก": "exportDialogEmptyNotebook",
  "ไม่พบข้อมูลหน้าเอกสารที่ต้องการส่งออก": "exportDialogMissingPage",
  "รูปภาพนี้ยังไม่พร้อมสำหรับการส่งออกแบบออฟไลน์": "exportDialogOfflineImageError",
  "ขนาดรูปภาพสำหรับส่งออกไม่ถูกต้อง": "exportDialogInvalidImageSize",
  "พบตำแหน่งที่ไม่ถูกต้องในหน้าส่งออก": "exportDialogInvalidPosition",
  "โหลดภาพสำหรับส่งออกไม่สำเร็จ": "exportDialogImageLoadError",
  "สร้างไฟล์ภาพไม่สำเร็จ": "exportDialogImageCreateError",
  "ตัวเลือกส่งออกภาพไม่ถูกต้อง": "exportDialogImageOptionsError",
  "ไม่สามารถเตรียมภาพส่งออกได้": "exportDialogImageCanvasError",
  "ไม่สามารถเริ่มส่งออก PDF ได้": "exportDialogPdfStartError",
  "ส่งออก PDF ใช้เวลานานเกินไป กรุณาลองส่งออกทีละหน้า": "exportDialogPdfTimeoutError",
  "สร้าง PDF ไม่สำเร็จ กรุณาลองส่งออกทีละหน้า": "exportDialogPdfCreateError"
};

// Resolve internal export errors at the UI boundary; export routines remain unchanged.
const translateExportError = (error, t) => {
  const message = error?.message || '';
  const entry = Object.entries(EXPORT_ERROR_TRANSLATIONS).find(([source]) => message.includes(source));
  const translated = entry ? t(entry[1]) : message || t('exportDialogUnknownError');
  return translated + (error?.exportPage ? ' ' + t('exportDialogPdfRange', '', { first: error.exportPage, last: error.exportEnd }) : '');
};

// Store message keys so already-visible results also follow a language change.
const exportMessage = (key, params = {}) => ({ key, params });

export const ExportModal = ({ isOpen, onClose, notebook, pages, loadPages, loadPage, loadPdfPage, loadBNote, currentPageIndex }) => {
  const { t } = useLanguage();
  const penTap = usePenButtonTap();
  const [isExporting, setIsExporting] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [doneMsg, setDoneMsg] = useState('');
  const [imageFormat, setImageFormat] = useState('png');
  const [imageDpi, setImageDpi] = useState(300);

  if (!isOpen || !notebook) return null;

  // Export full notebook to PDF
  const handleExportPdf = async () => {
    setIsExporting(true);
    setProgressMsg(exportMessage('exportDialogPreparingPdf'));
    setDoneMsg('');

    try {
      await exportNotebookToPdf(notebook, loadPdfPage ? pages : loadPages ? await loadPages() : pages, (current, total, stage) => {
        const key = stage === 'print' ? 'exportDialogPdfPrinting' : stage === 'merge' ? 'exportDialogPdfMerging' :
          stage === 'save' ? 'exportDialogPdfSaving' : 'exportDialogPdfProgress';
        setProgressMsg(exportMessage(key, { page: stage === 'prepare' ? current + 1 : current, total }));
      }, { loadPage: loadPdfPage });
      setDoneMsg(exportMessage('exportDialogPdfSuccess'));
    } catch (err) {
      console.error(err);
      alert(t('exportDialogPdfError') + translateExportError(err, t));
    } finally {
      setIsExporting(false);
      setProgressMsg('');
    }
  };

  // Export current page only to PDF
  const handleExportCurrentPagePdf = async () => {
    setIsExporting(true);
    setProgressMsg(exportMessage('exportDialogPreparingPagePdf', { page: currentPageIndex + 1 }));
    setDoneMsg('');

    try {
      const curPage = loadPage ? await loadPage(currentPageIndex) : pages[currentPageIndex] || pages[0];
      if (!curPage || curPage.__unloaded) throw Error(t('exportDialogMissingPage'));
      await exportSinglePageToPdf(notebook, curPage, currentPageIndex);
      setDoneMsg(exportMessage('exportDialogPagePdfSuccess', { page: currentPageIndex + 1 }));
    } catch (err) {
      console.error(err);
      alert(t('exportDialogPdfError') + translateExportError(err, t));
    } finally {
      setIsExporting(false);
      setProgressMsg('');
    }
  };

  // Export as Editable BetterNote File (.bnote)
  const handleExportBNote = async () => {
    setIsExporting(true);
    setProgressMsg(exportMessage('exportDialogPreparingEditable'));
    setDoneMsg('');

    try {
      let blob;
      if (loadBNote) blob = new Blob([await loadBNote()], { type: 'application/json' });
      else {
        const bnoteData = {
          format: 'BetterNote_Document',
          version: 1,
          exportedAt: new Date().toISOString(),
          notebook,
          pages: loadPages ? await loadPages() : pages
        };

        const jsonStr = JSON.stringify(bnoteData, null, 2);
        blob = new Blob([jsonStr], { type: 'application/json' });
      }
      const filename = `${notebook.name || 'Notebook'}.bnote`;

      const saved = await saveFileToDisk(blob, filename);
      setDoneMsg(saved ? exportMessage('exportDialogEditableSuccess') : '');
    } catch (err) {
      console.error(err);
      alert(t('exportDialogEditableError') + translateExportError(err, t));
    } finally {
      setIsExporting(false);
      setProgressMsg('');
    }
  };

  // Export current page at the selected image format and print resolution
  const handleExportPng = async () => {
    setIsExporting(true);
    setProgressMsg(exportMessage('exportDialogPreparingImage'));
    setDoneMsg('');

    try {
      const curPage = loadPage ? await loadPage(currentPageIndex) : pages[currentPageIndex] || pages[0];
      if (!curPage || curPage.__unloaded) throw Error(t('exportDialogMissingPage'));
      const result = await exportPageAsImage(curPage, notebook.templateId, { format: imageFormat, dpi: imageDpi });
      const extension = imageFormat === 'png' ? 'png' : 'jpg';
      const filename = `${notebook.name}_Page_${(curPage.pageIndex || 0) + 1}.${extension}`;
      const saved = await saveFileToDisk(result.blob, filename, [{
        description: t(imageFormat === 'png' ? 'exportDialogPngFileType' : 'exportDialogJpegFileType'),
        accept: { [result.blob.type]: imageFormat === 'png' ? ['.png'] : ['.jpg', '.jpeg'] }
      }]);
      setDoneMsg(saved
        ? exportMessage(result.limited ? 'exportDialogImageSuccessLimited' : 'exportDialogImageSuccess', {
          format: imageFormat === 'png' ? 'PNG' : 'JPEG', width: result.width, height: result.height
        })
        : exportMessage('exportDialogImageCancelled'));
    } catch (err) {
      console.error(err);
      alert(t('exportDialogImageError') + translateExportError(err, t));
    } finally {
      setIsExporting(false);
      setProgressMsg('');
    }
  };

  return (
    <div className="bn-modal-backdrop" onClick={onClose}>
      <div {...penTap} className="bn-modal-content bn-modal-cloud bn-export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="bn-modal-header">
          <div>
            <h2 className="bn-modal-title">{t('exportDialogTitle')}</h2>
            <p className="bn-modal-subtitle">{t('notebook')}: {localizeNotebookCopyName(notebook.name, t('notebookCopySuffix'))}</p>
          </div>
          <button className="bn-modal-close-btn" onClick={onClose} aria-label={t('close')}>
            <X size={20} />
          </button>
        </div>

        <div className="bn-modal-body">
          <div className="bn-export-options-grid">
            {/* Option 1: Export Current Page as PDF */}
            <div className="bn-export-card border-red-500/40 bg-red-500/5 hover:border-red-500/70" onClick={!isExporting ? handleExportCurrentPagePdf : undefined}>
              <div className="bn-export-card-icon bg-red-500/15 text-red-400">
                <FileCheck size={28} />
              </div>
              <div className="bn-export-card-info">
                <div className="flex items-center gap-2">
                  <h3 className="bn-export-card-title text-red-300">{t('exportDialogCurrentPdfTitle', '', { page: currentPageIndex + 1 })}</h3>
                  <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded">.pdf</span>
                </div>
                <p className="bn-export-card-desc">
                  {t('exportDialogCurrentPdfDesc')}
                </p>
              </div>
              <button className="bn-btn-primary bn-btn-sm" disabled={isExporting}>
                <Download size={15} />
                <span>{t('exportDialogDownloadCurrentPdf')}</span>
              </button>
            </div>

            {/* Option 2: Export All Pages as PDF Document */}
            <div className="bn-export-card" onClick={!isExporting ? handleExportPdf : undefined}>
              <div className="bn-export-card-icon bg-red-500/10 text-red-500">
                <FileText size={28} />
              </div>
              <div className="bn-export-card-info">
                <div className="flex items-center gap-2">
                  <h3 className="bn-export-card-title">{t('exportDialogAllPdfTitle')}</h3>
                  <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded">.pdf</span>
                </div>
                <p className="bn-export-card-desc">
                  {t('exportDialogAllPdfDesc')}
                </p>
              </div>
              <button className="bn-btn-secondary bn-btn-sm" disabled={isExporting}>
                <Download size={15} />
                <span>{t('exportDialogDownloadAllPdf')}</span>
              </button>
            </div>

            {/* Option 3: Export Editable BetterNote Document (.bnote) */}
            <div className="bn-export-card border-blue-500/30 bg-blue-500/5 hover:border-blue-500/60" onClick={!isExporting ? handleExportBNote : undefined}>
              <div className="bn-export-card-icon bg-blue-500/15 text-blue-400">
                <FileEdit size={28} />
              </div>
              <div className="bn-export-card-info">
                <div className="flex items-center gap-2">
                  <h3 className="bn-export-card-title text-blue-300">{t('exportDialogEditableTitle')}</h3>
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 font-bold px-1.5 py-0.5 rounded">.bnote</span>
                </div>
                <p className="bn-export-card-desc">
                  {t('exportDialogEditableDesc')} <strong>{t('exportDialogEditableEmphasis')}</strong>
                </p>
              </div>
              <button className="bn-btn-primary bn-btn-sm" disabled={isExporting}>
                <Download size={15} />
                <span>{t('exportDialogDownloadEditable')}</span>
              </button>
            </div>

            {/* Option 3: Export Current Page as Image */}
            <div className="bn-export-card" onClick={!isExporting ? handleExportPng : undefined}>
              <div className="bn-export-card-icon" style={{
                color: '#6ee7b7', border: '1px solid rgba(52, 211, 153, 0.45)',
                background: 'radial-gradient(circle at 30% 20%, rgba(52, 211, 153, 0.3), transparent 65%), linear-gradient(145deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.1))',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
              }}>
                <ImageIcon size={28} style={{ filter: 'drop-shadow(0 0 6px rgba(52, 211, 153, 0.6))' }} />
              </div>
              <div className="bn-export-card-info" style={{ minWidth: 0 }}>
                <div className="flex items-center gap-2">
                  <h3 className="bn-export-card-title">{t('exportDialogImageTitle')}</h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded">{imageFormat === 'png' ? '.png' : '.jpg'}</span>
                </div>
                <p className="bn-export-card-desc">
                  {t('exportDialogImageDesc', '', { page: currentPageIndex + 1 })}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}
                  onClick={(e) => e.stopPropagation()}>
                  <fieldset aria-label={t('exportDialogImageFormatLabel')} style={{ border: 0, flex: '1 1 180px', minWidth: 0 }}>
                    <legend className="text-xs" style={{ marginBottom: 6 }}>{t('exportDialogImageFormat')}</legend>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[{ value: 'png', label: 'PNG', hint: t('exportDialogPngHint') },
                        { value: 'jpeg', label: 'JPEG', hint: t('exportDialogJpegHint') }].map(option => (
                        <button key={option.value} type="button" aria-pressed={imageFormat === option.value}
                          title={option.hint} disabled={isExporting}
                          onClick={(e) => { e.stopPropagation(); setImageFormat(option.value); }}
                          style={{ flex: 1, minWidth: 0, minHeight: 40, borderRadius: 9, fontSize: 12, fontWeight: 600,
                            border: imageFormat === option.value ? '1px solid #34d399' : '1px solid var(--border-medium)',
                            background: imageFormat === option.value ? 'rgba(16, 185, 129, 0.16)' : 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            opacity: isExporting ? 0.55 : 1, cursor: isExporting ? 'wait' : 'pointer' }}>
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset aria-label={t('exportDialogResolutionLabel')} style={{ border: 0, flex: '1 1 180px', minWidth: 0 }}>
                    <legend className="text-xs" style={{ marginBottom: 6 }}>{t('exportDialogResolution')}</legend>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[150, 300, 600].map(dpi => (
                        <button key={dpi} type="button" aria-pressed={imageDpi === dpi}
                          title={t(dpi === 150 ? 'exportDialogDpi150Hint' : dpi === 300 ? 'exportDialogDpi300Hint' : 'exportDialogDpi600Hint')}
                          disabled={isExporting}
                          onClick={(e) => { e.stopPropagation(); setImageDpi(dpi); }}
                          style={{ flex: 1, minWidth: 0, minHeight: 40, borderRadius: 9, fontSize: 12, fontWeight: 600,
                            border: imageDpi === dpi ? '1px solid #34d399' : '1px solid var(--border-medium)',
                            background: imageDpi === dpi ? 'rgba(16, 185, 129, 0.16)' : 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            opacity: isExporting ? 0.55 : 1, cursor: isExporting ? 'wait' : 'pointer' }}>
                          {dpi} DPI
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </div>
              <button className="bn-btn-secondary bn-btn-sm" style={{ flexShrink: 0 }} disabled={isExporting}>
                <Download size={15} />
                <span>{t('exportDialogDownloadImage')}</span>
              </button>
            </div>
          </div>

          {progressMsg && (
            <div className="bn-alert bn-alert-info mt-4">
              <span className="bn-spinner mr-2"></span>
              <span>{t(progressMsg.key, '', progressMsg.params)}</span>
            </div>
          )}

          {doneMsg && (
            <div className="bn-alert bn-alert-success mt-4">
              <CheckCircle2 size={18} />
              <span>{t(doneMsg.key, '', doneMsg.params)}</span>
            </div>
          )}
        </div>

        <div className="bn-modal-footer">
          <button className="bn-btn-secondary" onClick={onClose} disabled={isExporting}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
