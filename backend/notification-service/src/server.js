import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { connectMongo, authMiddleware, mongoose } from './shared/index.js';
import Notification from './models/Notification.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const connection = new IORedis(process.env.REDIS_URL , {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
const notifQueue = new Queue('notifications', { connection });

app.post('/notify', async (req, res) => {
  // console.log("req", req.body);
  const { type = 'lead_event', to = 'user@example.com', payload = {} } = req.body;
  await notifQueue.add('send', { type, to, payload }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
  res.status(202).json({ queued: true });
});

app.get('/notifications/health', (_req, res) => res.json({ status: 'ok' }));

// In-app notifications APIs (recipients array aware)
app.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const docs = await Notification.find({ 'recipients.userId': userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const items = (docs || []).map((d) => {
      const rec = (d.recipients || []).find((r) => String(r.userId) === String(userId));
      return {
        _id: d._id,
        title: d.title,
        body: d.body,
        data: d.data,
        createdAt: d.createdAt,
        read: !!rec?.readAt,
      };
    });
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.post('/:id/read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.sub;
    const { id } = req.params;
    const now = new Date();
    const result = await Notification.updateOne(
      { _id: id, 'recipients.userId': userId },
      { $set: { 'recipients.$.readAt': now } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Bulk mark-all-read for current user
app.post('/read-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const now = new Date();
    const result = await Notification.updateMany(
      { 'recipients.userId': userId, 'recipients.readAt': { $exists: false } },
      { $set: { 'recipients.$[elem].readAt': now } },
      { arrayFilters: [{ 'elem.userId': new mongoose.Types.ObjectId(userId), 'elem.readAt': { $exists: false } }] }
    );
    res.json({ ok: true, modified: result.modifiedCount || 0 });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const port = process.env.PORT || 5003;
connectMongo().then(() => app.listen(port, () => console.log(`Notification on :${port}`)));
