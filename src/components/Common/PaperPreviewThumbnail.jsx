import React from 'react';

/**
 * High-definition miniature vector SVG preview for notebook paper templates
 * Used in NewItemModal (Lobby) and AddPageModal (Editor)
 */
export const PaperPreviewThumbnail = ({ templateId, width = 34, height = 46 }) => {
  if (templateId === 'dark-dotted') {
    return (
      <svg width={width} height={height} viewBox="0 0 34 46" style={{ borderRadius: '3px', boxShadow: '0 1px 4px rgba(0,0,0,0.5)', flexShrink: 0 }}>
        <rect width="34" height="46" fill="#18181b" stroke="#3f3f46" strokeWidth="1" rx="3" />
        <circle cx="8" cy="9" r="0.75" fill="#a1a1aa" />
        <circle cx="17" cy="9" r="0.75" fill="#a1a1aa" />
        <circle cx="26" cy="9" r="0.75" fill="#a1a1aa" />
        <circle cx="8" cy="18" r="0.75" fill="#a1a1aa" />
        <circle cx="17" cy="18" r="0.75" fill="#a1a1aa" />
        <circle cx="26" cy="18" r="0.75" fill="#a1a1aa" />
        <circle cx="8" cy="27" r="0.75" fill="#a1a1aa" />
        <circle cx="17" cy="27" r="0.75" fill="#a1a1aa" />
        <circle cx="26" cy="27" r="0.75" fill="#a1a1aa" />
        <circle cx="8" cy="36" r="0.75" fill="#a1a1aa" />
        <circle cx="17" cy="36" r="0.75" fill="#a1a1aa" />
        <circle cx="26" cy="36" r="0.75" fill="#a1a1aa" />
      </svg>
    );
  }

  if (templateId === 'dotted') {
    return (
      <svg width={width} height={height} viewBox="0 0 34 46" style={{ borderRadius: '3px', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', flexShrink: 0 }}>
        <rect width="34" height="46" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" rx="3" />
        <circle cx="8" cy="9" r="0.75" fill="#64748b" />
        <circle cx="17" cy="9" r="0.75" fill="#64748b" />
        <circle cx="26" cy="9" r="0.75" fill="#64748b" />
        <circle cx="8" cy="18" r="0.75" fill="#64748b" />
        <circle cx="17" cy="18" r="0.75" fill="#64748b" />
        <circle cx="26" cy="18" r="0.75" fill="#64748b" />
        <circle cx="8" cy="27" r="0.75" fill="#64748b" />
        <circle cx="17" cy="27" r="0.75" fill="#64748b" />
        <circle cx="26" cy="27" r="0.75" fill="#64748b" />
        <circle cx="8" cy="36" r="0.75" fill="#64748b" />
        <circle cx="17" cy="36" r="0.75" fill="#64748b" />
        <circle cx="26" cy="36" r="0.75" fill="#64748b" />
      </svg>
    );
  }

  if (templateId === 'narrow-ruled') {
    return (
      <svg width={width} height={height} viewBox="0 0 34 46" style={{ borderRadius: '3px', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', flexShrink: 0 }}>
        <rect width="34" height="46" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" rx="3" />
        <line x1="7" y1="0" x2="7" y2="46" stroke="#f87171" strokeWidth="0.8" />
        <line x1="0" y1="8" x2="34" y2="8" stroke="#cbd5e1" strokeWidth="0.7" />
        <line x1="0" y1="14" x2="34" y2="14" stroke="#cbd5e1" strokeWidth="0.7" />
        <line x1="0" y1="20" x2="34" y2="20" stroke="#cbd5e1" strokeWidth="0.7" />
        <line x1="0" y1="26" x2="34" y2="26" stroke="#cbd5e1" strokeWidth="0.7" />
        <line x1="0" y1="32" x2="34" y2="32" stroke="#cbd5e1" strokeWidth="0.7" />
        <line x1="0" y1="38" x2="34" y2="38" stroke="#cbd5e1" strokeWidth="0.7" />
      </svg>
    );
  }

  if (templateId === 'wide-ruled') {
    return (
      <svg width={width} height={height} viewBox="0 0 34 46" style={{ borderRadius: '3px', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', flexShrink: 0 }}>
        <rect width="34" height="46" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" rx="3" />
        <line x1="7" y1="0" x2="7" y2="46" stroke="#f87171" strokeWidth="0.8" />
        <line x1="0" y1="12" x2="34" y2="12" stroke="#cbd5e1" strokeWidth="0.7" />
        <line x1="0" y1="23" x2="34" y2="23" stroke="#cbd5e1" strokeWidth="0.7" />
        <line x1="0" y1="34" x2="34" y2="34" stroke="#cbd5e1" strokeWidth="0.7" />
      </svg>
    );
  }

  if (templateId === 'ruled') {
    return (
      <svg width={width} height={height} viewBox="0 0 34 46" style={{ borderRadius: '3px', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', flexShrink: 0 }}>
        <rect width="34" height="46" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" rx="3" />
        <line x1="7" y1="0" x2="7" y2="46" stroke="#f87171" strokeWidth="0.8" />
        <line x1="0" y1="10" x2="34" y2="10" stroke="#cbd5e1" strokeWidth="0.7" />
        <line x1="0" y1="18" x2="34" y2="18" stroke="#cbd5e1" strokeWidth="0.7" />
        <line x1="0" y1="26" x2="34" y2="26" stroke="#cbd5e1" strokeWidth="0.7" />
        <line x1="0" y1="34" x2="34" y2="34" stroke="#cbd5e1" strokeWidth="0.7" />
        <line x1="0" y1="42" x2="34" y2="42" stroke="#cbd5e1" strokeWidth="0.7" />
      </svg>
    );
  }

  if (templateId === 'grid') {
    return (
      <svg width={width} height={height} viewBox="0 0 34 46" style={{ borderRadius: '3px', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', flexShrink: 0 }}>
        <rect width="34" height="46" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" rx="3" />
        <line x1="7" y1="0" x2="7" y2="46" stroke="#e2e8f0" strokeWidth="0.6" />
        <line x1="14" y1="0" x2="14" y2="46" stroke="#e2e8f0" strokeWidth="0.6" />
        <line x1="21" y1="0" x2="21" y2="46" stroke="#e2e8f0" strokeWidth="0.6" />
        <line x1="28" y1="0" x2="28" y2="46" stroke="#e2e8f0" strokeWidth="0.6" />
        <line x1="0" y1="8" x2="34" y2="8" stroke="#e2e8f0" strokeWidth="0.6" />
        <line x1="0" y1="16" x2="34" y2="16" stroke="#e2e8f0" strokeWidth="0.6" />
        <line x1="0" y1="24" x2="34" y2="24" stroke="#e2e8f0" strokeWidth="0.6" />
        <line x1="0" y1="32" x2="34" y2="32" stroke="#e2e8f0" strokeWidth="0.6" />
        <line x1="0" y1="40" x2="34" y2="40" stroke="#e2e8f0" strokeWidth="0.6" />
      </svg>
    );
  }

  if (templateId === 'cornell') {
    return (
      <svg width={width} height={height} viewBox="0 0 34 46" style={{ borderRadius: '3px', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', flexShrink: 0 }}>
        <rect width="34" height="46" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" rx="3" />
        <line x1="0" y1="8" x2="34" y2="8" stroke="#94a3b8" strokeWidth="0.8" />
        <line x1="11" y1="8" x2="11" y2="36" stroke="#94a3b8" strokeWidth="0.8" />
        <line x1="0" y1="36" x2="34" y2="36" stroke="#94a3b8" strokeWidth="0.8" />
        <line x1="13" y1="14" x2="32" y2="14" stroke="#e2e8f0" strokeWidth="0.6" />
        <line x1="13" y1="20" x2="32" y2="20" stroke="#e2e8f0" strokeWidth="0.6" />
        <line x1="13" y1="26" x2="32" y2="26" stroke="#e2e8f0" strokeWidth="0.6" />
        <line x1="13" y1="32" x2="32" y2="32" stroke="#e2e8f0" strokeWidth="0.6" />
      </svg>
    );
  }

  // Blank paper
  return (
    <svg width={width} height={height} viewBox="0 0 34 46" style={{ borderRadius: '3px', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', flexShrink: 0 }}>
      <rect width="34" height="46" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" rx="3" />
    </svg>
  );
};
