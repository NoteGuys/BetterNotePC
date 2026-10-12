const configureGpuProfile=(app,{packaged=app.isPackaged,profile=process.env.BETTERNOTE_GPU_PROFILE}={})=>{
 const selected=!packaged&&profile==='default'?'default':'legacy';
 if(selected==='legacy')for(const [name,value]of [['enable-features','TouchEvents,VaapiVideoDecoder'],['ignore-gpu-blocklist'],['enable-gpu-rasterization'],['enable-zero-copy'],['high-dpi-support','1']])app.commandLine.appendSwitch(name,value);
 return selected;
};
module.exports={configureGpuProfile};
