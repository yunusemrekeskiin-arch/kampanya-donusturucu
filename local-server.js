import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import claudeHandler from './api/claude.js';
import openaiImageHandler from './api/openai-image.js';
import inpaintHandler from './api/inpaint.js';
import testKeyHandler from './api/test-key.js';

const root = process.cwd();
const port = Number(process.env.PORT || 3000);

function loadDotEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function createVercelResponse(res) {
  return {
    setHeader: (key, value) => res.setHeader(key, value),
    status(code) {
      res.statusCode = code;
      return this;
    },
    json(payload) {
      if (!res.hasHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.end(JSON.stringify(payload));
    },
    end(payload = '') {
      res.end(payload);
    }
  };
}

async function runNodeApi(handler, req, res) {
  const bodyBuffer = await readBody(req);
  req.body = bodyBuffer.length ? JSON.parse(bodyBuffer.toString('utf8')) : {};
  await handler(req, createVercelResponse(res));
}

async function runEdgeApi(handler, req, res) {
  const bodyBuffer = await readBody(req);
  const request = new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : bodyBuffer
  });
  const response = await handler(request);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${port}`);
  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const filePath = normalize(join(root, requested));

  if (!filePath.startsWith(root)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  try {
    const data = await readFile(filePath);
    res.setHeader('Content-Type', mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}

createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/claude')) return await runNodeApi(claudeHandler, req, res);
    if (req.url.startsWith('/api/openai-image')) return await runNodeApi(openaiImageHandler, req, res);
    if (req.url.startsWith('/api/test-key')) return await runNodeApi(testKeyHandler, req, res);
    if (req.url.startsWith('/api/inpaint')) return await runEdgeApi(inpaintHandler, req, res);
    return await serveStatic(req, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message }));
  }
}).listen(port, () => {
  console.log(`Insertmill local server: http://localhost:${port}`);
});
