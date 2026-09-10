import React, { useState, useEffect, useRef } from 'react';
import { X, Edit3, Check } from 'lucide-react';

export const RenameModal = ({ isOpen, initialName = '', title = 'ตั้งชื่อใหม่', onClose, onConfirm }) => {
  const [name, setName] = useState(initialName);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim());
      onClose();
    }
  };

  return (
    <div className="bn-modal-backdrop" onClick={onClose}>
      <div className="bn-modal-card bn-rename-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="bn-rename-header">
          <div className="bn-rename-title-group">
            <div className="bn-rename-icon-badge">
              <Edit3 size={18} />
            </div>
            <div>
              <h3 className="bn-rename-title">{title}</h3>
              <p className="bn-rename-subtitle">พิมพ์ชื่อใหม่ที่ต้องการ แล้วกดบันทึก</p>
            </div>
          </div>
          <button className="bn-modal-close-btn" onClick={onClose} title="ปิด">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bn-rename-form">
          <div className="bn-rename-body">
            <label className="bn-rename-label">
              ชื่อใหม่ <span className="bn-rename-required">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bn-rename-input"
              placeholder="กรอกชื่อที่ต้องการ..."
              maxLength={120}
            />
          </div>

          <div className="bn-rename-footer">
            <button
              type="button"
              className="bn-btn-secondary bn-rename-cancel-btn"
              onClick={onClose}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="bn-btn-primary bn-rename-submit-btn"
            >
              <Check size={15} />
              <span>บันทึกชื่อ</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
