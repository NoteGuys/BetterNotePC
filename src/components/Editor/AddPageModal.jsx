import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  FileText, 
  Check, 
  Maximize2, 
  Columns, 
  Layout, 
  Sparkles
} from 'lucide-react';
import { PAPER_SIZES, PAPER_TEMPLATES, getPaperSize } from '../../data/templates';

export const AddPageModal = ({ 
  isOpen, 
  onClose, 
  onAddPage, 
  currentPageIndex = 0, 
  totalPages = 1 
}) => {
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

  return (
    <div className="bn-modal-backdrop" onClick={onClose}>
      <div 
        className="bn-modal-card max-w-lg w-full bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bn-modal-header px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Plus size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">เพิ่มหน้ากระดาษใหม่</h3>
              <p className="text-[11px] text-zinc-400">เลือกขนาด A2/A3/A4 และรูปแบบกระดาษที่ต้องการ</p>
            </div>
          </div>
          <button 
            className="bn-btn-icon text-zinc-400 hover:text-white"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Section 1: ขนาดหน้ากระดาษ (A2, A3, A4) */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-2">
              1. เลือกขนาดหน้ากระดาษ
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {PAPER_SIZES.map(s => {
                const isSelected = selectedSize === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected 
                        ? 'bg-blue-600/15 border-blue-500 ring-1 ring-blue-500 text-white' 
                        : 'bg-zinc-800/60 border-zinc-700 hover:bg-zinc-800 text-zinc-300'
                    }`}
                    onClick={() => setSelectedSize(s.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base font-bold text-white">{s.name}</span>
                      {s.badge && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                          isSelected ? 'bg-blue-500 text-white' : 'bg-zinc-700 text-zinc-300'
                        }`}>
                          {s.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-400 leading-tight">
                      {s.fullName}
                    </div>
                    <div className="text-[9px] text-zinc-500 mt-1">
                      {s.width} × {s.height} px
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: ทิศทางหน้ากระดาษ (แนวตั้ง / แนวนอน) */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-2">
              2. ทิศทางกระดาษ
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-medium transition-all ${
                  orientation === 'portrait'
                    ? 'bg-blue-600/20 border-blue-500 text-white font-semibold'
                    : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                }`}
                onClick={() => setOrientation('portrait')}
              >
                <div className="w-3.5 h-5 border border-current rounded-sm" />
                <span>แนวตั้ง (Portrait)</span>
              </button>
              <button
                type="button"
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-medium transition-all ${
                  orientation === 'landscape'
                    ? 'bg-blue-600/20 border-blue-500 text-white font-semibold'
                    : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                }`}
                onClick={() => setOrientation('landscape')}
              >
                <div className="w-5 h-3.5 border border-current rounded-sm" />
                <span>แนวนอน (Landscape)</span>
              </button>
            </div>
          </div>

          {/* Section 3: ลักษณะหน้ากระดาษ (ลายจุด, เส้นแคบ, เส้นกว้าง, etc.) */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-2">
              3. ลักษณะหน้ากระดาษ (ลายเส้น / พื้นผิว)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PAPER_TEMPLATES.map(tmpl => {
                const isSelected = selectedTemplate === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500 ring-1 ring-blue-500'
                        : 'bg-zinc-800/60 border-zinc-700/80 hover:bg-zinc-800'
                    }`}
                    onClick={() => setSelectedTemplate(tmpl.id)}
                  >
                    {/* Visual paper preview miniature */}
                    <div 
                      className="w-8 h-10 rounded border border-zinc-600 flex-shrink-0 relative overflow-hidden flex flex-col justify-center px-1"
                      style={{ backgroundColor: tmpl.bg || '#ffffff' }}
                    >
                      {tmpl.type === 'ruled' && (
                        <div className="space-y-1">
                          <div className="h-px bg-zinc-300 w-full" />
                          <div className="h-px bg-zinc-300 w-full" />
                          <div className="h-px bg-zinc-300 w-full" />
                        </div>
                      )}
                      {tmpl.type === 'grid' && (
                        <div className="w-full h-full grid grid-cols-3 grid-rows-4 gap-0.5 opacity-60">
                          {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="border border-zinc-400" />
                          ))}
                        </div>
                      )}
                      {tmpl.type === 'dotted' && (
                        <div className="w-full h-full flex flex-wrap gap-1 items-center justify-center p-0.5">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="w-0.5 h-0.5 rounded-full bg-zinc-400" />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                          {tmpl.name}
                        </span>
                        {tmpl.badge && (
                          <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-bold">
                            {tmpl.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5 leading-tight">
                        {tmpl.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: ตำแหน่งที่ต้องการเพิ่ม */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
              4. ตำแหน่งหน้า
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-medium ${
                  insertPosition === 'after'
                    ? 'bg-blue-600/20 border-blue-500 text-white font-semibold'
                    : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                }`}
                onClick={() => setInsertPosition('after')}
              >
                ต่อจากหน้านี้ (หน้า {currentPageIndex + 1})
              </button>
              <button
                type="button"
                className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-medium ${
                  insertPosition === 'end'
                    ? 'bg-blue-600/20 border-blue-500 text-white font-semibold'
                    : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                }`}
                onClick={() => setInsertPosition('end')}
              >
                ต่อท้ายสุด (หน้า {totalPages + 1})
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-zinc-950/60 border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            {selectedSize} • {orientation === 'portrait' ? 'แนวตั้ง' : 'แนวนอน'} • {
              PAPER_TEMPLATES.find(t => t.id === selectedTemplate)?.name
            }
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              onClick={onClose}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              className="bn-btn-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              onClick={handleConfirm}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>เพิ่มหน้ากระดาษ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
