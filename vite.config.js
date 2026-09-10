import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Auto-Backup Vite Plugin: Automatically saves notebooks to Google Drive (G:\My Drive) and local disk
function autoBackupPlugin() {
  return {
    name: 'auto-backup-plugin',
    configureServer(server) {
      server.middlewares.use('/api/auto-backup', async (req, res, next) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const gDriveRoot = 'H:\\My Drive\\BetterNote.AppPC';
              const localRoot = path.resolve(process.cwd(), 'BetterNote_Backups');

              const targets = [gDriveRoot, localRoot];
              if (data?.customBackupPath && typeof data.customBackupPath === 'string' && data.customBackupPath.trim()) {
                const customTrimmed = data.customBackupPath.trim();
                if (!targets.includes(customTrimmed)) {
                  targets.unshift(customTrimmed);
                }
              }
              const savedPaths = [];

              for (const target of targets) {
                try {
                  const pdfDir = path.join(target, 'PDF_Documents');
                  const editDir = path.join(target, 'Editable_Notes');
                  const fullDir = path.join(target, 'Full_System');

                  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
                  if (!fs.existsSync(editDir)) fs.mkdirSync(editDir, { recursive: true });
                  if (!fs.existsSync(fullDir)) fs.mkdirSync(fullDir, { recursive: true });

                  // 1. Save full system backup JSON
                  if (data.fullBackup) {
                    const fullBackupFile = path.join(fullDir, 'BetterNote_Latest_Backup.json');
                    fs.writeFileSync(fullBackupFile, JSON.stringify(data.fullBackup, null, 2), 'utf-8');
                    savedPaths.push(fullBackupFile);
                  }

                  // 2. Save individual notebooks (editable .bnote and PDF)
                  if (data.notebooks && Array.isArray(data.notebooks)) {
                    for (const nb of data.notebooks) {
                      const cleanName = (nb.name || 'Untitled').replace(/[\\/:*?"<>|]/g, '_');

                      // Editable note file (.bnote)
                      const bnoteFile = path.join(editDir, `${cleanName}.bnote`);
                      fs.writeFileSync(bnoteFile, JSON.stringify(nb, null, 2), 'utf-8');
                      savedPaths.push(bnoteFile);

                      // PDF Document file
                      if (nb.pdfBase64 && typeof nb.pdfBase64 === 'string') {
                        const pdfClean = nb.pdfBase64
                          .replace(/^data:application\/pdf.*?;base64,/, '')
                          .replace(/^data:[^;]+;base64,/, '')
                          .trim();
                        if (pdfClean.length > 0) {
                          const pdfFile = path.join(pdfDir, `${cleanName}.pdf`);
                          fs.writeFileSync(pdfFile, Buffer.from(pdfClean, 'base64'));
                          savedPaths.push(pdfFile);
                        }
                      }
                    }
                  }
                } catch (targetErr) {
                  console.warn(`Could not write to ${target}:`, targetErr.message);
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, savedCount: savedPaths.length, timestamp: Date.now() }));
            } catch (err) {
              console.error('Backup API error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        } else {
          next();
        }
      });
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), autoBackupPlugin()],
  optimizeDeps: {
    include: ['pdfjs-dist', 'jspdf', 'idb', 'lucide-react']
  },
  server: {
    host: true,
    port: 3000,
    open: false
  }
});
