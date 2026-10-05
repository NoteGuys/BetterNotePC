import React, { useState } from 'react';
import { 
  Sparkles, 
  Bug, 
  Download, 
  ExternalLink, 
  X, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  Calendar,
  Layers
} from 'lucide-react';
import { useLanguage } from '../../services/i18n';
import { openMicrosoftStore } from '../../services/updateService';

export function UpdateNotificationModal({ isOpen, onClose, updateData }) {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'bugs', 'features'
  const isThai = language === 'th';

  if (!isOpen || !updateData) return null;

  const currentVersion = updateData.currentVersion || '1.2.0';
  const latestVersion = updateData.latestVersion || '1.2.1';

  const localeMap = { en: 'en-US', th: 'th-TH', zh: 'zh-CN', ru: 'ru-RU' };
  const currentLocale = localeMap[language] || 'en-US';

  // Format release date according to active language locale
  let displayReleaseDate = updateData.releaseDate;
  if (updateData.releaseDateRaw) {
    try {
      displayReleaseDate = new Date(updateData.releaseDateRaw).toLocaleDateString(currentLocale, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (_) {}
  } else if (!displayReleaseDate || displayReleaseDate.includes('2569') || displayReleaseDate.includes('กันยายน')) {
    displayReleaseDate = new Date().toLocaleDateString(currentLocale, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Dynamic localization for bug fixes and features:
  const defaultFixKeys = ['updateFix1', 'updateFix2', 'updateFix3', 'updateFix4'];
  const defaultFeatKeys = ['updateFeat1', 'updateFeat2', 'updateFeat3', 'updateFeat4'];

  const bugFixes = (updateData.bugFixKeys && Array.isArray(updateData.bugFixKeys))
    ? updateData.bugFixKeys.map(k => t(k))
    : (updateData.isMock || !updateData.bugFixes || updateData.bugFixes.length === 0)
      ? defaultFixKeys.map(k => t(k))
      : updateData.bugFixes.map(fix => {
          if (typeof fix === 'string') {
            if (fix.includes('สำรองข้อมูล') || fix.includes('slowdown')) return t('updateFix1');
            if (fix.includes('ลบไฟล์ถาวร') || fix.includes('batch delete')) return t('updateFix2');
            if (fix.includes('Google Drive') || fix.includes('sync stability')) return t('updateFix3');
            if (fix.includes('ไฟล์ติดล็อก') || fix.includes('file lock')) return t('updateFix4');
          }
          return fix;
        });

  const features = (updateData.featureKeys && Array.isArray(updateData.featureKeys))
    ? updateData.featureKeys.map(k => t(k))
    : (updateData.isMock || !updateData.features || updateData.features.length === 0)
      ? defaultFeatKeys.map(k => t(k))
      : updateData.features.map(feat => {
          if (typeof feat === 'string') {
            if (feat.includes('แจ้งเตือนการอัปเดต') || feat.includes('update notifications')) return t('updateFeat1');
            if (feat.includes('สรุปการอัปเดต') || feat.includes('changelog summary')) return t('updateFeat2');
            if (feat.includes('Zero-Bloat') || feat.includes('throughput')) return t('updateFeat3');
            if (feat.includes('ระดับฐานข้อมูล') || feat.includes('batch deletion')) return t('updateFeat4');
          }
          return feat;
        });

  const handleGoToStore = async () => {
    await openMicrosoftStore(updateData.storeUrl);
    if (onClose) onClose();
  };

  return (
    <div 
      className="bn-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'bnFadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        className="bn-update-modal-dialog"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'linear-gradient(180deg, #1e1e24 0%, #131316 100%)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(59, 130, 246, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          animation: 'bnScaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div style={{
          padding: '20px 24px 16px',
          background: 'linear-gradient(90deg, rgba(37, 99, 235, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
              color: '#ffffff'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  {t('updateAvailableBadge', 'Microsoft Store')}
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} /> {displayReleaseDate}
                </span>
              </div>
              <h3 style={{
                margin: '4px 0 0 0',
                fontSize: '17px',
                fontWeight: 700,
                color: '#f8fafc',
                letterSpacing: '-0.02em'
              }}>
                {t('updateTitleNewVersion', 'พบการอัปเดตเวอร์ชันใหม่!')}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            title={t('close', 'ปิด')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Version Compare Banner */}
        <div style={{
          padding: '12px 24px',
          background: 'rgba(24, 24, 27, 0.6)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
              {t('updateCurrentVersion', 'เวอร์ชันปัจจุบัน:')} <strong style={{ color: '#cbd5e1' }}>v{currentVersion}</strong>
            </span>
            <ArrowRight size={14} style={{ color: '#60a5fa' }} />
            <span style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 700 }}>
              {t('updateNewVersion', 'เวอร์ชันใหม่:')} <span style={{ color: '#4ade80' }}>v{latestVersion}</span>
            </span>
          </div>

          <span style={{
            fontSize: '11px',
            color: '#a1a1aa',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '3px 8px',
            borderRadius: '6px'
          }}>
            {t('updateDailyCheckNotice', 'แจ้งเตือนวันละ 1 ครั้ง')}
          </span>
        </div>

        {/* Filter Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 24px 0',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px 8px 0 0',
              background: activeTab === 'all' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'all' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'all' ? '#93c5fd' : '#94a3b8',
              fontSize: '13px',
              fontWeight: activeTab === 'all' ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Layers size={14} />
            <span>{t('updateTabAll', 'All')} ({bugFixes.length + features.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bugs')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px 8px 0 0',
              background: activeTab === 'bugs' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'bugs' ? '2px solid #ef4444' : '2px solid transparent',
              color: activeTab === 'bugs' ? '#fca5a5' : '#94a3b8',
              fontSize: '13px',
              fontWeight: activeTab === 'bugs' ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Bug size={14} style={{ color: '#ef4444' }} />
            <span>{t('updateTabBugFixes', 'Bug Fixes')} ({bugFixes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('features')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px 8px 0 0',
              background: activeTab === 'features' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'features' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'features' ? '#6ee7b7' : '#94a3b8',
              fontSize: '13px',
              fontWeight: activeTab === 'features' ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sparkles size={14} style={{ color: '#10b981' }} />
            <span>{t('updateTabFeatures', 'What\'s New')} ({features.length})</span>
          </button>
        </div>

        {/* Scrollable Changelog List */}
        <div style={{
          padding: '16px 24px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Bug Fixes Section */}
          {(activeTab === 'all' || activeTab === 'bugs') && bugFixes.length > 0 && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '12px',
              padding: '14px 16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#f87171',
                fontSize: '13px',
                fontWeight: 700,
                marginBottom: '10px'
              }}>
                <Bug size={15} />
                <span>{t('updateBugFixesTitle', 'Bug Fixes')}</span>
              </div>
              <ul style={{
                margin: 0,
                paddingLeft: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '13px',
                color: '#e2e8f0',
                lineHeight: '1.5'
              }}>
                {bugFixes.map((fix, idx) => (
                  <li key={idx} style={{ paddingLeft: '4px' }}>
                    {fix}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* New Features & Improvements Section */}
          {(activeTab === 'all' || activeTab === 'features') && features.length > 0 && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.06)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '12px',
              padding: '14px 16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#34d399',
                fontSize: '13px',
                fontWeight: 700,
                marginBottom: '10px'
              }}>
                <Sparkles size={15} />
                <span>{t('updateFeaturesTitle', 'What\'s New & Improvements')}</span>
              </div>
              <ul style={{
                margin: 0,
                paddingLeft: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '13px',
                color: '#e2e8f0',
                lineHeight: '1.5'
              }}>
                {features.map((feat, idx) => (
                  <li key={idx} style={{ paddingLeft: '4px' }}>
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Safety & Offline Guarantee Notice */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: '12px',
            color: '#94a3b8'
          }}>
            <ShieldCheck size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
            <span>
              {t('updateSafeNotice', 'Updating via Microsoft Store preserves 100% of your notes and drawings.')}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          background: 'rgba(15, 15, 18, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {t('updateRemindLater', 'Remind Me Later')}
          </button>

          <button
            type="button"
            onClick={handleGoToStore}
            style={{
              padding: '10px 22px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
              transition: 'all 0.15s ease'
            }}
          >
            <Download size={15} />
            <span>{t('updateOnMicrosoftStore', 'Update on Microsoft Store')}</span>
            <ExternalLink size={13} style={{ opacity: 0.8 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
