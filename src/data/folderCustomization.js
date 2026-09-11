import React from 'react';
import {
  Apple,
  Atom,
  Book,
  ShoppingBag,
  Calculator,
  BarChart3,
  Code,
  Settings,
  Landmark,
  Banknote,
  FlaskConical,
  GraduationCap,
  Scale,
  Music,
  Moon,
  FileText,
  Palette,
  Smile,
  Compass,
  Globe,
  Minus
} from 'lucide-react';

export const STUDIO_FOLDER_COLORS = [
  { id: 'red', hex: '#ef4444', label: 'แดง' },
  { id: 'orange', hex: '#f97316', label: 'ส้ม' },
  { id: 'yellow', hex: '#facc15', label: 'เหลือง' },
  { id: 'green', hex: '#10b981', label: 'เขียว' },
  { id: 'cyan', hex: '#06b6d4', label: 'ฟ้า' },
  { id: 'purple', hex: '#a855f7', label: 'ม่วง' },
  { id: 'pink', hex: '#ec4899', label: 'ชมพู' },
  { id: 'gray', hex: '#9ca3af', label: 'เทา' },
  { id: 'dark', hex: '#3f3f46', label: 'ดำชาร์โคล' }
];

export const STUDIO_FOLDER_ICONS = [
  { id: 'apple', label: 'แอปเปิ้ล', icon: Apple },
  { id: 'atom', label: 'อะตอม', icon: Atom },
  { id: 'book', label: 'หนังสือ', icon: Book },
  { id: 'bag', label: 'กระเป๋า', icon: ShoppingBag },
  { id: 'calc', label: 'คำนวณ', icon: Calculator },
  { id: 'chart', label: 'กราฟ', icon: BarChart3 },
  { id: 'code', label: 'โค้ด', icon: Code },
  { id: 'gear', label: 'ตั้งค่า', icon: Settings },
  { id: 'landmark', label: 'อาคาร', icon: Landmark },
  { id: 'money', label: 'เงิน', icon: Banknote },
  { id: 'flask', label: 'วิทย์', icon: FlaskConical },
  { id: 'grad', label: 'เรียน', icon: GraduationCap },
  { id: 'scale', label: 'ตราชั่ง', icon: Scale },
  { id: 'music', label: 'ดนตรี', icon: Music },
  { id: 'moon', label: 'ดวงจันทร์', icon: Moon },
  { id: 'doc', label: 'เอกสาร', icon: FileText },
  { id: 'palette', label: 'ศิลปะ', icon: Palette },
  { id: 'smile', label: 'ยิ้ม', icon: Smile },
  { id: 'compass', label: 'วงเวียน', icon: Compass },
  { id: 'globe', label: 'ลูกโลก', icon: Globe },
  { id: 'line', label: 'เส้นตรง', icon: Minus }
];

export const getFolderIconComponent = (iconId) => {
  const item = STUDIO_FOLDER_ICONS.find(i => i.id === iconId);
  return item ? item.icon : null;
};

export const GOODNOTES_FOLDER_COLORS = STUDIO_FOLDER_COLORS;
export const GOODNOTES_FOLDER_ICONS = STUDIO_FOLDER_ICONS;
