import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  FileText, 
  Check, 
  Maximize2, 
  Sparkles
} from 'lucide-react';
import { PAPER_SIZES, PAPER_TEMPLATES, getPaperSize } from '../../data/templates';
import { PaperPreviewThumbnail } from '../Common/PaperPreviewThumbnail';
import { useLanguage } from '../../services/i18n';

export const AddPageModal = ({ 
  isOpen, 
  onClose, 
  onAddPage, 
  currentPageIndex = 0, 
  totalPages = 1 
}) => {
  const { t, language } = useLanguage();
  const [selectedSize, setSelectedSize] = useState('A4');
  const [orientation, setOrientation] = useState('portrait'); // 'portrait' | 'landscape'
  const [selectedTemplate, setSelectedTemplate] = useState('dotted');
  const [insertPosition, setInsertPosition] = useState('after'); // 'after' | 'end'

  if (!isOpen) return null;

  const handleConfirm = () => {
    const sizeDim = getPaperSize(selectedSize, orientation);
    onAddPage({
      templateId: selectedTemplate,
      sizeId: selectedSize,
      orientation,
      pageWidth: sizeDim.width,
      pageHeight: sizeDim.height,
      insertPosition
    });
    onClose();
  };

  const selectedTemplateObj = PAPER_TEMPLATES.find(tmpl => tmpl.id === selectedTemplate) || PAPER_TEMPLATES[0];

  return (
    <div className="bn-modal-backdrop" onClick={onClose}>
      <div 
        className="bn-modal-content"
        style={{ 
          maxWidth: '560px', 
          width: '100%', 
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#18181b',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bn-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '10px', 
              background: 'rgba(59, 130, 246, 0.15)', 
              color: '#60a5fa', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Plus size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', margin: 0, lineHeight: 1.2 }}>
                {t('addNewPageTitle', 'เพิ่มหน้ากระดาษใหม่')}
              </h3>
              <p style={{ fontSize: '11px', color: '#a1a1aa', margin: '3px 0 0 0' }}>
                {t('addNewPageSub', 'เลือกขนาด A2/A3/A4 และรูปแบบกระดาษที่ต้องการ')}
              </p>
            </div>
          </div>
          <button 
            type="button"
            className="bn-modal-close-btn"
            onClick={onClose}
            title={t('close', 'ปิด')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="bn-modal-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          {/* Section 1: ขนาดหน้ากระดาษ (A2, A3, A4) */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7', display: 'block', marginBottom: '8px' }}>
              {t('paperSizeStep', '1. เลือกขนาดหน้ากระดาษ')}
            </label>
            <div className="bn-new-paper-grid">
              {PAPER_SIZES.map(s => {
                const isSelected = selectedSize === s.id;
                return (
                  <div
                    key={s.id}
                    className={`bn-new-paper-card ${isSelected ? 'bn-new-paper-card-active' : ''}`}
                    onClick={() => setSelectedSize(s.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: isSelected ? '#ffffff' : '#f4f4f5' }}>{s.name}</span>
                      {s.badge && (
                        <span style={{ 
                          fontSize: '9px', 
                          fontWeight: 700, 
                          background: isSelected ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)', 
                          color: isSelected ? '#ffffff' : '#a1a1aa', 
                          padding: '2px 5px', 
                          borderRadius: '4px' 
                        }}>
                          {t('template_badge_' + (s.id === 'A4' ? 'popular' : s.id === 'A3' ? 'extra_wide' : 'giant'), s.badge)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '10px', color: '#a1a1aa', marginTop: '3px' }}>
                      {t('paper_size_' + s.id, s.fullName)}
                    </div>
                    <div style={{ fontSize: '9px', color: '#71717a', marginTop: '2px' }}>
                      {s.width} × {s.height} px
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: ทิศทางหน้ากระดาษ (แนวตั้ง / แนวนอน) */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7', display: 'block', marginBottom: '8px' }}>
              {t('orientationStep', '2. ทิศทางกระดาษ')}
            </label>
            <div className="bn-new-orient-row">
              <button
                type="button"
                className={`bn-new-orient-btn ${orientation === 'portrait' ? 'bn-new-orient-btn-active' : ''}`}
                onClick={() => setOrientation('portrait')}
              >
                <div style={{ width: '12px', height: '16px', border: '1.5px solid currentColor', borderRadius: '2px' }} />
                <span>{t('portrait', 'แนวตั้ง (Portrait)')}</span>
              </button>
              <button
                type="button"
                className={`bn-new-orient-btn ${orientation === 'landscape' ? 'bn-new-orient-btn-active' : ''}`}
                onClick={() => setOrientation('landscape')}
              >
                <div style={{ width: '16px', height: '12px', border: '1.5px solid currentColor', borderRadius: '2px' }} />
                <span>{t('landscape', 'แนวนอน (Landscape)')}</span>
              </button>
            </div>
          </div>

          {/* Section 3: ลักษณะหน้ากระดาษ พร้อมภาพตัวอย่าง (Paper Template) */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7', display: 'block', marginBottom: '8px' }}>
              {t('patternStep', '3. ลักษณะหน้ากระดาษ (ลายเส้น / พื้นผิว)')}
            </label>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '8px', 
              maxHeight: '210px', 
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              {PAPER_TEMPLATES.map(tmpl => {
                const isSelected = selectedTemplate === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    className={`bn-template-card ${isSelected ? 'bn-template-card-selected' : ''}`}
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    style={{ 
                      padding: '8px 10px', 
                      gap: '10px', 
                      alignItems: 'center',
                      borderRadius: '10px'
                    }}
                  >
                    {/* Visual paper preview miniature */}
                    <PaperPreviewThumbnail templateId={tmpl.id} width={30} height={40} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: 600, 
                          color: isSelected ? '#ffffff' : '#f4f4f5', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap' 
                        }}>
                          {t('template_' + tmpl.id.replace(/-/g, '_'), tmpl.name)}
                        </span>
                        {tmpl.badge && (
                          <span style={{ 
                            fontSize: '8px', 
                            background: 'rgba(16, 185, 129, 0.2)', 
                            color: '#34d399', 
                            padding: '1px 5px', 
                            borderRadius: '3px', 
                            fontWeight: 700,
                            flexShrink: 0
                          }}>
                            {t('template_badge_' + (tmpl.id === 'narrow-ruled' ? 'fine' : tmpl.id === 'wide-ruled' ? 'comfort' : tmpl.id === 'A3' ? 'extra_wide' : tmpl.id === 'A2' ? 'giant' : 'popular'), tmpl.badge)}
                          </span>
                        )}
                      </div>
                      <p style={{ 
                        fontSize: '10px', 
                        color: '#a1a1aa', 
                        margin: '2px 0 0 0', 
                        lineHeight: 1.25, 
                        display: '-webkit-box', 
                        WebkitLineClamp: 2, 
                        WebkitBoxOrient: 'vertical', 
                        overflow: 'hidden' 
                      }}>
                        {t('template_desc_' + tmpl.id.replace(/-/g, '_'), tmpl.description)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: ตำแหน่งที่ต้องการเพิ่ม */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7', display: 'block', marginBottom: '8px' }}>
              {t('positionStep', '4. ตำแหน่งหน้า')}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`bn-new-orient-btn ${insertPosition === 'after' ? 'bn-new-orient-btn-active' : ''}`}
                onClick={() => setInsertPosition('after')}
              >
                <span>{t('insertAfterCurrent', 'ต่อจากหน้านี้ (หน้า {page})', { page: currentPageIndex + 1 })}</span>
              </button>
              <button
                type="button"
                className={`bn-new-orient-btn ${insertPosition === 'end' ? 'bn-new-orient-btn-active' : ''}`}
                onClick={() => setInsertPosition('end')}
              >
                <span>{t('insertAtEnd', 'ต่อท้ายสุด (หน้า {page})', { page: totalPages + 1 })}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bn-modal-footer" style={{ 
          padding: '12px 20px', 
          background: 'rgba(0, 0, 0, 0.25)', 
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
            {selectedSize} • {orientation === 'portrait' ? t('portrait', 'แนวตั้ง') : t('landscape', 'แนวนอน')} • {
              t('template_' + selectedTemplateObj.id.replace(/-/g, '_'), selectedTemplateObj.name)
            }
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="bn-btn-secondary"
              style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px' }}
              onClick={onClose}
            >
              {t('cancel', 'ยกเลิก')}
            </button>
            <button
              type="button"
              className="bn-btn-primary"
              style={{ padding: '6px 16px', fontSize: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={handleConfirm}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>{t('addPageBtn', 'เพิ่มหน้ากระดาษ')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
