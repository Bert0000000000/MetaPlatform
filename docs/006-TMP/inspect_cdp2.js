const http = require('http');

const CDP = 'http://localhost:9222';
const urls = [
  ['SUPERAI', 'http://localhost:9301'],
  ['SUPERAI-login', 'http://localhost:9301/login'],
  ['APPHUB', 'http://localhost:9201'],
  ['APPHUB-login', 'http://localhost:9201/login'],
  ['ONTSTUDIO', 'http://localhost:9101'],
  ['ONTSTUDIO-login', 'http://localhost:9101/login'],
  ['DW', 'http://localhost:9401'],
  ['MCPHUB', 'http://localhost:9501'],
];

function fetchJson(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    }).on('error', reject);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function inspect(name, url) {
  const newPage = await fetchJson(`${CDP}/json/new?${encodeURIComponent(url)}`, 'PUT');
  const wsUrl = newPage.webSocketDebuggerUrl;
  if (!wsUrl) throw new Error('no ws url');
  const ws = new WebSocket(wsUrl);
  const logs = [];
  let id = 0;
  const pending = new Map();
  let openedResolve;
  const opened = new Promise(r => openedResolve = r);
  function send(method, params) {
    return new Promise((resolve, reject) => {
      const msg = { id: ++id, method, params };
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify(msg));
    });
  }
  ws.onopen = openedResolve;
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = (msg.params.args || []).map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      logs.push(`console.${msg.params.type}: ${args}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const e = msg.params.exceptionDetails;
      logs.push(`EXCEPTION: ${e.text} ${e.exception?.description || ''}`);
    }
    if (msg.method === 'Log.entryAdded') {
      logs.push(`LOG.${msg.params.entry.level}: ${msg.params.entry.text}`);
    }
  };
  await opened;
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Page.navigate', { url });
  await sleep(4000);
  const evalResult = await send('Runtime.evaluate', {
    expression: `JSON.stringify({title: document.title, rootLen: document.getElementById('root')?.innerHTML.length||0, rootHTML: document.getElementById('root')?.innerHTML.slice(0,500)||'', bodyText: document.body.innerText.slice(0,200)})`,
    returnByValue: true
  });
  const info = evalResult.result.value ? JSON.parse(evalResult.result.value) : {};
  console.log(`\n=== ${name} (${url}) ===`);
  console.log(JSON.stringify(info, null, 2));
  console.log('Logs:');
  logs.forEach(l => console.log('  ', l));
  ws.close();
  await fetchJson(`${CDP}/json/close/${newPage.id}`);
}

(async () => {
  for (const [name, url] of urls) {
    try { await inspect(name, url); } catch (e) { console.error('FAIL', name, e.message); }
  }
  process.exit(0);
})();
