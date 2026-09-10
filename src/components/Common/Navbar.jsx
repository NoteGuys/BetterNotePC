import React from 'react';
import { 
  Cloud, 
  HardDrive, 
  FolderSync, 
  Upload
} from 'lucide-react';

export const Navbar = ({ 
  onExportBackup, 
  onImportBackup, 
  onTriggerAutoSync,
  isSyncing
}) => {
  const fileInputRef = React.useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackup(file);
    }
  };

  return (
    <header className="bn-navbar">
      {/* Brand */}
      <div className="bn-navbar-left">
        <div className="bn-logo-wrapper">
          <div className="bn-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              <path d="M2 2l7.586 7.586"></path>
              <circle cx="11" cy="11" r="2"></circle>
            </svg>
          </div>
          <div className="bn-logo-text-group">
            <span className="bn-brand-title">BetterNote</span>
            <span className="bn-brand-badge">PRO</span>
          </div>
        </div>
      </div>

      {/* Cloud Status Pill (Clean & Minimalist) */}
      <div className="bn-navbar-center">
        <div 
          className="bn-cloud-pill"
          title="Google Drive: H:\My Drive\BetterNote.AppPC (สำรองข้อมูลอัตโนมัติทุก 1 ชั่วโมง และก่อนปิดโปรแกรม)"
        >
          <span className="bn-pulse-dot"></span>
          <Cloud size={13} className="text-emerald-400" />
          <span className="text-xs font-medium text-emerald-300">Drive Auto-Sync</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="bn-navbar-right">
        {/* Instant Sync */}
        <button 
          className="bn-btn-nav bn-btn-nav-sync flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
          onClick={onTriggerAutoSync}
          disabled={isSyncing}
          title="สำรองข้อมูลลง Google Drive (H:\My Drive\BetterNote.AppPC) ทันที (PDF และ .bnote)"
        >
          <FolderSync size={14} className={isSyncing ? 'animate-spin text-emerald-400' : 'text-emerald-400'} />
          <span>{isSyncing ? 'กำลังซิงค์...' : 'ซิงค์ Drive'}</span>
        </button>

        {/* Local Backup */}
        <button 
          className="bn-btn-nav-icon"
          onClick={onExportBackup}
          title="สำรองข้อมูลทั้งหมดลงเครื่อง (.json)"
        >
          <HardDrive size={16} />
        </button>

        {/* Restore Backup */}
        <button 
          className="bn-btn-nav-icon"
          onClick={() => fileInputRef.current?.click()}
          title="กู้คืนข้อมูลจากไฟล์สำรอง (.json)"
        >
          <Upload size={16} />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          accept=".json" 
          style={{ display: 'none' }} 
          onChange={handleFileChange} 
        />
      </div>
    </header>
  );
};
