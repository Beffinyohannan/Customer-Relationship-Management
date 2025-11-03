import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectMongo, hashPassword, comparePassword, signAccessToken, roles, authMiddleware, requireRole, mongoose } from './shared/index.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from './models/User.js';

dotenv.config();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

function signRefreshToken(payload) {
  const secret = process.env.JWT_SECRET || 'dev_secret';
  const expiresIn = process.env.REFRESH_TOKEN_EXPIRES || '7d';
  return jwt.sign({ ...payload, tokenType: 'refresh' }, secret, { expiresIn });
}

app.post('/register', async (req, res) => {
  const { email, password, name, role } = req.body;
  // console.log("req",req.body);
  if (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connection.asPromise();
    } catch {
      return res.status(503).json({ message: 'db not connected' });
    }
  }
  if (!email || !password) return res.status(400).json({ message: 'email and password required' });
  try {
    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(409).json({ message: 'User with this email already exists' });
    const newUser = new User({
      name,
      email,
      password: hashPassword(password),
      role: role || roles.sales,
    });
    const user = await newUser.save();
    // console.log('user',user);
    res.status(201).json({ id: user._id, email: user.email, role: user.role, name: user.name });
  } catch (err) {
    console.log('err',err);
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }
    res.status(400).json({ message: 'registration failed', error: err.message });
  }
});

app.get('/users', authMiddleware, requireRole(roles.admin, roles.manager), async (_req, res) => {
  const users = await User.find({}).select('name email role');
  res.json({ items: users });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connection.asPromise();
    } catch {
      return res.status(503).json({ message: 'db not connected' });
    }
  }
  // console.log("email", email);
  // console.log("password", password);
  const user = await User.findOne({ email });
  // console.log("user", user);
  if (!user) return res.status(401).json({ message: 'invalid credentials' });
  if (!comparePassword(password, user.password)) return res.status(401).json({ message: 'invalid credentials' });
  const token = signAccessToken({ sub: String(user._id), role: user.role, email: user.email, name: user.name });
  const refreshToken = signRefreshToken({ sub: String(user._id), role: user.role, email: user.email, name: user.name });
  const csrfToken = crypto.randomBytes(16).toString('hex');
  // console.log("ref",refreshToken);
  
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('csrfToken', csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ user: { id: user._id, email: user.email, role: user.role, name: user.name } });
});

app.get('/me', async (req, res) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
  const token = header.slice(7);
  try {
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const user = await User.findById(decoded.sub).select('-password');
    if (!user) return res.status(404).json({ message: 'not found' });
    res.json({ user });
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Exchange a refreshToken for a new accessToken
app.post('/refresh', async (req, res) => {
  const cookie = req.headers.cookie || '';
  const tokenPair = Object.fromEntries(cookie.split(';').map(v => v.trim().split('=')));
  const refreshToken = tokenPair.refreshToken;
  if (!refreshToken) return res.status(400).json({ message: 'refreshToken required' });
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (decoded.tokenType !== 'refresh') return res.status(401).json({ message: 'invalid token' });
    const user = await User.findById(decoded.sub);
    if (!user) return res.status(401).json({ message: 'invalid token' });
    const accessToken = signAccessToken({ sub: String(user._id), role: user.role, email: user.email, name: user.name });
    const csrfToken = crypto.randomBytes(16).toString('hex');
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('csrfToken', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(401).json({ message: 'invalid token' });
  }
});

// Logout (stateless) - client should clear tokens
app.post('/logout', (_req, res) => {
  res.clearCookie('refreshToken', { path: '/auth' });
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('csrfToken', { path: '/' });
  res.json({ ok: true });
});

const port = process.env.PORT || 5001;
connectMongo().then(() => app.listen(port, () => console.log(`Auth on :${port}`)));
