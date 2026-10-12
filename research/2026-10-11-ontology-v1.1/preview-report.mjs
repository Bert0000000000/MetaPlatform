import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const server=http.createServer(async (request,response)=>{
 const pathname=new URL(request.url,'http://127.0.0.1').pathname;
 if(pathname!=='/'&&pathname!=='/report'){response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('Not found');return;}
 try{const content=await fs.readFile(path.join(root,'metaplatform-v1.1-research.html'));response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(content)}catch{response.writeHead(500);response.end('Report unavailable')}
});
server.listen(9361,'127.0.0.1',()=>console.log('REPORT_READY http://127.0.0.1:9361/'));
