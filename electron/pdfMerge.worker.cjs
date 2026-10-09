// Generated export PDFs only; no notebook/profile access.
const { parentPort } = require('node:worker_threads');
const fs = require('node:fs/promises');
const { PDFDocument } = require('pdf-lib');
let merged;
parentPort.on('message', async ({ id, action, file, expectedPages }) => {
  try {
    if (action === 'append') {
      const source = await PDFDocument.load(await fs.readFile(file));
      if (source.getPageCount() !== expectedPages) throw Error('pdf-page-count');
      merged ||= await PDFDocument.create();
      for (const page of await merged.copyPages(source, source.getPageIndices())) merged.addPage(page);
      parentPort.postMessage({ id, pages: merged.getPageCount() });
    } else if (action === 'finish') {
      if (!merged || merged.getPageCount() !== expectedPages) throw Error('pdf-page-count');
      await fs.writeFile(file, await merged.save({ objectsPerTick: 30 }));
      parentPort.postMessage({ id, pages: merged.getPageCount() }); merged = null;
    } else throw Error('pdf-worker-action');
  } catch (error) {
    parentPort.postMessage({ id, error: error.message === 'pdf-page-count' ? 'pdf-page-count' : 'pdf-merge-failed' });
  }
});
