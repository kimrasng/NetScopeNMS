import http from 'node:http';
const server=http.createServer(async (request,response)=>{
  let raw=''; for await (const chunk of request) raw+=chunk;
  if (request.url==='/logo.svg') {response.setHeader('Content-Type','image/svg+xml');response.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="#0972d3"/><text x="20" y="26" text-anchor="middle" fill="white" font-size="20">QA</text></svg>');return;}
  response.setHeader('Content-Type','application/json');
  if (request.url==='/webhook-fail') {response.writeHead(503);response.end('{"error":"QA receiver rejected delivery"}');return;}
  if (request.url==='/webhook-ok') {response.end('{}');return;}
  const body=JSON.parse(raw||'{}'); const system=body.messages?.find(message=>message.role==='system')?.content??'';
  const content=system.includes('database expert')?JSON.stringify({type:'sql',sql:'SELECT id, name, status FROM devices ORDER BY name',explanation:'QA deterministic query'}):system.includes('root cause analysis')?JSON.stringify({rootCause:'QA simulated CPU load',confidence:95,affectedScope:['QA Router A'],remediation:['Inspect load'],urgency:'high',summary:'QA RCA from local provider'}):'OK QA local response';
  response.end(JSON.stringify({choices:[{message:{content}}]}));
});
server.listen(14567,'127.0.0.1',()=>console.log('QA mock AI/webhook service listening on 127.0.0.1:14567'));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
