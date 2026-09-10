// Google Drive Service for BetterNote Cloud Backup & Sync
import { getAllFolders, getAllNotebooks, getPagesByNotebookId, saveFolder, saveNotebook, savePage, getSetting, saveSetting } from './db';

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

class GoogleDriveService {
  constructor() {
    this.tokenClient = null;
    this.accessToken = null;
    this.userEmail = null;
    this.isInitialized = false;
  }

  async init(clientId) {
    if (!clientId) return false;

    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.google) {
        console.warn('Google Identity Services not loaded yet.');
        resolve(false);
        return;
      }

      try {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: async (resp) => {
            if (resp.error) {
              console.error('Google Auth Error:', resp.error);
              return;
            }
            this.accessToken = resp.access_token;
            await saveSetting('gdrive_token', resp.access_token);
            await saveSetting('gdrive_connected', true);
            // Fetch user info
            await this.fetchUserInfo();
          }
        });

        this.isInitialized = true;
        resolve(true);
      } catch (err) {
        console.error('Error initializing Google Drive token client:', err);
        resolve(false);
      }
    });
  }

  async fetchUserInfo() {
    if (!this.accessToken) return null;
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      if (res.ok) {
        const info = await res.json();
        this.userEmail = info.email;
        await saveSetting('gdrive_user_email', info.email);
        return info;
      }
    } catch (e) {
      console.warn('Failed to fetch user info', e);
    }
    return null;
  }

  requestToken() {
    return new Promise((resolve, reject) => {
      if (!this.tokenClient) {
        reject(new Error('Google Client not initialized. Please provide Client ID.'));
        return;
      }
      this.tokenClient.callback = async (resp) => {
        if (resp.error) {
          reject(resp);
          return;
        }
        this.accessToken = resp.access_token;
        await saveSetting('gdrive_token', resp.access_token);
        await saveSetting('gdrive_connected', true);
        const userInfo = await this.fetchUserInfo();
        resolve({ token: resp.access_token, email: userInfo?.email });
      };
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
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
