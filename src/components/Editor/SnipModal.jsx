import React, { useState, useRef, useEffect } from 'react';
import { 
  Scissors, 
  Crop, 
  Check, 
  X, 
  RotateCcw, 
  ClipboardPaste, 
  Maximize2 
} from 'lucide-react';
import { useLanguage } from '../../services/i18n';

export const SnipModal = ({ snipImage, onConfirm, onClose }) => {
  const { t, language } = useLanguage();
  const [currentImage, setCurrentImage] = useState(snipImage);
  const [isCropMode, setIsCropMode] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ 
    width: snipImage.width || 400, 
    height: snipImage.height || 300 
  });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [cropBox, setCropBox] = useState(null); // in display px: { x, y, width, height }

  // Track original drag capture bounds on canvas
  const origBoxRef = useRef({
    width: snipImage.boxWidth || snipImage.width || 400,
    height: snipImage.boxHeight || snipImage.height || 300,
    x: snipImage.x !== undefined ? snipImage.x : 100,
    y: snipImage.y !== undefined ? snipImage.y : 100
  });

  const imageRef = useRef(null);
  const stageRef = useRef(null);

  // Keep track of natural dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setNaturalSize({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height
      });
    };
    img.src = currentImage.dataUrl;
  }, [currentImage.dataUrl]);

  // When image loads on screen, calculate accurate display bounds and initialize crop box
  const handleImageLoaded = () => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    setDisplaySize({ width: w, height: h });
    
    // Default crop box: centered with 6% margin
    const insetX = Math.max(10, Math.round(w * 0.06));
    const insetY = Math.max(10, Math.round(h * 0.06));
    setCropBox({
      x: insetX,
      y: insetY,
      width: Math.max(40, w - insetX * 2),
      height: Math.max(40, h - insetY * 2)
    });
  };

  // Drag inside crop box to move it, or drag on stage to draw new box
  const handleBoxDragStart = (e, mode = 'move') => {
    if (!isCropMode) return;
    e.preventDefault();
    e.stopPropagation();
    if (!stageRef.current) return;

    const stageRect = stageRef.current.getBoundingClientRect();
    const curX = Math.max(0, Math.min(displaySize.width, e.clientX - stageRect.left));
    const curY = Math.max(0, Math.min(displaySize.height, e.clientY - stageRect.top));

    const startX = curX;
    const startY = curY;
    const initialBox = cropBox ? { ...cropBox } : { x: curX, y: curY, width: 0, height: 0 };

    if (mode === 'new') {
      setCropBox({ x: curX, y: curY, width: 0, height: 0 });
    }

    const onPointerMove = (moveEv) => {
      const liveX = Math.max(0, Math.min(displaySize.width, moveEv.clientX - stageRect.left));
      const liveY = Math.max(0, Math.min(displaySize.height, moveEv.clientY - stageRect.top));

      if (mode === 'new') {
        const x = Math.min(startX, liveX);
        const y = Math.min(startY, liveY);
        const width = Math.abs(liveX - startX);
        const height = Math.abs(liveY - startY);
        setCropBox({ x, y, width, height });
      } else if (mode === 'move' && initialBox) {
        const dx = liveX - startX;
        const dy = liveY - startY;
        const newX = Math.max(0, Math.min(displaySize.width - initialBox.width, initialBox.x + dx));
        const newY = Math.max(0, Math.min(displaySize.height - initialBox.height, initialBox.y + dy));
        setCropBox({ ...initialBox, x: newX, y: newY });
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      setCropBox(prev => {
        if (!prev || prev.width < 15 || prev.height < 15) {
          return {
            x: Math.round(displaySize.width * 0.05),
            y: Math.round(displaySize.height * 0.05),
            width: Math.round(displaySize.width * 0.9),
            height: Math.round(displaySize.height * 0.9)
          };
        }
        return prev;
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Drag on corner / edge handles to resize the crop box
  const handleHandleDragStart = (e, handleType) => {
    if (!isCropMode || !cropBox) return;
    e.preventDefault();
    e.stopPropagation();

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const init = { ...cropBox };

    const onHandleMove = (moveEv) => {
      const dx = moveEv.clientX - startClientX;
      const dy = moveEv.clientY - startClientY;

      let newX = init.x;
      let newY = init.y;
      let newW = init.width;
      let newH = init.height;

      if (handleType === 'se') {
        newW = Math.max(25, Math.min(displaySize.width - init.x, init.width + dx));
        newH = Math.max(25, Math.min(displaySize.height - init.y, init.height + dy));
      } else if (handleType === 'sw') {
        newX = Math.max(0, Math.min(init.x + init.width - 25, init.x + dx));
        newW = init.width + (init.x - newX);
        newH = Math.max(25, Math.min(displaySize.height - init.y, init.height + dy));
      } else if (handleType === 'ne') {
        newW = Math.max(25, Math.min(displaySize.width - init.x, init.width + dx));
        newY = Math.max(0, Math.min(init.y + init.height - 25, init.y + dy));
        newH = init.height + (init.y - newY);
      } else if (handleType === 'nw') {
        newX = Math.max(0, Math.min(init.x + init.width - 25, init.x + dx));
        newW = init.width + (init.x - newX);
        newY = Math.max(0, Math.min(init.y + init.height - 25, init.y + dy));
        newH = init.height + (init.y - newY);
      } else if (handleType === 'n') {
        newY = Math.max(0, Math.min(init.y + init.height - 25, init.y + dy));
        newH = init.height + (init.y - newY);
      } else if (handleType === 's') {
        newH = Math.max(25, Math.min(displaySize.height - init.y, init.height + dy));
      } else if (handleType === 'w') {
        newX = Math.max(0, Math.min(init.x + init.width - 25, init.x + dx));
        newW = init.width + (init.x - newX);
      } else if (handleType === 'e') {
        newW = Math.max(25, Math.min(displaySize.width - init.x, init.width + dx));
      }

      setCropBox({
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH)
      });
    };

    const onHandleUp = () => {
      window.removeEventListener('pointermove', onHandleMove);
      window.removeEventListener('pointerup', onHandleUp);
      window.removeEventListener('pointercancel', onHandleUp);
    };

    window.addEventListener('pointermove', onHandleMove);
    window.addEventListener('pointerup', onHandleUp);
    window.addEventListener('pointercancel', onHandleUp);
  };

  // Presets for quick aspect ratio cropping
  const setPreset = (ratio) => {
    if (!displaySize.width || !displaySize.height) return;
    if (ratio === 'full') {
      setCropBox({ x: 0, y: 0, width: displaySize.width, height: displaySize.height });
      return;
    }
    let targetW = displaySize.width * 0.85;
    let targetH = targetW / ratio;
    if (targetH > displaySize.height * 0.85) {
      targetH = displaySize.height * 0.85;
      targetW = targetH * ratio;
    }
    const x = Math.round((displaySize.width - targetW) / 2);
    const y = Math.round((displaySize.height - targetH) / 2);
    setCropBox({ x, y, width: Math.round(targetW), height: Math.round(targetH) });
  };

  // Apply Sub-Crop to the image
  const handleApplySubCrop = () => {
    if (!cropBox || cropBox.width < 10 || cropBox.height < 10 || !displaySize.width) return;

    const scaleX = naturalSize.width / displaySize.width;
    const scaleY = naturalSize.height / displaySize.height;

    const naturalCropX = Math.max(0, Math.round(cropBox.x * scaleX));
    const naturalCropY = Math.max(0, Math.round(cropBox.y * scaleY));
    const naturalCropW = Math.min(naturalSize.width - naturalCropX, Math.round(cropBox.width * scaleX));
    const naturalCropH = Math.min(naturalSize.height - naturalCropY, Math.round(cropBox.height * scaleY));

    const canvas = document.createElement('canvas');
    canvas.width = naturalCropW;
    canvas.height = naturalCropH;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(
        img,
        naturalCropX, naturalCropY, naturalCropW, naturalCropH,
        0, 0, naturalCropW, naturalCropH
      );
      const croppedDataUrl = canvas.toDataURL('image/png');
      
      // Update original drag bounds to match the sub-cropped area
      const fractionW = cropBox.width / displaySize.width;
      const fractionH = cropBox.height / displaySize.height;
      const fractionX = cropBox.x / displaySize.width;
      const fractionY = cropBox.y / displaySize.height;

      origBoxRef.current = {
        width: Math.round(origBoxRef.current.width * fractionW),
        height: Math.round(origBoxRef.current.height * fractionH),
        x: Math.round(origBoxRef.current.x + origBoxRef.current.width * fractionX),
        y: Math.round(origBoxRef.current.y + origBoxRef.current.height * fractionY)
      };

      setCurrentImage({
        dataUrl: croppedDataUrl,
        width: naturalCropW,
        height: naturalCropH
      });
      setIsCropMode(false);
    };
    img.src = currentImage.dataUrl;
  };

  // Reset back to original snippet
  const handleResetOriginal = () => {
    origBoxRef.current = {
      width: snipImage.boxWidth || snipImage.width || 400,
      height: snipImage.boxHeight || snipImage.height || 300,
      x: snipImage.x !== undefined ? snipImage.x : 100,
      y: snipImage.y !== undefined ? snipImage.y : 100
    };
    setCurrentImage(snipImage);
    setIsCropMode(false);
  };

  // Confirm and place image onto current page with exact original dimensions
  const handleConfirmPlacement = () => {
    // If user is currently in Crop Mode with a cropBox selected, apply crop directly!
    if (isCropMode && cropBox && displaySize.width > 0) {
      const scaleX = naturalSize.width / displaySize.width;
      const scaleY = naturalSize.height / displaySize.height;

      const naturalCropX = Math.max(0, Math.round(cropBox.x * scaleX));
      const naturalCropY = Math.max(0, Math.round(cropBox.y * scaleY));
      const naturalCropW = Math.min(naturalSize.width - naturalCropX, Math.round(cropBox.width * scaleX));
      const naturalCropH = Math.min(naturalSize.height - naturalCropY, Math.round(cropBox.height * scaleY));

      const canvas = document.createElement('canvas');
      canvas.width = naturalCropW;
      canvas.height = naturalCropH;
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(
          img,
          naturalCropX, naturalCropY, naturalCropW, naturalCropH,
          0, 0, naturalCropW, naturalCropH
        );
        const croppedDataUrl = canvas.toDataURL('image/png');
        
        const fractionW = cropBox.width / displaySize.width;
        const fractionH = cropBox.height / displaySize.height;
        const fractionX = cropBox.x / displaySize.width;
        const fractionY = cropBox.y / displaySize.height;

        const finalW = Math.round(origBoxRef.current.width * fractionW);
        const finalH = Math.round(origBoxRef.current.height * fractionH);
        const finalX = Math.round(origBoxRef.current.x + origBoxRef.current.width * fractionX);
        const finalY = Math.round(origBoxRef.current.y + origBoxRef.current.height * fractionY);

        onConfirm(croppedDataUrl, finalW, finalH, finalX, finalY);
      };
      img.src = currentImage.dataUrl;
      return;
    }

    // Standard placement: Exact same size and position as dragged on canvas
    onConfirm(
      currentImage.dataUrl, 
      origBoxRef.current.width, 
      origBoxRef.current.height,
      origBoxRef.current.x,
      origBoxRef.current.y
    );
  };

  return (
    <div className="bn-modal-backdrop" onClick={onClose} style={{ zIndex: 1000 }}>
      <div 
        className="bn-snip-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bn-modal-header" style={{ padding: '4px 0 10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <Scissors size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', margin: 0 }}>
                {t('snipModalTitle', 'ภาพที่แคปเจอร์ (Snipping Tool)')}
              </h3>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0 0' }}>
                {origBoxRef.current.width} × {origBoxRef.current.height} px • {t('snipModalHint', 'ตรวจสอบ ปรับขนาด หรือครอบตัดเพิ่มเติมก่อนวาง')}
              </p>
            </div>
          </div>
          <button 
            style={{
              padding: '6px',
              borderRadius: 8,
              color: '#94a3b8',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={onClose}
            title={t('cancel', 'ยกเลิกและปิด')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar & Aspect Ratio Presets (Visible when in Crop Mode) */}
        {isCropMode && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'rgba(30, 41, 59, 0.65)',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: 12
          }}>
            <span style={{ color: '#94a3b8', fontSize: 11 }}>
              {language === 'en' ? 'Drag frame or handles to select crop area' : 'ลากกรอบสี่เหลี่ยม หรือดึงมุมปรับขนาดเพื่อเลือกพื้นที่ที่ต้องการครอบตัด'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button 
                style={{ padding: '3px 8px', borderRadius: 4, background: '#334155', color: '#f1f5f9', fontSize: 11 }}
                onClick={() => setPreset('full')}
              >
                {t('cropPresetFull', 'ทั้งภาพ')}
              </button>
              <button 
                style={{ padding: '3px 8px', borderRadius: 4, background: '#334155', color: '#f1f5f9', fontSize: 11 }}
                onClick={() => setPreset(1)}
              >
                1:1
              </button>
              <button 
                style={{ padding: '3px 8px', borderRadius: 4, background: '#334155', color: '#f1f5f9', fontSize: 11 }}
                onClick={() => setPreset(4 / 3)}
              >
                4:3
              </button>
              <button 
                style={{ padding: '3px 8px', borderRadius: 4, background: '#334155', color: '#f1f5f9', fontSize: 11 }}
                onClick={() => setPreset(16 / 9)}
              >
                16:9
              </button>
            </div>
          </div>
        )}

        {/* Interactive Image Viewing & Cropping Stage (Strict Aspect Ratio Preservation) */}
        <div className="bn-snip-stage-container">
          <div 
            ref={stageRef}
            style={{ 
              position: 'relative', 
              display: 'inline-block',
              cursor: isCropMode ? 'crosshair' : 'default',
              touchAction: 'none'
            }}
            onPointerDown={(e) => handleBoxDragStart(e, 'new')}
          >
            <img 
              ref={imageRef}
              src={currentImage.dataUrl} 
              alt="Snipped Preview" 
              className="bn-snip-preview-img"
              onLoad={handleImageLoaded}
            />

            {/* Interactive Crop Frame with 8 Handles (Visible in Crop Mode) */}
            {isCropMode && cropBox && displaySize.width > 0 && (
              <div 
                className="bn-snip-crop-box"
                style={{
                  left: `${cropBox.x}px`,
                  top: `${cropBox.y}px`,
                  width: `${cropBox.width}px`,
                  height: `${cropBox.height}px`
                }}
                onPointerDown={(e) => handleBoxDragStart(e, 'move')}
              >
                {/* Real-time Dimensions Tag */}
                <div style={{
                  position: 'absolute',
                  top: -24,
                  left: 0,
                  background: '#0284c7',
                  color: '#ffffff',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  padding: '2px 6px',
                  borderRadius: 4,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap'
                }}>
                  {Math.round(origBoxRef.current.width * (cropBox.width / displaySize.width))} × {Math.round(origBoxRef.current.height * (cropBox.height / displaySize.height))} px
                </div>

                {/* 4 Corner Handles */}
                <div className="bn-snip-crop-handle bn-crop-handle-nw" onPointerDown={(e) => handleHandleDragStart(e, 'nw')} />
                <div className="bn-snip-crop-handle bn-crop-handle-ne" onPointerDown={(e) => handleHandleDragStart(e, 'ne')} />
                <div className="bn-snip-crop-handle bn-crop-handle-sw" onPointerDown={(e) => handleHandleDragStart(e, 'sw')} />
                <div className="bn-snip-crop-handle bn-crop-handle-se" onPointerDown={(e) => handleHandleDragStart(e, 'se')} />

                {/* 4 Edge Handles */}
                <div className="bn-snip-crop-handle bn-crop-handle-n" onPointerDown={(e) => handleHandleDragStart(e, 'n')} />
                <div className="bn-snip-crop-handle bn-crop-handle-s" onPointerDown={(e) => handleHandleDragStart(e, 's')} />
                <div className="bn-snip-crop-handle bn-crop-handle-w" onPointerDown={(e) => handleHandleDragStart(e, 'w')} />
                <div className="bn-snip-crop-handle bn-crop-handle-e" onPointerDown={(e) => handleHandleDragStart(e, 'e')} />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button 
              className="bn-btn-secondary"
              style={{ padding: '8px 14px', fontSize: 12, color: '#cbd5e1' }}
              onClick={onClose}
            >
              {t('cancel', 'ยกเลิก')}
            </button>

            {currentImage !== snipImage && (
              <button 
                className="bn-btn-secondary"
                style={{ padding: '8px 12px', fontSize: 12, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={handleResetOriginal}
                title={language === 'en' ? 'Revert to original captured image' : 'ย้อนกลับไปใช้ภาพแคปเจอร์แรกสุด'}
              >
                <RotateCcw size={13} />
                <span>{t('resetOriginalImage', 'คืนค่าภาพเดิม')}</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isCropMode ? (
              <>
                <button 
                  className="bn-btn-secondary"
                  style={{ padding: '8px 12px', fontSize: 12, color: '#94a3b8' }}
                  onClick={() => setIsCropMode(false)}
                >
                  {t('exitCrop', 'ออกจากการครอบตัด')}
                </button>
                <button 
                  className="bn-btn-primary"
                  style={{ 
                    padding: '8px 16px', 
                    fontSize: 12, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6,
                    background: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 600,
                    borderRadius: 8
                  }}
                  onClick={handleApplySubCrop}
                >
                  <Check size={14} />
                  <span>{t('applySubCrop', 'ตัดตามกรอบนี้')}</span>
                </button>
              </>
            ) : (
              <button 
                className="bn-btn-secondary"
                style={{ 
                  padding: '8px 14px', 
                  fontSize: 12, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6, 
                  color: '#38bdf8',
                  background: 'rgba(2, 132, 199, 0.15)',
                  border: '1px solid rgba(2, 132, 199, 0.35)',
                  borderRadius: 8
                }}
                onClick={() => {
                  setIsCropMode(true);
                  if (displaySize.width > 0 && (!cropBox || cropBox.width < 20)) {
                    setCropBox({
                      x: Math.round(displaySize.width * 0.05),
                      y: Math.round(displaySize.height * 0.05),
                      width: Math.round(displaySize.width * 0.9),
                      height: Math.round(displaySize.height * 0.9)
                    });
                  }
                }}
              >
                <Crop size={14} />
                <span>{t('cropMore', 'ครอบตัดเพิ่มเติม')}</span>
              </button>
            )}

            {/* Primary Placement Action: Confirm & Place Image, and revert active tool to pen */}
            <button 
              className="bn-btn-primary"
              style={{ 
                padding: '8px 20px', 
                fontSize: 12, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8,
                background: '#10b981',
                color: '#ffffff',
                fontWeight: 700,
                borderRadius: 8,
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
              }}
              onClick={handleConfirmPlacement}
            >
              <ClipboardPaste size={15} />
              <span>{t('confirmAndPlaceImage', 'ยืนยันและวางภาพ')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
