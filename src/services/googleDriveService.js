// Google Drive Service for BetterNote Cloud Backup & Sync
import { getAllFolders, getAllNotebooks, getPagesByNotebookId, saveFolder, saveNotebook, savePage, getSetting, saveSetting } from './db';
import { DEFAULT_GOOGLE_CLIENT_ID } from '../config/googleConfig';

const SCOPES = 'openid email https://www.googleapis.com/auth/drive.file';
class GoogleDriveService {
  constructor() {
    this.tokenClient = null;
    this.accessToken = null;
    this.userEmail = null;
    this.isInitialized = false;
    this.clientId = null;
    this.nativeAuth = false;
    this.tokenExpiresAt = null;
    this.lastAuthError = null;
    this.pendingAuthorization = null;
    this.authorizedAccount = null;
    this.nativeRequest = null;
  }

  async init(clientId = null) {
    const configured = clientId || DEFAULT_GOOGLE_CLIENT_ID;
    this.clientId = typeof configured === 'string' ? configured.trim() : '';
    this.lastAuthError = null;
    if (!this.clientId) { this.lastAuthError = 'client-not-configured'; return false; }
    if (typeof window !== 'undefined' && window.electronAPI?.connectGoogleAccount) {
      this.nativeAuth = true;
      this.isInitialized = true;
      return true;
    }
    this.nativeAuth = false;
    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2?.initTokenClient) {
      this.lastAuthError = 'google-library-unavailable'; return false;
    }
    try {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.clientId, scope: SCOPES, callback: () => {},
        error_callback: response => this.pendingAuthorization?.reject(new Error(
          response?.type === 'popup_closed' ? 'cancelled' : 'browser-open-failed'))
      });
      this.isInitialized = true;
      return true;
    } catch (_) { this.lastAuthError = 'client-initialization-failed'; return false; }
  }

  async fetchUserInfo() {
    if (!this.accessToken || this.tokenExpiresAt && this.tokenExpiresAt <= Date.now()) return null;
    if (this.nativeAuth && this.authorizedAccount) return this.authorizedAccount;
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: 'Bearer ' + this.accessToken }
      });
      if (res.ok) {
        const info = await res.json();
        this.userEmail = info.email || '';
        return info;
      }
    } catch (_) {}
    return null;
  }

  async requestToken() {
    if (this.nativeAuth) {
      const request = { cancelled: false };
      this.nativeRequest = request;
      try {
        const result = await window.electronAPI.connectGoogleAccount(this.clientId);
        if (request.cancelled) throw new Error('cancelled');
        if (!result?.success || !result.authorized || !result.accessToken) throw new Error(result?.reason || 'authorization-failed');
        this.accessToken = result.accessToken;
        this.userEmail = result.email || '';
        this.tokenExpiresAt = result.expiresAt || null;
        this.authorizedAccount = { email: this.userEmail };
        try {
          await saveSetting('gdrive_connected', true);
          await saveSetting('gdrive_user_email', this.userEmail);
        } catch (_) {
          this.accessToken = null; this.userEmail = null; this.tokenExpiresAt = null; this.authorizedAccount = null;
          throw new Error('connection-state-not-saved');
        }
        if (request.cancelled) throw new Error('cancelled');
        // Access tokens stay in memory; no token is written into the notebook database.
        return { token: this.accessToken, email: this.userEmail };
      } finally { if (this.nativeRequest === request) this.nativeRequest = null; }
    }
    if (!this.tokenClient) throw new Error(this.lastAuthError || 'client-not-initialized');
    if (this.pendingAuthorization) return this.pendingAuthorization.promise;
    let resolve, reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    let timer;
    const pending = {
      promise,
      reject: error => { if (this.pendingAuthorization !== pending) return; clearTimeout(timer); this.pendingAuthorization = null; reject(error); }
    };
    this.pendingAuthorization = pending;
    timer = setTimeout(() => pending.reject(new Error('authentication-timeout')), 120000);
    this.tokenClient.callback = async response => {
      if (this.pendingAuthorization !== pending) return;
      if (response?.error || !response?.access_token) { pending.reject(new Error(response?.error === 'access_denied' ? 'access-denied' : 'authorization-failed')); return; }
      this.accessToken = response.access_token;
      this.tokenExpiresAt = response.expires_in ? Date.now() + Number(response.expires_in) * 1000 : null;
      try {
        const account = await this.fetchUserInfo();
        if (this.pendingAuthorization !== pending) return;
        await saveSetting('gdrive_connected', true);
        await saveSetting('gdrive_user_email', account?.email || '');
        if (this.pendingAuthorization !== pending) return;
        clearTimeout(timer); this.pendingAuthorization = null;
        resolve({ token: this.accessToken, email: account?.email });
      } catch (_) { this.accessToken = null; pending.reject(new Error('connection-state-not-saved')); }
    };
    try { this.tokenClient.requestAccessToken({ prompt: 'select_account consent' }); }
    catch (_) { pending.reject(new Error('browser-open-failed')); }
    return promise;
  }

  async cancelConnection() {
    const pending = !!this.nativeRequest || !!this.pendingAuthorization;
    if (this.nativeRequest) this.nativeRequest.cancelled = true;
    this.pendingAuthorization?.reject(new Error('cancelled'));
    if (pending) { this.accessToken = null; this.userEmail = null; this.authorizedAccount = null; this.tokenExpiresAt = null; }
    if (typeof window !== 'undefined') await window.electronAPI?.cancelGoogleAccountConnection?.();
    if (pending) await saveSetting('gdrive_connected', false);
  }

  async getAppFolderId() {
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');

    // Search for BetterNote folder in Google Drive
    const q = "name = 'BetterNote_Cloud_Sync' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id, name)`;

    const res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    const data = await res.json();

    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    // Create folder if not found
    const createUrl = 'https://www.googleapis.com/drive/v3/files';
    const folderMeta = {
      name: 'BetterNote_Cloud_Sync',
      mimeType: 'application/vnd.google-apps.folder'
    };

    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(folderMeta)
    });
    const created = await createRes.json();
    return created.id;
  }

  async backupAllToDrive() {
    if (!this.accessToken) throw new Error('Not connected to Google Drive');

    const folderId = await this.getAppFolderId();

    // Export entire database bundle
    const folders = await getAllFolders();
    const notebooks = await getAllNotebooks();
    const fullBackup = {
      version: 1,
      appName: 'BetterNote',
      timestamp: Date.now(),
      folders,
      notebooks: []
    };

    for (const nb of notebooks) {
      const pages = await getPagesByNotebookId(nb.id);
      fullBackup.notebooks.push({
        ...nb,
        pages
      });
    }

    const fileName = `BetterNote_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    const fileContent = JSON.stringify(fullBackup, null, 2);

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: [folderId]
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      closeDelim;

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.json();
      throw new Error(err.error?.message || 'Failed to upload backup to Google Drive');
    }

    await saveSetting('gdrive_last_sync', Date.now());
    return await uploadRes.json();
  }
}

export const googleDrive = new GoogleDriveService();
