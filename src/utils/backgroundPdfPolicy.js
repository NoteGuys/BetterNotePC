// A thinking pause between strokes must not immediately start heavy PDF raster work.
export const BACKUP_PDF_IDLE_MS=15000;
export const canStartBackgroundPdf=({pointers=0,lastInput=0,now=Date.now(),saved=true,paused=false,hidden=false,automatic=true})=>
 !paused&&!hidden&&saved&&pointers===0&&now-lastInput>=(automatic?BACKUP_PDF_IDLE_MS:0);

