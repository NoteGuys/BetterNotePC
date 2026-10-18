import React, { cloneElement, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// The marker retains the trigger's layout position; the menu escapes clipping
// ancestors. Only open menus observe layout, and scroll/resize share one frame.
export const ViewportPopover = ({ children, onDismiss, align = 'start' }) => {
  const marker = useRef(null), menu = useRef(null), dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useLayoutEffect(() => {
    const anchor=marker.current?.parentElement, element=menu.current;
    if(!anchor || !element)return;
    const document=anchor.ownerDocument, window=document.defaultView, viewport=window.visualViewport;
    let frame=0;
    const position=()=>{
      frame=0;
      if(!anchor.isConnected)return;
      const edge=8,gap=8,left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0;
      const width=viewport?.width||window.innerWidth,height=viewport?.height||window.innerHeight;
      Object.assign(element.style,{maxWidth:Math.max(0,width-edge*2)+'px',maxHeight:Math.max(0,height-edge*2)+'px'});
      const r=anchor.getBoundingClientRect(),box=element.getBoundingClientRect();
      const below=top+height-edge-r.bottom-gap,above=r.top-top-edge-gap;
      const up=box.height>below && above>below;
      const available=Math.max(0,up?above:below);
      // A trigger moved outside the viewport still yields a visible, scrollable menu.
      const visibleHeight=Math.min(box.height,Math.max(44,available),height-edge*2);
      const preferred=align==='end'?r.right-box.width:align==='center'?r.left+(r.width-box.width)/2:r.left;
      const x=Math.max(left+edge,Math.min(preferred,left+width-edge-box.width));
      const y=Math.max(top+edge,Math.min(up?r.top-gap-visibleHeight:r.bottom+gap,top+height-edge-visibleHeight));
      Object.assign(element.style,{left:x+'px',top:y+'px',maxHeight:visibleHeight+'px',visibility:'visible'});
      element.dataset.placement=up?'top':'bottom';
    };
    const schedule=()=>{if(!frame)frame=window.requestAnimationFrame(position);};
    const outside=event=>{if(!element.contains(event.target)&&!anchor.contains(event.target))dismiss.current?.();};
    const escape=event=>{if(event.key==='Escape'){event.stopPropagation();dismiss.current?.();anchor.querySelector('button')?.focus({preventScroll:true});}};
    const observer=new ResizeObserver(schedule);observer.observe(anchor);observer.observe(element);
    position();document.addEventListener('scroll',schedule,true);document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape);
    window.addEventListener('resize',schedule);viewport?.addEventListener('resize',schedule);viewport?.addEventListener('scroll',schedule);
    return()=>{observer.disconnect();if(frame)window.cancelAnimationFrame(frame);document.removeEventListener('scroll',schedule,true);document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape);window.removeEventListener('resize',schedule);viewport?.removeEventListener('resize',schedule);viewport?.removeEventListener('scroll',schedule);};
  },[align]);
  const originalRef=children.ref;
  return <><span ref={marker} hidden />{createPortal(cloneElement(children,{
    ref:node=>{menu.current=node;if(typeof originalRef==='function')originalRef(node);else if(originalRef)originalRef.current=node;},
    className:(children.props.className||'')+' bn-viewport-popover',
    style:children.props.style,
  }),document.body)}</>;
};
