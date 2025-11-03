import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Redis from 'ioredis';
import { connectMongo, authMiddleware, requireRole, roles, mongoose } from './shared/index.js';
import Lead from './models/Lead.js';

dotenv.config();

const app = express();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL );


function cacheKey(query) {
  return `leads:${JSON.stringify(query || {})}`;
}

app.get('/', authMiddleware, async (req, res) => {
  // console.log("request in lead", req.user);
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '10', 10);
  const skip = (page - 1) * limit;
  const key = cacheKey({ page, limit });
  const cached = await redis.get(key);
  if (cached) return res.json(JSON.parse(cached));
  const [items, total] = await Promise.all([
    Lead.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Lead.countDocuments({}),
  ]);
  const payload = { items, total, page, limit };
  await redis.set(key, JSON.stringify(payload), 'EX', 60);
  res.json(payload);
});



app.post('/create', authMiddleware, async (req, res) => {
  // console.log("req", req.body);
  // console.log("req.user", req.user);
  if (mongoose.connection.readyState !== 1) {
    try { await mongoose.connection.asPromise(); } catch { return res.status(503).json({ message: 'db not connected' }); }
  }
  try {
    if (req.body?.email) {
      const exists = await Lead.findOne({ email: req.body.email }).lean();
      if (exists) return res.status(409).json({ message: 'Lead with this email already exists' });
    }
    const leadDoc = new Lead({
      ...req.body,
      ownerId: req.user?.sub,
      ownerName: req.user?.name  || 'Unknown'
    });
    const lead = await leadDoc.save();
  await redis.keys('leads:*').then(keys => keys.length && redis.del(keys));
  try {
    await fetch((process.env.NOTIF_URL) + '/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'lead_created', payload: { id: String(lead._id), name: lead.name, email: lead.email, ownerId: req.user?.sub, ownerName: req.user?.name || 'Unknown' } })
    });
  } catch {}
  res.status(201).json(lead);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'Lead with this email already exists' });
    }
    return res.status(400).json({ message: 'Failed to create lead', error: err?.message });
  }
});

app.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.body?.email) {
      const exists = await Lead.findOne({ email: req.body.email, _id: { $ne: id } }).lean();
      if (exists) return res.status(409).json({ message: 'Lead with this email already exists' });
    }
    const lead = await Lead.findByIdAndUpdate(id, req.body, { new: true });
    await redis.keys('leads:*').then(keys => keys.length && redis.del(keys));
    res.json(lead);
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ message: 'Lead with this email already exists' });
    res.status(400).json({ message: 'Failed to update lead', error: err?.message });
  }
});

app.post('/:id/assign', authMiddleware, requireRole(roles.admin, roles.manager), async (req, res) => {
  const { assignedTo } = req.body;
  const lead = await Lead.findByIdAndUpdate(req.params.id, { assignedTo }, { new: true });
  await redis.keys('leads:*').then(keys => keys.length && redis.del(keys));
  try {
    await fetch((process.env.NOTIF_URL ) + '/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'lead_assigned',
        payload: {
          id: String(lead._id),
          name: lead.name,
          email: lead.email,
          assignedTo,
          assignerId: req.user?.sub,
          assignerName: req.user?.name || 'Unknown'
        }
      })
    });
  } catch {}
  res.json(lead);
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));


const port = process.env.PORT || 5002;
connectMongo().then(() => app.listen(port, () => console.log(`Lead on :${port}`)));
