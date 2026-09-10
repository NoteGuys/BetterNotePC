import React, { useState, useEffect } from 'react';
import { 
  X, 
  Cloud, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink, 
  FolderSync, 
  ShieldCheck,
  FolderOpen
} from 'lucide-react';
import { googleDrive } from '../../services/googleDriveService';
import { getSetting, saveSetting } from '../../services/db';

export const GoogleDriveModal = ({ isOpen, onClose, onSyncComplete }) => {
  const [clientId, setClientId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!isOpen) return;

    const loadSettings = async () => {
      const savedClientId = await getSetting('gdrive_client_id') || '';
      const savedConnected = await getSetting('gdrive_connected') || false;
      const savedEmail = await getSetting('gdrive_user_email') || '';
      const savedLastSync = await getSetting('gdrive_last_sync');

      setClientId(savedClientId);
      setIsConnected(savedConnected);
      setUserEmail(savedEmail);
      if (savedLastSync) setLastSync(new Date(savedLastSync));

      if (savedClientId) {
        googleDrive.init(savedClientId);
      }
    };

    loadSettings();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    if (!clientId.trim()) {
      setStatusMsg({ type: 'error', text: 'กรุณากรอก Google OAuth Client ID ก่อนเชื่อมต่อ' });
      return;
    }

    setIsLoading(true);
    setStatusMsg({ type: 'info', text: 'กำลังเชื่อมต่อกับ Google Accounts...' });

    try {
      await saveSetting('gdrive_client_id', clientId.trim());
      await googleDrive.init(clientId.trim());
      const res = await googleDrive.requestToken();
      setIsConnected(true);
      setUserEmail(res.email || 'เชื่อมต่อสำเร็จ');
      setStatusMsg({ type: 'success', text: `เชื่อมต่อ Google Drive สำเร็จ! (${res.email || ''})` });
    } catch (err) {
      console.error(err);
      setStatusMsg({ 
        type: 'error', 
        text: err.message || 'ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบ Client ID และ Authorized JavaScript Origins' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackupNow = async () => {
    setIsLoading(true);
    setStatusMsg({ type: 'info', text: 'กำลังอัปโหลดข้อมูลสมุดโน้ตไปยัง Google Drive...' });

    try {
      const res = await googleDrive.backupAllToDrive();
      const now = new Date();
      setLastSync(now);
      setStatusMsg({ type: 'success', text: `สำรองข้อมูลสำเร็จเรียบร้อย! ไฟล์ชื่อ: ${res.name}` });
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: `เกิดข้อผิดพลาดในการสำรองข้อมูล: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    googleDrive.accessToken = null;
    await saveSetting('gdrive_connected', false);
    await saveSetting('gdrive_token', null);
    setIsConnected(false);
    setUserEmail('');
    setStatusMsg({ type: 'info', text: 'ยกเลิกการเชื่อมต่อ Google Drive เรียบร้อย' });
  };

  return (
    <div className="bn-modal-backdrop" onClick={onClose}>
      <div className="bn-modal-content bn-modal-cloud" onClick={(e) => e.stopPropagation()}>
        <div className="bn-modal-header">
          <div className="flex items-center gap-3">
            <div className="bn-icon-badge-cloud">
              <Cloud size={24} className="text-blue-500" />
            </div>
            <div>
              <h2 className="bn-modal-title">เชื่อมต่อ Google Drive & Cloud Sync</h2>
              <p className="bn-modal-subtitle">สำรองข้อมูลสมุดโน้ตและไฟล์ PDF บนระบบคลาวด์ ปลอดภัยและเข้าถึงได้ทุกที่</p>
            </div>
          </div>
          <button className="bn-modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="bn-modal-body">
          {/* Connection Status Card */}
          <div className={`bn-cloud-card ${isConnected ? 'bn-cloud-card-active' : ''}`}>
            <div className="bn-cloud-card-header">
              <div className="flex items-center gap-2">
                <span className={`bn-status-dot ${isConnected ? 'bg-emerald-500' : 'bg-zinc-400'}`}></span>
                <span className="font-semibold text-sm">
                  {isConnected ? `เชื่อมต่อแล้ว (${userEmail})` : 'ยังไม่ได้เชื่อมต่อ Google Drive'}
                </span>
              </div>
              {lastSync && (
                <span className="text-xs text-zinc-400">
                  ซิงค์ล่าสุด: {lastSync.toLocaleTimeString('th-TH')} ({lastSync.toLocaleDateString('th-TH')})
                </span>
              )}
            </div>

            {isConnected ? (
              <div className="bn-cloud-connected-actions">
                <button 
                  className="bn-btn-primary flex items-center gap-2"
                  onClick={handleBackupNow}
                  disabled={isLoading}
                >
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                  <span>{isLoading ? 'กำลังซิงค์...' : 'สำรองข้อมูลไปยัง Drive ทันที'}</span>
                </button>
                <button 
                  className="bn-btn-secondary"
                  onClick={handleDisconnect}
                  disabled={isLoading}
                >
                  ยกเลิกการเชื่อมต่อ
                </button>
              </div>
            ) : (
              <div className="bn-cloud-connect-form">
                <label className="bn-label">
                  Google OAuth 2.0 Client ID:
                  <span className="text-xs text-zinc-400 block font-normal mt-0.5">
                    นำ Client ID จาก Google Cloud Console (เปิด Google Drive API และเพิ่ม Origins: http://localhost:3000)
                  </span>
                </label>
                <div className="flex gap-2 mt-2">
                  <input 
                    type="text" 
                    className="bn-input flex-1"
                    placeholder="xxxx-xxxxxxxxxx.apps.googleusercontent.com"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  />
                  <button 
                    className="bn-btn-primary"
                    onClick={handleConnect}
                    disabled={isLoading}
                  >
                    {isLoading ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Status Alert */}
          {statusMsg.text && (
            <div className={`bn-alert bn-alert-${statusMsg.type}`}>
              {statusMsg.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Alternative: Local Google Drive Folder Sync */}
          <div className="bn-card-hint">
            <div className="flex gap-3">
              <FolderOpen size={22} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-zinc-200">ทางเลือกที่สะดวกรวดเร็ว: เซฟตรงลง Google Drive for Desktop</h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  หากท่านติดตั้งโปรแกรม <strong>Google Drive for Desktop</strong> หรือ <strong>OneDrive</strong> บนคอมพิวเตอร์ 
                  ท่านสามารถใช้ปุ่ม <strong>"สำรองไฟล์"</strong> ในแถบด้านบน เพื่อบันทึกไฟล์สมุดโน้ตลงในโฟลเดอร์ Google Drive บนเครื่องคอมพิวเตอร์ของคุณได้ทันทีโดยไม่ต้องตั้งค่า Client ID!
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bn-modal-footer">
          <button className="bn-btn-secondary" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
