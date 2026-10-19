const sharp=require('sharp');const {error}=require('../errors');
function validateMasks(masks=[]) {
  if(!Array.isArray(masks)||masks.length>20)throw error('INVALID_MASK');
  for(const m of masks)if(![m.x,m.y,m.width,m.height].every(Number.isFinite)||m.x<0||m.y<0||m.width<=0||m.height<=0||m.x+m.width>1.000001||m.y+m.height>1.000001)throw error('INVALID_MASK');
  // Validate union coverage too, not just an individually full rectangle.
  let visible=0;for(let y=0;y<100;y++)for(let x=0;x<100;x++)if(!masks.some(m=>(x+.5)/100>=m.x&&(x+.5)/100<m.x+m.width&&(y+.5)/100>=m.y&&(y+.5)/100<m.y+m.height))visible++;
  if(visible<100)throw error('INVALID_MASK');return masks;
}
async function compareImages(a,b,{masks=[],sensitivity='medium'}={}) {
  validateMasks(masks);
  try{
    const ma=await sharp(a).metadata(),mb=await sharp(b).metadata();
    if(ma.width!==mb.width||ma.height!==mb.height)return{similar:false,changedRatio:null,reason:'RESOLUTION_CHANGED'};
    const width=Math.min(ma.width,320),height=Math.max(1,Math.round(ma.height*width/ma.width));
    // Fill excluded source pixels BEFORE resampling/blur, preventing clock edges from bleeding into visible pixels.
    async function normalized(input){
      const {data,info}=await sharp(input).greyscale().raw().toBuffer({resolveWithObject:true});
      for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(masks.some(m=>x/info.width>=m.x&&x/info.width<m.x+m.width&&y/info.height>=m.y&&y/info.height<m.y+m.height))data[y*info.width+x]=0;
      return sharp(data,{raw:{width:info.width,height:info.height,channels:1}}).resize(width,height).blur(.5).raw().toBuffer();
    }
    const [aa,bb]=await Promise.all([normalized(a),normalized(b)]);let count=0,changed=0;
    const threshold=sensitivity==='high'?12:sensitivity==='low'?30:20;
    const ratio=sensitivity==='high'?.002:sensitivity==='low'?.02:.005;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      if(masks.some(m=>x/width>=m.x&&x/width<m.x+m.width&&y/height>=m.y&&y/height<m.y+m.height))continue;
      count++;if(Math.abs(aa[y*width+x]-bb[y*width+x])>threshold)changed++;
    }
    return {similar:count>0&&changed/count<=ratio,changedRatio:count?changed/count:null};
  }catch{return {similar:false,changedRatio:null,reason:'ANALYSIS_FAILED'};}
}
module.exports={compareImages,validateMasks};
