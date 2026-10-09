import React, { useId } from 'react';
import { PAPER_TEMPLATES } from '../../data/templates';

// Larger previews show the actual paper pattern, with readable line spacing.
export const PaperTemplatePreview = ({ templateId, landscape = false }) => {
  const id = useId().replace(/:/g, '');
  const template = PAPER_TEMPLATES.find(item => item.id === templateId) || PAPER_TEMPLATES[0];
  const w = landscape ? 380 : 280, h = landscape ? 280 : 380;
  const spacing = (template.spacing || 28) * 0.62;
  const dark = template.isDark;
  return (
    <svg className="bn-paper-template-preview" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <pattern id={id} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
          {template.type === 'dotted' && <circle cx={spacing / 2} cy={spacing / 2} r={1.15} fill={dark ? '#71717a' : '#94a3b8'} />}
          {template.type === 'grid' && <path d={`M ${spacing} 0 H 0 V ${spacing}`} fill="none" stroke="#b8c7d8" strokeWidth="0.8" />}
        </pattern>
      </defs>
      <rect width={w} height={h} fill={template.bg || '#ffffff'} rx="5" />
      {(template.type === 'dotted' || template.type === 'grid') && <rect width={w} height={h} fill={`url(#${id})`} />}
      {template.type === 'ruled' && <>
        {Array.from({ length: Math.floor((h - 42) / spacing) }, (_, index) => <line key={index} x1="12" x2={w - 12} y1={34 + index * spacing} y2={34 + index * spacing} stroke="#bdcad8" strokeWidth="0.9" />)}
        <line x1="38" x2="38" y1="0" y2={h} stroke="#f2a4b3" strokeWidth="1.4" />
      </>}
      {template.type === 'cornell' && <>
        <path d={`M 0 42 H ${w} M 72 42 V ${h - 72} M 0 ${h - 72} H ${w}`} stroke="#94a3b8" strokeWidth="1.4" fill="none" />
        {Array.from({ length: Math.floor((h - 136) / spacing) }, (_, index) => <line key={index} x1="84" x2={w - 12} y1={62 + index * spacing} y2={62 + index * spacing} stroke="#cbd5e1" />)}
      </>}
      {template.id === 'whiteboard' && <>
        <path d={`M ${w / 2 - 45} ${h / 2} C ${w / 2 - 75} ${h / 2 - 45}, ${w / 2 - 75} ${h / 2 + 45}, ${w / 2 - 45} ${h / 2} S ${w / 2 + 75} ${h / 2 - 45}, ${w / 2 + 45} ${h / 2} S ${w / 2 - 15} ${h / 2 + 45}, ${w / 2 - 45} ${h / 2}`} fill="none" stroke="#93a8bf" strokeWidth="5" strokeLinecap="round" />
        <path d={`M 18 42 V 18 H 42 M ${w - 42} 18 H ${w - 18} V 42 M 18 ${h - 42} V ${h - 18} H 42 M ${w - 42} ${h - 18} H ${w - 18} V ${h - 42}`} stroke="#cbd5e1" strokeWidth="2" fill="none" />
      </>}
    </svg>
  );
};
