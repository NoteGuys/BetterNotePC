import React from 'react';
import BackupStatusModal from '../Library/BackupStatusModal';
// Compatibility entry: both former dialogs now open the same Backup & Sync window.
export const GoogleDriveModal = ({ isOpen, onClose }) =>
  <BackupStatusModal isOpen={isOpen} onClose={onClose} initialTab="drive" />;
