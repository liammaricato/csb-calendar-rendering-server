// csb-render: takes the calendar JSON and returns the art as a PNG.
//
//   POST /render  (body: calendar JSON)  ->  image/png
//   GET  /health                         ->  "ok"
//
// Reachable only through the n8n Docker network (no published port).
// Invalid data comes back as HTTP 422 with the list of errors in "details".

const http = require('http');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { validate } = require('./validate');

const PORT = 3000;
const TOKEN = process.env.RENDER_TOKEN || ''; // optional

// Template with the logo and font embedded, built once at startup.
const asset = (p) => fs.readFileSync(`${__dirname}/${p}`).toString('base64');
const TEMPLATE = fs.readFileSync(`${__dirname}/template.html`, 'utf8')
  .replace('./fonts/Montserrat.ttf', `data:font/ttf;base64,${asset('fonts/Montserrat.ttf')}`)
  .replace('./assets/logo-csb.jpg', `data:image/jpeg;base64,${asset('assets/logo-csb.jpg')}`);

async function render(data) {
  // Escaping "<" keeps a text from closing the <script> tag.
  const injection = `<script>window.CSB_DATA = ${JSON.stringify(data).replace(/</g, '\\u003c')};</script>`;
  const html = TEMPLATE.replace('<!--CSB_DATA-->', injection);

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForFunction('window.CSB_READY === true', { timeout: 15000 });
    return await (await page.$('#art')).screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 100_000) { reject(new Error('body too large')); req.destroy(); }
    });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('invalid JSON')); } });
  });
}

function fail(res, status, message, details) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(details ? { error: message, details } : { error: message }));
}

http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return res.end('ok');
  if (req.method !== 'POST' || req.url !== '/render') return fail(res, 404, 'not found');
  if (TOKEN && req.headers['x-api-key'] !== TOKEN) return fail(res, 401, 'invalid x-api-key');

  try {
    let input;
    try { input = await readJson(req); } catch (e) { return fail(res, 400, e.message); }
    const v = validate(input);
    if (!v.ok) return fail(res, 422, 'invalid data', v.errors);
    const png = await render(v.data);
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end(png);
  } catch (e) {
    console.error(e);
    fail(res, 500, String(e.message || e));
  }
}).listen(PORT, () => console.log(`csb-render listening on port ${PORT}`));
