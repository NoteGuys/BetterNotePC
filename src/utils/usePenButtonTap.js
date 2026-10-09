import { useRef } from 'react';
// Activate completed pen taps without relying on Windows compatibility clicks.
export const usePenButtonTap = () => {
  const press = useRef(null), activated = useRef(null);
  const buttonAt = event => event.target.closest?.('button');
  return {
    onPointerDownCapture(event) {
      if (event.pointerType !== 'pen' || event.button !== 0) return;
      const button = buttonAt(event);
      press.current = button && !button.disabled ? { button, id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    },
    onPointerMoveCapture(event) {
      const start = press.current;
      if (start?.id === event.pointerId && Math.hypot(event.clientX-start.x,event.clientY-start.y)>12) press.current=null;
    },
    onPointerUpCapture(event) {
      const start = press.current;
      if (!start || start.id !== event.pointerId) return;
      press.current = null;
      const r = start.button.getBoundingClientRect();
      if (!start.button.isConnected || start.button.disabled || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12 ||
          event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) return;
      event.preventDefault();
      activated.current = { button: start.button, time: performance.now() };
      start.button.click();
    },
    onPointerCancelCapture() { press.current = null; },
    onPointerLeave() { press.current = null; },
    onClickCapture(event) {
      const last = activated.current;
      if (event.isTrusted && last && buttonAt(event) === last.button && performance.now() - last.time < 500 && event.detail !== 0) {
        event.preventDefault(); event.stopPropagation(); activated.current = null;
      }
    }
  };
};
