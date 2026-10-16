(function(S){
  'use strict';
  async function image(file){
    if(!file||file.size>15*1024*1024)throw new Error('image-byte-limit');
    const bytes=new Uint8Array(await file.arrayBuffer()),v=new DataView(bytes.buffer);let width,height,type;
    if(bytes.length>24&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x)){type='image/png';width=v.getUint32(16);height=v.getUint32(20);}
    else if(bytes[0]===255&&bytes[1]===216){type='image/jpeg';let i=2;while(i<bytes.length-9){if(bytes[i]!==255){i++;continue;}const marker=bytes[i+1];if(marker===218||marker===217)break;if(marker===216||marker===1||(marker>=208&&marker<=215)){i+=2;continue;}const length=v.getUint16(i+2);if(length<2||i+2+length>bytes.length)throw new Error('invalid-jpeg');if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){height=v.getUint16(i+5);width=v.getUint16(i+7);break;}i+=length+2;}}
    if(!type||file.type&&file.type!==type)throw new Error('unsupported-image');
    if(!width||!height||width>10000||height>10000||width*height>25000000)throw new Error('image-pixel-limit');
    const blob=new Blob([bytes],{type}),bitmap=await createImageBitmap(blob);
    if(bitmap.width*bitmap.height>25000000){bitmap.close();throw new Error('image-pixel-limit');}bitmap.close();return blob;
  }
  S.images={image};
})(window.Sutro);
