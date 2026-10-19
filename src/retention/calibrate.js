const fs=require('node:fs/promises');const {compareImages}=require('./similarity');
async function main(){
  const [first,second,maskFile]=process.argv.slice(2);if(!first||!second)throw Error('Usage: npm run calibrate -- first.jpg second.jpg [masks.json]');
  const masks=maskFile?JSON.parse(await fs.readFile(maskFile,'utf8')):[];
  const [a,b]=await Promise.all([fs.readFile(first),fs.readFile(second)]);
  for(const sensitivity of ['low','medium','high'])console.log(JSON.stringify({sensitivity,...await compareImages(a,b,{masks,sensitivity})}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
