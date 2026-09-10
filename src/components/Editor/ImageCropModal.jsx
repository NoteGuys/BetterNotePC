import React, { useState, useRef, useEffect } from 'react';
import { Crop, X, Check, RotateCcw } from 'lucide-react';

export const ImageCropModal = ({ image, onCrop, onClose }) => {
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const [cropBox, setCropBox] = useState(null); // in display pixels: { x, y, width, height }
  const [displaySize, setDisplaySize] = useState({ width: 1, height: 1 });
  const imageRef = useRef(null);
  const stageRef = useRef(null);
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, mode: 'new', initialBox: null });

  // Load natural dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    };
    img.src = image.src;
  }, [image.src]);

  // When image mounts and display size is known, set initial crop box (inset 5%)
  const handleImageLoaded = () => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    setDisplaySize({ width: w, height: h });
    const insetX = w * 0.05;
    const insetY = h * 0.05;
    setCropBox({
      x: insetX,
      y: insetY,
      width: Math.max(30, w - insetX * 2),
      height: Math.max(30, h - insetY * 2)
    });
  };

  // Dragging to create or adjust crop box
  const handlePointerDown = (e, mode = 'new') => {
    e.preventDefault();
    e.stopPropagation();
    if (!stageRef.current) return;
    const stageRect = stageRef.current.getBoundingClientRect();
    const curX = Math.max(0, Math.min(displaySize.width, e.clientX - stageRect.left));
    const curY = Math.max(0, Math.min(displaySize.height, e.clientY - stageRect.top));

    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}

    dragRef.current = {
      isDragging: true,
      startX: curX,
      startY: curY,
      mode,
      initialBox: cropBox ? { ...cropBox } : null
    };

    if (mode === 'new') {
      setCropBox({ x: curX, y: curY, width: 0, height: 0 });
    }
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.isDragging || !stageRef.current) return;
    e.preventDefault();
    const stageRect = stageRef.current.getBoundingClientRect();
    const curX = Math.max(0, Math.min(displaySize.width, e.clientX - stageRect.left));
    const curY = Math.max(0, Math.min(displaySize.height, e.clientY - stageRect.top));

    const { startX, startY, mode, initialBox } = dragRef.current;

    if (mode === 'new') {
      const x = Math.min(startX, curX);
      const y = Math.min(startY, curY);
      const width = Math.abs(curX - startX);
      const height = Math.abs(curY - startY);
      setCropBox({ x, y, width, height });
    } else if (mode === 'move' && initialBox) {
      const dx = curX - startX;
      const dy = curY - startY;
      const newX = Math.max(0, Math.min(displaySize.width - initialBox.width, initialBox.x + dx));
      const newY = Math.max(0, Math.min(displaySize.height - initialBox.height, initialBox.y + dy));
      setCropBox({ ...initialBox, x: newX, y: newY });
    }
  };

  const handlePointerUp = (e) => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
      // If box is too small, revert or set default
      if (!cropBox || cropBox.width < 15 || cropBox.height < 15) {
        setCropBox({
          x: 0,
          y: 0,
          width: displaySize.width,
          height: displaySize.height
        });
      }
    }
  };

  // Presets
  const setPreset = (ratio) => {
    if (!displaySize.width) return;
    if (ratio === 'full') {
      setCropBox({ x: 0, y: 0, width: displaySize.width, height: displaySize.height });
      return;
    }
    let targetW = displaySize.width * 0.8;
    let targetH = targetW / ratio;
    if (targetH > displaySize.height * 0.8) {
      targetH = displaySize.height * 0.8;
      targetW = targetH * ratio;
    }
    const x = (displaySize.width - targetW) / 2;
    const y = (displaySize.height - targetH) / 2;
    setCropBox({ x, y, width: targetW, height: targetH });
  };

  // Perform Crop Execution
  const handleApplyCrop = () => {
    if (!cropBox || cropBox.width < 5 || cropBox.height < 5) return;

    const scaleX = naturalSize.width / displaySize.width;
    const scaleY = naturalSize.height / displaySize.height;

    const naturalCropX = Math.round(cropBox.x * scaleX);
    const naturalCropY = Math.round(cropBox.y * scaleY);
    const naturalCropW = Math.round(cropBox.width * scaleX);
    const naturalCropH = Math.round(cropBox.height * scaleY);

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
      onCrop(croppedDataUrl, Math.round(cropBox.width), Math.round(cropBox.height));
    };
    img.src = image.src;
  };

  return (
    <div className="bn-modal-backdrop" onClick={onClose}>
      <div 
        className="bn-modal-content max-w-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '92vw', maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="bn-modal-header flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Crop size={20} className="text-blue-400" />
            <h3 className="text-base font-semibold text-white">ครอบตัดรูปภาพ (Crop Image)</h3>
          </div>
          <button 
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar Presets */}
        <div className="flex items-center justify-between py-2 px-1 border-b border-zinc-800/60 text-xs">
          <span className="text-zinc-400">ลากเมาส์/ปากกาบนภาพเพื่อเลือกบริเวณที่ต้องการตัด</span>
          <div className="flex items-center gap-1.5">
            <button 
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
              onClick={() => setPreset('full')}
            >
              ทั้งภาพ
            </button>
            <button 
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
              onClick={() => setPreset(1)}
            >
              1:1
            </button>
            <button 
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
              onClick={() => setPreset(4 / 3)}
            >
              4:3
            </button>
            <button 
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
              onClick={() => setPreset(16 / 9)}
            >
              16:9
            </button>
          </div>
        </div>

        {/* Interactive Cropping Stage */}
        <div className="relative flex items-center justify-center p-4 bg-zinc-950/80 rounded-xl my-3 overflow-hidden select-none" style={{ minHeight: 340, maxHeight: '58vh' }}>
          <div 
            ref={stageRef}
            className="relative inline-block"
            onPointerDown={(e) => handlePointerDown(e, 'new')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ cursor: 'crosshair', touchAction: 'none' }}
          >
            <img 
              ref={imageRef}
              src={image.src} 
              alt="To Crop" 
              className="max-h-[52vh] max-w-full block object-contain pointer-events-none rounded"
              onLoad={handleImageLoaded}
            />

            {/* Dark Mask around crop box */}
            {cropBox && (
              <>
                {/* Crop Box Frame with Dashed Border */}
                <div 
                  className="absolute border-2 border-blue-400 shadow-2xl rounded-sm"
                  style={{
                    left: `${cropBox.x}px`,
                    top: `${cropBox.y}px`,
                    width: `${cropBox.width}px`,
                    height: `${cropBox.height}px`,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
                    cursor: 'move'
                  }}
                  onPointerDown={(e) => handlePointerDown(e, 'move')}
                >
                  {/* Dimensions indicator */}
                  <div className="absolute -top-7 left-0 bg-blue-600 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow">
                    {Math.round(cropBox.width)} × {Math.round(cropBox.height)} px
                  </div>

                  {/* Corner Visual Indicators */}
                  <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-blue-600 rounded-sm pointer-events-none"></div>
                  <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-blue-600 rounded-sm pointer-events-none"></div>
                  <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-blue-600 rounded-sm pointer-events-none"></div>
                  <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-blue-600 rounded-sm pointer-events-none"></div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button 
            className="bn-btn-secondary py-2 px-4 text-sm"
            onClick={onClose}
          >
            ยกเลิก
          </button>
          <button 
            className="bn-btn-primary py-2 px-5 text-sm flex items-center gap-2"
            onClick={handleApplyCrop}
          >
            <Check size={16} />
            <span>ยืนยันการครอบตัด</span>
          </button>
        </div>
      </div>
    </div>
  );
};
