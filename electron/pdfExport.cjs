// Manual PDF exports only. This module never reads a notebook DB or backup path.
const registerPdfExport = (ipcMain, BrowserWindow, getMainWindow) => {
  ipcMain.handle('export-pdf-document', async (event, html) => {
    if (event.sender !== getMainWindow()?.webContents || typeof html !== 'string' ||
        !html.startsWith('<!doctype html>')) throw new Error('ไม่สามารถเริ่มส่งออก PDF ได้');
    let exportWindow, timeout;
    try {
      exportWindow = new BrowserWindow({
        show: false, width: 1200, height: 900,
        webPreferences: {
          nodeIntegration: false, contextIsolation: true, sandbox: true,
          javascript: false, backgroundThrottling: false,
          partition: 'betternote-pdf-' + Date.now() + '-' + Math.random().toString(36).slice(2)
        }
      });
      exportWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      exportWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
        callback({ cancel: !details.url.startsWith('data:') && details.url !== 'about:blank' });
      });
      const createPdf = async () => {
        await exportWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        return exportWindow.webContents.printToPDF({
          printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false,
          margins: { top: 0, bottom: 0, left: 0, right: 0 }, scale: 1,
          generateTaggedPDF: true
        });
      };
      return await Promise.race([
        createPdf(),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error('ส่งออก PDF ใช้เวลานานเกินไป กรุณาลองส่งออกทีละหน้า')), 180000);
        })
      ]);
    } catch (_) {
      throw new Error('สร้าง PDF ไม่สำเร็จ กรุณาลองส่งออกทีละหน้า');
    } finally {
      clearTimeout(timeout);
      if (exportWindow && !exportWindow.isDestroyed()) exportWindow.destroy();
    }
  });
};
module.exports = { registerPdfExport };
