/* ---------- imágenes: reducir y pasar a base64 para la IA ---------- */
const IMG_MAX_SIDE=1600,IMG_QUALITY=0.85,PDF_MAX_BYTES=4.5*1024*1024;
// Devuelve {media_type, data(base64 sin prefijo), kind:'image'|'pdf', previewUrl}
async function fileToAiPayload(file){
  if(file.type==='application/pdf'){
    if(file.size>PDF_MAX_BYTES)throw new Error('El PDF pesa más de 4,5 MB');
    const b64=await blobToBase64(file);return{media_type:'application/pdf',data:b64,kind:'pdf',previewUrl:null};}
  if(!/^image\//.test(file.type))throw new Error('Formato no soportado: '+(file.type||'desconocido'));
  const bmp=await loadImage(file);
  const scale=Math.min(1,IMG_MAX_SIDE/Math.max(bmp.width,bmp.height));
  const w=Math.round(bmp.width*scale),h=Math.round(bmp.height*scale);
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;
  cv.getContext('2d').drawImage(bmp,0,0,w,h);
  const blob=await new Promise(res=>cv.toBlob(res,'image/jpeg',IMG_QUALITY));
  const b64=await blobToBase64(blob);
  return{media_type:'image/jpeg',data:b64,kind:'image',previewUrl:URL.createObjectURL(blob)};
}
function blobToBase64(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=()=>rej(new Error('No se pudo leer el archivo'));r.readAsDataURL(blob);});}
function loadImage(file){
  if('createImageBitmap' in window)return createImageBitmap(file,{imageOrientation:'from-image'}).catch(()=>loadImageEl(file));
  return loadImageEl(file);}
function loadImageEl(file){return new Promise((res,rej)=>{const url=URL.createObjectURL(file);const im=new Image();im.onload=()=>{URL.revokeObjectURL(url);res(im);};im.onerror=()=>rej(new Error('Imagen inválida'));im.src=url;});}
