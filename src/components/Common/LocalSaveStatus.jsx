import React, { useSyncExternalStore } from 'react';
import { Check, LoaderCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { getLocalSaveSnapshot, subscribeLocalSaves, flushLocalSaves } from '../../services/localSaveService';
import { useLanguage } from '../../services/i18n';

export const LocalSaveStatus = () => {
  const { t } = useLanguage();
  const state = useSyncExternalStore(subscribeLocalSaves, getLocalSaveSnapshot, getLocalSaveSnapshot);
  const failed = state.status === 'error';
  const saving = state.status === 'saving';
  const label = t(failed ? 'localSaveFailed' : saving ? 'localSaveSaving' : 'localSaveSaved');
  return (
    <div className={'bn-local-save-status bn-local-save-status-' + state.status}
      role={failed ? 'alert' : 'status'} aria-live={failed ? 'assertive' : 'polite'}
      title={t(failed ? 'localSaveFailedHint' : 'localSaveDeviceHint')}>
      {failed ? <AlertCircle size={14} /> : saving ? <LoaderCircle size={14} className="bn-local-save-spinner" /> : <Check size={14} />}
      <span>{label}</span>
      {failed && <button type="button" onClick={() => { flushLocalSaves({ retry: true }).catch(() => {}); }}
        title={t('localSaveRetry')} aria-label={t('localSaveRetry')}>
        <RotateCcw size={13} /><span>{t('localSaveRetry')}</span>
      </button>}
    </div>
  );
};
