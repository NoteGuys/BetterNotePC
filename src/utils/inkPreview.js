import {renderStroke} from './inkingEngine.js';
// After 100 points, the 16-point taper is fixed. Bake only that stable prefix
// into the existing static layer: no fourth canvas and no discarded raw points.
export const createInkPreview = restoreCommitted => {
 let points=null,style=null,end=1,baked=false;
 const reset=()=>{if(baked)restoreCommitted();points=null;style=null;end=1;baked=false;};
 const draw=(committed,active,stroke)=>{
  const nextStyle=[stroke.tool,stroke.color,stroke.width,stroke.nibType,stroke.shapeType,stroke.isTapered,stroke.usePressure,stroke.pressureSensitivity];
  if(points && (points!==stroke.points||nextStyle.some((value,index)=>value!==style[index])||stroke.points.length<=end))reset();
  const n=stroke.points.length;
  if(stroke.tool!=='pen'||stroke.shapeType||stroke.nibType==='brush'||stroke.usePressure===false||!/^#[a-f0-9]{6}$/i.test(stroke.color)||n<100){renderStroke(active,stroke);return;}
  points=stroke.points;style=nextStyle;
  const stableEnd=n-16;
  if(stableEnd>end){renderStroke(committed,stroke,{start:end,end:stableEnd,leader:!baked,tail:false});baked=true;end=stableEnd;}
  renderStroke(active,stroke,{start:end,end:n-1,leader:false,tail:true});
 };
 return {draw,reset,get baked(){return baked;}};
};

