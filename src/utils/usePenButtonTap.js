import { useRef } from 'react';
// A compatibility click may target a newly opened overlay after its old button
// disappears. Keep this short-lived guard on the document, including on unmount.
const pendingClicks = new WeakMap();
const guardCompatibilityClick = (button, event) => {
  const document = button.ownerDocument;
  pendingClicks.get(document)?.();
  const {clientX:x,clientY:y}=event;
  let timer;
  const clear=()=>{clearTimeout(timer);document.removeEventListener('click',click,true);document.removeEventListener('pointerdown',clear,true);pendingClicks.delete(document);};
  const click=e=>{
    // Keyboard and button.click() have detail=0. A new physical press clears
    // the guard before its click, so rapid intentional mouse/pen taps still work.
    if(e.detail===0 || Math.hypot(e.clientX-x,e.clientY-y)>12)return;
    e.preventDefault();e.stopImmediatePropagation();clear();
  };
  document.addEventListener('click',click,true);
  document.addEventListener('pointerdown',clear,true);
  timer=setTimeout(clear,500);pendingClicks.set(document,clear);
};
// Activate completed pen taps without relying on Windows compatibility clicks.
export const usePenButtonTap = () => {
  const press = useRef(null);
  const buttonAt = event => event.target.closest?.('button');
  return {
    onPointerDownCapture(event) {
      if (event.pointerType !== 'pen' || event.button !== 0) return;
      const button = buttonAt(event);
      press.current = button && !button.disabled ? { button, id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    },
    onPointerMoveCapture(event) {
      const start = press.current;
      if (start?.id === event.pointerId && Math.hypot(event.clientX-start.x,event.clientY-start.y)>12) start.cancelled=true;
    },
    onPointerUpCapture(event) {
      const start = press.current;
      if (!start || start.id !== event.pointerId) return;
      press.current = null;
      const r = start.button.getBoundingClientRect();
      event.preventDefault();
      guardCompatibilityClick(start.button,event);
      if (start.cancelled || !start.button.isConnected || start.button.disabled || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12 ||
          event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) return;
      start.button.click();
    },
    onPointerCancelCapture() { press.current = null; },
    // Pen hover can leave a toolbar/modal before contact-up on Windows. Only
    // cancel, movement and the actual release position decide whether it is a tap.
  };
};
