import React from 'react';
import { 
  Folder, 
  Star, 
  Users, 
  Store, 
  Trash2, 
  BookOpen,
  Sun,
  Moon
} from 'lucide-react';

export const GoodnotesSidebar = ({ 
  activeView = 'documents', 
  onSelectView, 
  trashCount = 0,
  favoriteCount = 0,
  currentTheme = 'dark',
  onToggleTheme
}) => {
  const menuItems = [
    {
      id: 'documents',
      label: 'เอกสาร',
      icon: Folder,
      iconColor: 'text-blue-400 fill-blue-500'
    },
    {
      id: 'favorites',
      label: 'รายการโปรด',
      icon: Star,
      iconColor: 'text-zinc-400',
      badge: favoriteCount > 0 ? favoriteCount : null
    },
    {
      id: 'shared',
      label: 'แชร์',
      icon: Users,
      iconColor: 'text-zinc-400'
    },
    {
      id: 'marketplace',
      label: 'มาร์เก็ตเพลส',
      icon: Store,
      iconColor: 'text-zinc-400',
      subtext: '500+ รายการสำหรับคุณ'
    }
  ];

  return (
    <aside className="bn-goodnotes-sidebar">
      {/* App Logo & Title: BetterNote PRO */}
      <div className="bn-sidebar-header">
        <div className="flex items-center gap-2.5">
          <div className="bn-sidebar-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              <path d="M2 2l7.586 7.586"></path>
              <circle cx="11" cy="11" r="2"></circle>
            </svg>
          </div>
          <div className="flex items-center gap-1.5">
            <h1 className="bn-sidebar-brand-name">BetterNote</h1>
            <span className="bn-brand-badge">PRO</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Items */}
      <nav className="bn-sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              className={`bn-sidebar-item ${isActive ? 'bn-sidebar-item-active' : ''}`}
              onClick={() => onSelectView(item.id)}
            >
              <div className="bn-sidebar-item-icon">
                <Icon size={19} className={isActive ? 'text-white fill-white' : item.iconColor} />
              </div>
              <div className="bn-sidebar-item-text">
                <span className="bn-sidebar-item-label">{item.label}</span>
                {item.subtext && (
                  <span className="bn-sidebar-item-subtext">{item.subtext}</span>
                )}
              </div>
              {item.badge && (
                <span className="bn-sidebar-badge">{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Section: Trash & Theme Switch */}
      <div className="bn-sidebar-footer">
        <button
          className={`bn-sidebar-item ${activeView === 'trash' ? 'bn-sidebar-item-active' : ''}`}
          onClick={() => onSelectView('trash')}
        >
          <div className="bn-sidebar-item-icon">
            <Trash2 size={19} className={activeView === 'trash' ? 'text-white' : 'text-zinc-400'} />
          </div>
          <div className="bn-sidebar-item-text">
            <span className="bn-sidebar-item-label">ลบทิ้ง</span>
          </div>
          {trashCount > 0 && (
            <span className="bn-sidebar-badge bn-sidebar-badge-trash">{trashCount}</span>
          )}
        </button>

        {onToggleTheme && (
          <button
            type="button"
            className="bn-sidebar-item"
            onClick={onToggleTheme}
            title={`สลับธีม (ปัจจุบัน: ${currentTheme === 'light' ? 'โหมดสว่าง' : 'โหมดมืด'})`}
            style={{ marginTop: '4px' }}
          >
            <div className="bn-sidebar-item-icon">
              {currentTheme === 'light' ? (
                <Sun size={18} className="text-amber-500" />
              ) : (
                <Moon size={18} className="text-blue-400" />
              )}
            </div>
            <div className="bn-sidebar-item-text">
              <span className="bn-sidebar-item-label">
                {currentTheme === 'light' ? 'โหมดสว่าง' : 'โหมดมืด'}
              </span>
              <span className="bn-sidebar-item-subtext">คลิกเพื่อสลับธีม</span>
            </div>
          </button>
        )}
      </div>
    </aside>
  );
};
