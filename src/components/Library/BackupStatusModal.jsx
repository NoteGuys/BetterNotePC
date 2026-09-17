import React, { useState, useEffect } from 'react';
import { 
  X, ShieldCheck, HardDrive, RefreshCw, FolderOpen, ExternalLink, 
  CheckCircle2, Clock, FileText, Search, AlertCircle, 
  ArrowDownToLine, Loader2, BookOpen, FileCheck, Trash2 
} from 'lucide-react';
import { autoBackupService } from '../../services/autoBackupService';
import { appCacheService } from '../../services/appCacheService';
import { useLanguage } from '../../services/i18n';

export default function BackupStatusModal({ 
  isOpen, 
  onClose, 
  notebooks = [], 
  onTriggerSync,
  onRestoreBackup 
}) {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [syncingNow, setSyncingNow] = useState(false);
  const [statusDetails, setStatusDetails] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'bnote', 'pdf', 'system'
  const [actionNotice, setActionNotice] = useState(null);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const details = await autoBackupService.getBackupStatusDetails();
      setStatusDetails(details);
    } catch (err) {
      console.warn('Failed to load backup status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDetails();
      setActionNotice(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualBackupNow = async () => {
    setSyncingNow(true);
    setActionNotice({ type: 'info', text: t('backupNoticeBackingUp', 'กำลังทำการบันทึกสำรองข้อมูลและเอกสาร PDF ลงดิสก์และ Google Drive...') });
    try {
      if (onTriggerSync) {
        await onTriggerSync({ forcePdf: true });
      } else {
        await autoBackupService.runAutoBackup({ forcePdf: true });
      }
      await new Promise(r => setTimeout(r, 600));
      await fetchDetails();
      setActionNotice({ type: 'success', text: t('backupNoticeSuccess', 'สำรองข้อมูลและไฟล์ PDF ครบทุกสมุดสำเร็จเรียบร้อยแล้ว! 🚀') });
    } catch (err) {
      setActionNotice({ type: 'error', text: t('backupNoticeError', 'เกิดข้อผิดพลาดในการสำรองข้อมูล: {error}', { error: err.message }) });
    } finally {
      setSyncingNow(false);
    }
  };

  const handleOpenFolder = async () => {
    if (!statusDetails?.targetDir) return;
    try {
      await autoBackupService.openBackupFolder(statusDetails.targetDir);
      setActionNotice({ type: 'success', text: t('backupNoticeOpenedFolder', 'เปิดโฟลเดอร์สำรองใน Windows Explorer แล้ว 📂') });
    } catch (err) {
      setActionNotice({ type: 'error', text: t('backupNoticeOpenFolderError', 'ไม่สามารถเปิดโฟลเดอร์ได้: {error}', { error: err.message }) });
    }
  };

  const handleRevealFile = async (filePath, fileName) => {
    if (!filePath) return;
    try {
      const res = await autoBackupService.revealBackupFile(filePath);
      if (res?.success) {
        setActionNotice({ type: 'success', text: t('backupNoticeRevealedFile', 'เปิดและไฮไลต์ไฟล์ {name} ใน Windows Explorer แล้ว 📂', { name: fileName || '' }) });
      } else {
        setActionNotice({ type: 'error', text: t('backupNoticeRevealError', 'ไม่สามารถเปิดไฟล์ได้: {error}', { error: res?.error || (language === 'en' ? 'File not found' : 'ไม่พบไฟล์') }) });
      }
    } catch (err) {
      setActionNotice({ type: 'error', text: t('backupNoticeRevealError', 'ไม่สามารถเปิดไฟล์ได้: {error}', { error: err.message }) });
    }
  };

  const handleClearCache = () => {
    appCacheService.clearAll();
    setActionNotice({ type: 'success', text: t('backupNoticeCacheCleared', 'ล้างแคชภาพเรนเดอร์ชั่วคราวเรียบร้อยแล้ว (คืนพื้นที่หน่วยความจำ RAM 🧹)') });
  };

  const files = statusDetails?.files || [];

  const filteredFiles = files.filter(f => {
    const matchesSearch = (f.notebookName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (f.fileName || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterType === 'bnote') return f.fileName.endsWith('.bnote');
    if (filterType === 'pdf') return f.fileName.endsWith('.pdf');
    if (filterType === 'system') return f.fileName.endsWith('.json');
    return true;
  });

  const bnoteCount = files.filter(f => f.fileName.endsWith('.bnote')).length;
  const pdfCount = files.filter(f => f.fileName.endsWith('.pdf')).length;
  const jsonCount = files.filter(f => f.fileName.endsWith('.json')).length;
  const targetDir = statusDetails?.targetDir || 'H:\\My Drive\\BetterNote.AppPC';
  const isGoogleDrive = statusDetails?.isGoogleDrive ?? true;
  const lastSyncDate = statusDetails?.lastSync 
    ? new Date(statusDetails.lastSync).toLocaleString(language === 'en' ? 'en-US' : 'th-TH', { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      })
    : t('backupNoDataYet', 'ยังไม่มีข้อมูล');

  return (
    <div className="bn-modal-backdrop" onClick={onClose}>
      <div 
        className="bn-backup-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bn-backup-header">
          <div className="bn-backup-header-left">
            <div className="bn-backup-icon-badge">
              <ShieldCheck size={24} />
            </div>
            <div className="bn-backup-title-group">
              <h3>
                {t('backupStatusTitle', 'ตรวจสอบสถานะการ Backup')}
                <span className="bn-backup-agent-badge">
                  2-Agent Cloud Sync
                </span>
              </h3>
              <p className="bn-backup-subtitle">
                {t('backupStatusSubtitle', 'ตรวจสอบสมุดบันทึกที่ถูกสำรองแล้ว เวลาที่บันทึก และตำแหน่งโฟลเดอร์จัดเก็บ')}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="bn-modal-close-btn"
            title={t('backupCloseDialog', 'ปิดหน้าต่าง')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Notice Alert */}
        {actionNotice && (
          <div className={`bn-backup-notice-bar ${
            actionNotice.type === 'success' ? 'bn-backup-notice-success' :
            actionNotice.type === 'error' ? 'bn-backup-notice-error' :
            'bn-backup-notice-info'
          }`}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {actionNotice.type === 'success' ? <CheckCircle2 size={15} /> :
               actionNotice.type === 'error' ? <AlertCircle size={15} /> :
               <Loader2 size={15} className="animate-spin" />}
              {actionNotice.text}
            </span>
            <button 
              type="button"
              onClick={() => setActionNotice(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: '11px' }}
            >
              {t('close', 'ปิด')}
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="bn-backup-body">
          {/* Summary Stat Cards */}
          <div className="bn-backup-cards-grid">
            {/* Card 1: Backup Folder */}
            <div className="bn-backup-stat-card">
              <div className="bn-backup-stat-header">
                <span className="bn-backup-stat-label">
                  <FolderOpen size={15} style={{ color: '#fbbf24' }} /> {t('backupTargetFolder', 'โฟลเดอร์ปลายทาง')}
                </span>
                <span className={isGoogleDrive ? 'bn-backup-tag-cloud' : 'bn-backup-tag-local'}>
                  {isGoogleDrive ? 'Google Drive ☁️' : 'Local Disk 💾'}
                </span>
              </div>
              <div className="bn-backup-path-box" title={targetDir}>
                {targetDir}
              </div>
              <button
                type="button"
                onClick={handleOpenFolder}
                className="bn-backup-btn-open-folder"
              >
                <ExternalLink size={13} />
                <span>{t('backupOpenLocalFolder', 'เปิดโฟลเดอร์ในเครื่อง')}</span>
              </button>
            </div>

            {/* Card 2: Last Backup Time */}
            <div className="bn-backup-stat-card">
              <div className="bn-backup-stat-header">
                <span className="bn-backup-stat-label">
                  <Clock size={15} style={{ color: '#34d399' }} /> {t('backupLastSyncTime', 'เวลาสำรองล่าสุด')}
                </span>
                <span className="bn-backup-tag-synced">
                  <CheckCircle2 size={12} /> {t('backupSynced', 'ซิงค์แล้ว')}
                </span>
              </div>
              <div className="bn-backup-stat-value">
                {lastSyncDate}
              </div>
              <p className="bn-backup-stat-hint">
                {t('backupBackgroundHint', 'ระบบทำงานอัตโนมัติในพื้นหลัง ไม่หน่วงเครื่อง ไม่กิน RAM')}
              </p>
            </div>

            {/* Card 3: Files Count & Total Size */}
            <div className="bn-backup-stat-card">
              <div className="bn-backup-stat-header">
                <span className="bn-backup-stat-label">
                  <HardDrive size={15} style={{ color: '#818cf8' }} /> {t('backupTotalFiles', 'ปริมาณไฟล์ที่สำรอง')}
                </span>
                <span className="bn-backup-tag-cloud">
                  {statusDetails?.formattedTotalSize || '0 B'}
                </span>
              </div>
              <div className="bn-backup-stat-value">
                {t('backupStatFiles', '{bnoteCount} สมุด (.bnote) • {pdfCount} ไฟล์ (.pdf)', { bnoteCount, pdfCount })}
              </div>
              <p className="bn-backup-stat-hint">
                {notebooks.length > 0 
                  ? t('backupStatHint', 'พบ {count} สมุดในแอพ (รวมสำรอง {total} ไฟล์)', { count: notebooks.length, total: files.length })
                  : t('backupReadyToRestore', 'พร้อมสำหรับการกู้คืนหากย้ายเครื่อง')}
              </p>
            </div>
          </div>

          {/* Search Bar & Filter Tabs */}
          <div className="bn-backup-controls">
            <div className="bn-backup-search-wrap">
              <Search size={15} className="bn-backup-search-icon" />
              <input 
                type="text"
                placeholder={t('backupSearchPlaceholder', 'ค้นหาชื่อไฟล์ หรือสมุดบันทึก...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bn-backup-search-input"
              />
              {searchQuery && (
                <button 
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="bn-backup-search-clear"
                  title={t('backupClearSearch', 'ล้างคำค้นหา')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="bn-backup-filter-group">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`bn-backup-filter-btn ${filterType === 'all' ? 'bn-backup-filter-btn-active' : ''}`}
              >
                {t('backupFilterAll', 'ทั้งหมด ({count})', { count: files.length })}
              </button>
              <button
                type="button"
                onClick={() => setFilterType('bnote')}
                className={`bn-backup-filter-btn ${filterType === 'bnote' ? 'bn-backup-filter-btn-active' : ''}`}
              >
                {t('backupFilterBnote', 'สมุด (.bnote) ({count})', { count: bnoteCount })}
              </button>
              <button
                type="button"
                onClick={() => setFilterType('pdf')}
                className={`bn-backup-filter-btn ${filterType === 'pdf' ? 'bn-backup-filter-btn-active' : ''}`}
              >
                {t('backupFilterPdf', 'เอกสาร PDF ({count})', { count: pdfCount })}
              </button>
              <button
                type="button"
                onClick={() => setFilterType('system')}
                className={`bn-backup-filter-btn ${filterType === 'system' ? 'bn-backup-filter-btn-active' : ''}`}
              >
                {t('backupFilterSystem', 'ไฟล์ระบบ JSON ({count})', { count: jsonCount })}
              </button>
            </div>
          </div>

          {/* Table / List of Files */}
          <div className="bn-backup-table-wrap">
            {loading ? (
              <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa', gap: '10px' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: '#6366f1' }} />
                <span style={{ fontSize: '12px' }}>{t('backupScanning', 'กำลังตรวจสอบไฟล์สำรองข้อมูลจาก {targetDir}...', { targetDir })}</span>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#71717a' }}>
                <FileText size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>{t('backupNotFound', 'ไม่พบไฟล์สำรองข้อมูลที่ตรงกับคำค้นหา')}</p>
                <p style={{ fontSize: '11px', color: '#52525b', marginTop: '4px' }}>{t('backupNotFoundHint', 'กดปุ่ม "สำรองข้อมูลทันที" ด้านล่างเพื่อเริ่มการสำรองข้อมูล')}</p>
              </div>
            ) : (
              <table className="bn-backup-table">
                <thead>
                  <tr>
                    <th>{t('backupColName', 'ชื่อสมุดบันทึก / ไฟล์')}</th>
                    <th>{t('backupColFolder', 'ตำแหน่งจัดเก็บ (โฟลเดอร์)')}</th>
                    <th>{t('backupColTime', 'เวลาที่ Backup ล่าสุด')}</th>
                    <th>{t('backupColSize', 'ขนาดไฟล์')}</th>
                    <th>{t('backupColStatus', 'สถานะ')}</th>
                    <th style={{ textAlign: 'right' }}>{t('backupColAction', 'ตำแหน่งไฟล์')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((file, idx) => {
                    const isBnote = file.fileName.endsWith('.bnote');
                    const isPdf = file.fileName.endsWith('.pdf');
                    return (
                      <tr key={file.fullPath || idx}>
                        {/* File Name */}
                        <td>
                          <div className="bn-backup-file-cell">
                            {isBnote ? (
                              <BookOpen size={16} style={{ color: '#818cf8', flexShrink: 0 }} />
                            ) : isPdf ? (
                              <FileCheck size={16} style={{ color: '#f87171', flexShrink: 0 }} />
                            ) : (
                              <FileText size={16} style={{ color: '#34d399', flexShrink: 0 }} />
                            )}
                            <div className="bn-backup-file-info">
                              <div className="bn-backup-file-name">{file.notebookName}</div>
                              <div className="bn-backup-file-sub">{file.fileName}</div>
                            </div>
                          </div>
                        </td>

                        {/* Relative Destination Folder */}
                        <td>
                          <span className="bn-backup-folder-pill">
                            /{file.relativeFolder}/
                          </span>
                        </td>

                        {/* Timestamp */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
                            <Clock size={12} style={{ color: '#71717a' }} />
                            <span>{file.formattedDate}</span>
                          </div>
                        </td>

                        {/* Size */}
                        <td style={{ fontFamily: 'monospace', color: '#a1a1aa' }}>
                          {file.formattedSize}
                        </td>

                        {/* Status Badge */}
                        <td>
                          <span className="bn-backup-status-tag-synced">
                            <CheckCircle2 size={11} /> {t('backupSyncedBadge', 'สำรองแล้ว ✅')}
                          </span>
                        </td>

                        {/* Reveal in Explorer Action */}
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleRevealFile(file.fullPath, file.fileName)}
                            className="bn-backup-btn-reveal"
                            title={t('backupRevealTooltip', 'เปิดตำแหน่งไฟล์ {name} ใน Windows Explorer', { name: file.fileName })}
                          >
                            <ExternalLink size={12} />
                            <span>{t('backupRevealAction', 'เปิดตำแหน่งไฟล์')}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bn-backup-footer">
          <div className="bn-backup-footer-status">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
            <span>{t('backupAutoSyncNotice', 'ซิงค์อัตโนมัติแบบเรียลไทม์เมื่อมีการแก้ไข')}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Backup Now Button */}
            <button
              type="button"
              onClick={handleManualBackupNow}
              disabled={syncingNow}
              className="bn-backup-btn-sync-now"
            >
              <RefreshCw size={14} className={syncingNow ? 'animate-spin' : ''} />
              <span>{syncingNow ? t('backupNowInProgress', 'กำลังสำรองข้อมูล...') : t('backupNowBtn', 'สำรองข้อมูลทันที (Backup Now)')}</span>
            </button>

            {/* Restore Button */}
            {onRestoreBackup && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t('backupRestoreConfirm', 'คุณต้องการสแกนและกู้คืนสมุดบันทึกจากโฟลเดอร์นี้ใช่หรือไม่?'))) {
                    onRestoreBackup(statusDetails?.targetDir);
                  }
                }}
                className="bn-backup-btn-restore"
                title={t('backupRestoreFromFolder', 'กู้คืนจากโฟลเดอร์นี้')}
              >
                <ArrowDownToLine size={14} />
                <span>{t('backupRestoreFromFolder', 'กู้คืนจากโฟลเดอร์นี้')}</span>
              </button>
            )}

            {/* Clear Cache Button */}
            <button
              type="button"
              onClick={handleClearCache}
              className="bn-backup-btn-restore"
              title={t('backupClearCacheTooltip', 'ล้างแคชเรนเดอร์ชั่วคราวเพื่อคืนหน่วยความจำ RAM')}
            >
              <Trash2 size={13} />
              <span>{t('backupClearCacheBtn', 'ล้างแคช')}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="bn-backup-btn-close"
            >
              {t('close', 'ปิด')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
