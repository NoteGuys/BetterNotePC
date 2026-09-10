import React from 'react';
import { ChevronRight, Home, Folder } from 'lucide-react';

export const Breadcrumb = ({ currentFolder, folderChain, onNavigate }) => {
  return (
    <nav className="bn-breadcrumb">
      <button 
        className={`bn-breadcrumb-item ${!currentFolder ? 'bn-breadcrumb-active' : ''}`}
        onClick={() => onNavigate(null)}
      >
        <Home size={16} />
        <span>คลังเอกสาร (Documents)</span>
      </button>

      {folderChain.map((folder, index) => {
        const isLast = index === folderChain.length - 1;
        return (
          <React.Fragment key={folder.id}>
            <ChevronRight size={15} className="bn-breadcrumb-separator" />
            <button 
              className={`bn-breadcrumb-item ${isLast ? 'bn-breadcrumb-active' : ''}`}
              onClick={() => onNavigate(folder.id)}
            >
              <Folder size={15} style={{ color: folder.color || '#3b82f6' }} />
              <span>{folder.name}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
};
