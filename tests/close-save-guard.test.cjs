const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { installLocalSaveGuard } = require('../electron/localSaveGuard.cjs');

const tick = () => new Promise(resolve => setImmediate(resolve));
const fixture = (response = 0) => {
  const ipcMain = new EventEmitter(), window = new EventEmitter();
  const sent = [], timers = new Map(), messages = [];
  let timerId = 0;
  Object.assign(window, {
    webContents: { mainFrame: {}, send: (channel, data) => sent.push({ channel, data }) },
    destroyed: false, closed: 0, focused: 0,
    isDestroyed() { return this.destroyed; },
    focus() { this.focused++; },
    close() {
      const event = { prevented: false, preventDefault() { this.prevented = true; } };
      this.emit('close', event);
      if (!event.prevented) { this.closed++; this.destroyed = true; this.emit('closed'); }
      return event;
    }
  });
  const trusted = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
  const dispose = installLocalSaveGuard({
    window, ipcMain,
    dialog: { showMessageBox: async (_window, options) => { messages.push(options); return { response }; } },
    schedule: callback => { const id = ++timerId; timers.set(id, callback); return id; },
    cancel: id => timers.delete(id)
  });
  const ready = () => ipcMain.emit('local-save-ready', trusted, { labels: { message: 'Translated message' } });
  const request = () => sent.filter(message => message.channel === 'local-save-before-close').at(-1).data.requestId;
  const reply = (success, event = trusted, requestId = request()) => ipcMain.emit('local-save-close-result', event, { requestId, success });
  return { ipcMain, window, sent, timers, messages, trusted, ready, request, reply, dispose };
};

test('Closing before the renderer can edit does not wait for a nonexistent listener', () => {
  const f = fixture(); f.window.close(); assert.equal(f.window.closed, 1);
});

test('Normal close waits for a trusted local-save acknowledgment', () => {
  const f = fixture(); f.ready();
  assert.equal(f.window.close().prevented, true); assert.equal(f.window.closed, 0);
  f.reply(true); assert.equal(f.window.closed, 1); assert.equal(f.timers.size, 0);
});

test('An untrusted frame cannot make the app close', () => {
  const f = fixture(); f.ready(); f.window.close();
  f.reply(true, { sender: f.window.webContents, senderFrame: {} });
  f.reply(true, { sender: {}, senderFrame: f.window.webContents.mainFrame });
  assert.equal(f.window.closed, 0); f.dispose();
});

test('A wrong request ID or nonboolean success cannot bypass the guard', async () => {
  const f = fixture(); f.ready(); f.window.close();
  f.reply(true, f.trusted, 999); assert.equal(f.window.closed, 0);
  f.reply('true'); await tick(); assert.equal(f.window.closed, 0); f.dispose();
});

test('A failed save keeps the window open and uses the chosen language', async () => {
  const f = fixture(); f.ready(); f.window.close(); f.reply(false); await tick();
  assert.equal(f.window.closed, 0); assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].message, 'Translated message');
  assert(f.sent.some(message => message.channel === 'local-save-close-cancelled'));
  assert.equal(f.window.focused, 1); f.dispose();
});

test('Repeated close clicks share one save request', () => {
  const f = fixture(); f.ready(); f.window.close(); f.window.close(); f.window.close();
  assert.equal(f.sent.filter(message => message.channel === 'local-save-before-close').length, 1);
  f.dispose();
});

test('A timeout keeps the window open and ignores the late acknowledgment', async () => {
  const f = fixture(); f.ready(); f.window.close(); const oldId = f.request();
  [...f.timers.values()][0](); await tick();
  f.reply(true, f.trusted, oldId);
  assert.equal(f.window.closed, 0); assert.equal(f.messages.length, 1); f.dispose();
});

test('Retry after failure requires a fresh successful acknowledgment', async () => {
  const f = fixture(1); f.ready(); f.window.close(); const oldId = f.request();
  f.reply(false); await tick(); const freshId = f.request();
  assert.notEqual(freshId, oldId); assert.equal(f.window.closed, 0);
  f.reply(true, f.trusted, oldId); assert.equal(f.window.closed, 0);
  f.reply(true, f.trusted, freshId); assert.equal(f.window.closed, 1);
});

test('Guard cleanup removes IPC listeners and its pending timer', () => {
  const f = fixture(); f.ready(); f.window.close(); f.dispose();
  assert.equal(f.timers.size, 0);
  assert.equal(f.ipcMain.listenerCount('local-save-ready'), 0);
  assert.equal(f.ipcMain.listenerCount('local-save-close-result'), 0);
});

test('A spoofed readiness message cannot enable or reconfigure the guard', () => {
  const f = fixture();
  f.ipcMain.emit('local-save-ready', { sender: {} }, { labels: { message: 'Spoof' } });
  f.window.close(); assert.equal(f.window.closed, 1);
});
