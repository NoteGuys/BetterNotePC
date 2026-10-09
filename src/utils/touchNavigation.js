// Shared, lightweight touch rules. No drawing, storage or background work.
export const createTouchGuard = () => {
  let contacts = new Set(), blocked = new Set();
  return {
    update(touches, locked = false) {
      contacts = new Set(Array.from(touches, t => t.identifier));
      blocked = new Set([...blocked].filter(id => contacts.has(id)));
      if (locked) for (const id of contacts) blocked.add(id);
      return Array.from(touches).filter(t => !blocked.has(t.identifier));
    },
    block() { for (const id of contacts) blocked.add(id); },
    suspend() { for (const id of contacts) blocked.add(id); contacts.clear(); },
    reset() { contacts.clear(); blocked.clear(); },
    get size() { return contacts.size; }
  };
};

export const touchSnapshot = touches => {
  const a = touches[0], b = touches[1] || a;
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2,
    distance: Math.max(1, Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)), count: touches.length };
};

// A cancelled/panned/pinched contact sequence can never become an Undo tap.
export const createTwoFingerTap = (now = () => performance.now()) => {
  let candidate = null, previous = null;
  return {
    start(touches) {
      const time = now();
      if (!candidate) candidate = { time, ids: new Set(), two: false, dirty: false, positions: new Map() };
      for (const touch of touches) {
        const id = touch.identifier;
        candidate.ids.add(id);
        if (!candidate.positions.has(id)) candidate.positions.set(id, { x: touch.clientX, y: touch.clientY });
      }
      if (touches.length === 2 && candidate.ids.size === 2 && time - candidate.time <= 160) candidate.two = true;
      if (touches.length > 2 || candidate.ids.size > 2) { candidate.dirty = true; previous = null; }
    },
    move(touches) {
      if (!candidate) return;
      for (const touch of touches) {
        const start = candidate.positions.get(touch.identifier);
        if (!start || Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 8) {
          candidate.dirty = true; previous = null;
        }
      }
    },
    end(touches) {
      if (touches.length) return false;
      const current = candidate; candidate = null;
      const time = now();
      if (!current?.two || current.dirty || time - current.time > 450) { previous = null; return false; }
      if (previous !== null && time - previous >= 40 && time - previous <= 480) { previous = null; return true; }
      previous = time; return false;
    },
    cancel() { candidate = null; previous = null; }
  };
};

export const normalizeWheel = (event, pageHeight = 800) => {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pageHeight : 1;
  return { x: event.deltaX * unit, y: event.deltaY * unit };
};

// One page per continuous scroll gesture, including the touchpad's inertial tail.
export const createWheelPageGate = (now = () => performance.now()) => {
  let last = -Infinity, total = 0, fired = false;
  return {
    push(delta) {
      const time = now();
      if (time - last > 220) { total = 0; fired = false; }
      last = time;
      if (fired) return 0;
      if (Math.sign(delta) !== Math.sign(total)) total = 0;
      total += delta;
      if (Math.abs(total) < 40) return 0;
      fired = true; return Math.sign(total);
    },
    reset() { last = -Infinity; total = 0; fired = false; }
  };
};
