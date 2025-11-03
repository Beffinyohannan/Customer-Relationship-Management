import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(helmet());
app.use(rateLimit({ windowMs: 60_000, max: 300 }));
app.options('*', cors({ origin: FRONTEND_ORIGIN, credentials: true }));

const PUBLIC_ROUTES = (process.env.PUBLIC_ROUTES || '').split(',').filter(Boolean);

function parseCookies(req) {
  const cookie = req.headers.cookie || '';
  const out = {};
  cookie.split(';').forEach((v) => {
    const [k, ...rest] = v.trim().split('=');
    if (!k) return;
    out[k] = rest.join('=');
  });
  return out;
}

function authGate(req, res, next) {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      if (req.headers['access-control-request-headers']) res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers']);
      if (req.headers['access-control-request-method']) res.setHeader('Access-Control-Allow-Methods', req.headers['access-control-request-method']);
      const vary = res.getHeader('Vary');
      res.setHeader('Vary', vary ? vary + ', Origin' : 'Origin');
    }
    return res.status(204).end();
  }
  const url = req.originalUrl || req.url || '';
  // console.log("url", url);
  const isPublic = PUBLIC_ROUTES.some((r) => url.startsWith(r));
  // console.log("isPublic", isPublic);
  if (isPublic) return next();
  const cookies = parseCookies(req);
  const accessToken = cookies.accessToken;
  if (!accessToken) return res.status(401).json({ message: 'Unauthorized' });
  try {
    jwt.verify(accessToken, process.env.JWT_SECRET);
    // CSRF for mutating methods
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const csrfHeader = req.headers['x-csrf-token'];
      const csrfCookie = cookies.csrfToken;
      if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
        return res.status(403).json({ message: 'CSRF validation failed' });
      }
    }
    req.headers.authorization = `Bearer ${accessToken}`;
    return next();
  } catch (error){
    console.log("error", error);
    
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function jsonProxy(target, rewrite) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: rewrite,
    logLevel: 'debug',
    onProxyReq(proxyReq, req, res) {
      try {
        console.log('proxying', req.method, req.originalUrl, '->', target + (proxyReq.path || ''));
      } catch {}
    },
    onProxyRes(proxyRes, req, res) {
      try {
        console.log('proxied', req.method, req.originalUrl, 'status', proxyRes.statusCode);
      } catch {}
      // Normalize CORS on responses to allow credentials from the requesting origin
      const origin = req.headers.origin;
      if (origin) {
        // Remove any wildcard CORS headers from upstream to avoid conflicts with credentials
        delete proxyRes.headers['access-control-allow-origin'];
        delete proxyRes.headers['Access-Control-Allow-Origin'];
        delete proxyRes.headers['access-control-allow-credentials'];
        delete proxyRes.headers['Access-Control-Allow-Credentials'];
        // Reflect the requesting origin and allow credentials on both proxy and outgoing response
        proxyRes.headers['access-control-allow-origin'] = origin;
        proxyRes.headers['access-control-allow-credentials'] = 'true';
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        // reflect requested headers if present
        if (req.headers['access-control-request-headers']) {
          proxyRes.headers['access-control-allow-headers'] = req.headers['access-control-request-headers'];
        }
        if (req.headers['access-control-request-method']) {
          proxyRes.headers['access-control-allow-methods'] = req.headers['access-control-request-method'];
        }
        // ensure caches vary on Origin
        const vary = proxyRes.headers['vary'];
        proxyRes.headers['vary'] = vary ? vary + ', Origin' : 'Origin';
        const varyRes = res.getHeader('Vary');
        res.setHeader('Vary', varyRes ? varyRes + ', Origin' : 'Origin');
      }
    },
  });
}

app.use('/auth', authGate, jsonProxy(process.env.AUTH_SERVICE_URL, { '^/auth': '' }));
app.use('/leads', authGate, jsonProxy(process.env.LEAD_SERVICE_URL, { '^/leads': '' }));
app.use('/notifications', authGate, jsonProxy(process.env.NOTIF_SERVICE_URL));

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const port = process.env.PORT || 8090;
app.listen(port, () => console.log(`Gateway on :${port}`));
