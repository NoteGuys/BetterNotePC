import React, { useState } from 'react';
import { X, FileText, Image as ImageIcon, Database, Download, CheckCircle2, FileEdit, FileCheck } from 'lucide-react';
import { exportNotebookToPdf, exportSinglePageToPdf, renderPageToCanvasDataUrl } from '../../utils/pdfExportEngine';
import { saveFileToDisk } from '../../services/fileSystemService';

export const ExportModal = ({ isOpen, onClose, notebook, pages, currentPageIndex }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [doneMsg, setDoneMsg] = useState('');

  if (!isOpen || !notebook) return null;

  // Export full notebook to PDF
  const handleExportPdf = async () => {
    setIsExporting(true);
    setProgressMsg('กำลังเตรียมหน้ากระดาษและเรนเดอร์ PDF คุณภาพสูง...');
    setDoneMsg('');

    try {
      await exportNotebookToPdf(notebook, pages, (current, total) => {
        setProgressMsg(`กำลังเรนเดอร์หน้า ${current} จาก ${total}...`);
      });
      setDoneMsg('ส่งออกไฟล์ PDF สำเร็จเรียบร้อยแล้ว!');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการส่งออก PDF: ' + err.message);
    } finally {
      setIsExporting(false);
      setProgressMsg('');
    }
  };

  // Export current page only to PDF
  const handleExportCurrentPagePdf = async () => {
    setIsExporting(true);
    setProgressMsg(`กำลังเตรียมหน้ากระดาษและเรนเดอร์ PDF หน้า ${currentPageIndex + 1}...`);
    setDoneMsg('');

    try {
      const curPage = pages[currentPageIndex] || pages[0];
      await exportSinglePageToPdf(notebook, curPage, currentPageIndex);
      setDoneMsg(`ส่งออกหน้า ${currentPageIndex + 1} เป็น PDF สำเร็จเรียบร้อยแล้ว!`);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการส่งออก PDF: ' + err.message);
    } finally {
      setIsExporting(false);
      setProgressMsg('');
    }
  };

  // Export as Editable BetterNote File (.bnote)
  const handleExportBNote = async () => {
    setIsExporting(true);
    setProgressMsg('กำลังเตรียมข้อมูลเวกเตอร์และเนื้อหาสมุด...');
    setDoneMsg('');

    try {
      const bnoteData = {
        format: 'BetterNote_Document',
        version: 1,
        exportedAt: new Date().toISOString(),
        notebook,
        pages
      };

      const jsonStr = JSON.stringify(bnoteData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const filename = `${notebook.name || 'Notebook'}.bnote`;

      await saveFileToDisk(blob, filename);
      setDoneMsg('ส่งออกไฟล์ BetterNote (.bnote) สำเร็จ! สามารถนำกลับมาเปิดแก้ไขสิ่งที่เขียนได้ตลอดเวลา');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการส่งออกไฟล์ .bnote: ' + err.message);
    } finally {
      setIsExporting(false);
      setProgressMsg('');
    }
  };

  // Export current page as PNG image
  const handleExportPng = async () => {
    setIsExporting(true);
    setProgressMsg('กำลังบันทึกภาพหน้าปัจจุบัน...');
    setDoneMsg('');

    try {
      const curPage = pages[currentPageIndex] || pages[0];
      const dataUrl = await renderPageToCanvasDataUrl(curPage, notebook.templateId);
      
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const filename = `${notebook.name}_Page_${(curPage.pageIndex || 0) + 1}.jpg`;

      await saveFileToDisk(blob, filename);
      setDoneMsg('ส่งออกไฟล์ภาพเรียบร้อยแล้ว!');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการส่งออกภาพ: ' + err.message);
    } finally {
      setIsExporting(false);
      setProgressMsg('');
    }
  };

  return (
    <div className="bn-modal-backdrop" onClick={onClose}>
      <div className="bn-modal-content bn-modal-cloud" onClick={(e) => e.stopPropagation()}>
        <div className="bn-modal-header">
          <div>
            <h2 className="bn-modal-title">ส่งออกเอกสาร (Export)</h2>
            <p className="bn-modal-subtitle">สมุด: {notebook.name}</p>
          </div>
          <button className="bn-modal-close-btn" onClick={onClose}>
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
                  <h3 className="bn-export-card-title text-red-300">เอกสาร PDF (เฉพาะหน้านี้: หน้า {currentPageIndex + 1})</h3>
                  <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded">.pdf</span>
                </div>
                <p className="bn-export-card-desc">
                  ส่งออกเฉพาะหน้าที่กำลังเปิดอยู่เป็นไฟล์ PDF สัดส่วนภาพเดิมคมชัด 100%
                </p>
              </div>
              <button className="bn-btn-primary bn-btn-sm" disabled={isExporting}>
                <Download size={15} />
                <span>ดาวน์โหลดหน้านี้ (.pdf)</span>
              </button>
            </div>

            {/* Option 2: Export All Pages as PDF Document */}
            <div className="bn-export-card" onClick={!isExporting ? handleExportPdf : undefined}>
              <div className="bn-export-card-icon bg-red-500/10 text-red-500">
                <FileText size={28} />
              </div>
              <div className="bn-export-card-info">
                <div className="flex items-center gap-2">
                  <h3 className="bn-export-card-title">เอกสาร PDF (ทุกหน้าทั้งเล่ม)</h3>
                  <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded">.pdf</span>
                </div>
                <p className="bn-export-card-desc">
                  รวมทุกหน้าและลายมือจด/ไฮไลท์/รูปภาพ ออกเป็นไฟล์ PDF คุณภาพสูง สัดส่วนธรรมชาติ
                </p>
              </div>
              <button className="bn-btn-secondary bn-btn-sm" disabled={isExporting}>
                <Download size={15} />
                <span>ดาวน์โหลดทั้งเล่ม (.pdf)</span>
              </button>
            </div>

            {/* Option 3: Export Editable BetterNote Document (.bnote) */}
            <div className="bn-export-card border-blue-500/30 bg-blue-500/5 hover:border-blue-500/60" onClick={!isExporting ? handleExportBNote : undefined}>
              <div className="bn-export-card-icon bg-blue-500/15 text-blue-400">
                <FileEdit size={28} />
              </div>
              <div className="bn-export-card-info">
                <div className="flex items-center gap-2">
                  <h3 className="bn-export-card-title text-blue-300">ไฟล์ BetterNote แก้ไขได้ (Editable)</h3>
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 font-bold px-1.5 py-0.5 rounded">.bnote</span>
                </div>
                <p className="bn-export-card-desc">
                  เก็บบันทึกลายเส้นเวกเตอร์และข้อความทั้งหมด เมื่อดาวน์โหลดหรือนำกลับมาเปิดใหม่ <strong>สามารถแก้ไข ลบ หรือเขียนต่อสิ่งที่เขียนได้ 100%</strong>
                </p>
              </div>
              <button className="bn-btn-primary bn-btn-sm" disabled={isExporting}>
                <Download size={15} />
                <span>ดาวน์โหลด .bnote</span>
              </button>
            </div>

            {/* Option 3: Export Current Page as Image */}
            <div className="bn-export-card" onClick={!isExporting ? handleExportPng : undefined}>
              <div className="bn-export-card-icon bg-emerald-500/10 text-emerald-400">
                <ImageIcon size={28} />
              </div>
              <div className="bn-export-card-info">
                <div className="flex items-center gap-2">
                  <h3 className="bn-export-card-title">ไฟล์ภาพหน้าปัจจุบัน (Image)</h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded">.jpg</span>
                </div>
                <p className="bn-export-card-desc">
                  ส่งออกเฉพาะหน้าที่กำลังดู (หน้า {currentPageIndex + 1}) เป็นภาพความละเอียดสูง
                </p>
              </div>
              <button className="bn-btn-secondary bn-btn-sm" disabled={isExporting}>
                <Download size={15} />
                <span>ดาวน์โหลดภาพ</span>
              </button>
            </div>
          </div>

          {progressMsg && (
            <div className="bn-alert bn-alert-info mt-4">
              <span className="bn-spinner mr-2"></span>
              <span>{progressMsg}</span>
            </div>
          )}

          {doneMsg && (
            <div className="bn-alert bn-alert-success mt-4">
              <CheckCircle2 size={18} />
              <span>{doneMsg}</span>
            </div>
          )}
        </div>

        <div className="bn-modal-footer">
          <button className="bn-btn-secondary" onClick={onClose} disabled={isExporting}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
