import {mkdir,readFile,writeFile,cp,readdir} from 'node:fs/promises';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
import {extname} from 'node:path';
const assets={};
for(const file of await readdir('public')){
  const ext=extname(file);if(!types[ext])throw new Error('Unknown public asset '+file);
  const raw=await readFile('public/'+file);
  assets['/'+file]={body:raw.toString(ext==='.png'?'base64':'utf8'),type:types[ext],base64:ext==='.png'};
}
await mkdir('dist/server',{recursive:true});
await writeFile('dist/server/assets.generated.js','export const assets='+JSON.stringify(assets)+';\n');
for (const file of ['worker.js','auth.js','http.js','widget.js']) {
  const source=(await readFile('server/'+file,'utf8')).replaceAll("'../public/model.js'","'./model.js'").replaceAll("'../public/activity.js'","'./activity.js'");
  await writeFile('dist/server/'+(file==='worker.js'?'index.js':file),source);
}
await cp('public/model.js','dist/server/model.js');
await cp('public/activity.js','dist/server/activity.js');


console.log(`Built Ember with ${Object.keys(assets).length} assets and D1 migrations.`);
