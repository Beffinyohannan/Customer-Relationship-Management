import dotenv from 'dotenv';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import nodemailer from 'nodemailer';
import { connectMongo, mongoose, roles } from './shared/index.js';

dotenv.config();

const connection = new IORedis(process.env.REDIS_URL , {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const User = mongoose.models.User || mongoose.model(
  'User',
  new mongoose.Schema(
    {
      email: String,
      name: String,
      role: String,
    },
    { timestamps: true, bufferCommands: false }
  )
);

const Notification = mongoose.models.Notification || mongoose.model(
  'Notification',
  new mongoose.Schema(
    {
      title: String,
      body: String,
      data: Object,
      recipients: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, required: true },
          readAt: { type: Date },
        },
      ],
    },
    { timestamps: true, bufferCommands: false }
  ).index({ 'recipients.userId': 1, createdAt: -1 })
);

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_PORT) return null;
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT, 10),
      secure: SMTP_SECURE === 'true',
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
    return transporter;
  } catch (e) {
    console.error('[worker] email transport error', e.message);
    return null;
  }
}

async function sendEmailSafe(transporter, to, subject, text) {
  if (!transporter) {
    console.log('[worker] email skipped (no SMTP configured)', { to, subject });
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.MAIL_FROM || 'no-reply@example.com', to, subject, text });
  } catch (e) {
    console.error('[worker] email send error', e.message, { to, subject });
  }
}

async function notifyAdminsManagers({ title, body, data, alsoEmail = false, excludeUserId }) {
  const query = { role: { $in: [roles.admin, roles.manager] } };
  const users = await User.find(query).lean();
  const transporter = alsoEmail ? createTransport() : null;
  const recipients = [];
  for (const u of users) {
    if (excludeUserId && String(u._id) === String(excludeUserId)) continue;
    recipients.push({ userId: u._id });
    if (alsoEmail && u.email) {
      await sendEmailSafe(transporter, u.email, title, body);
    }
  }
  if (recipients.length) {
    await Notification.create({ title, body, data, recipients });
  }
}

async function handleLeadCreated(payload) {
  const { id, name, email, ownerId, ownerName } = payload || {};
  const title = 'New lead created';
  const body = `${ownerName || 'Someone'} created lead ${name || id}`;
  await notifyAdminsManagers({ title, body, data: { id, name, email, ownerId, event: 'lead_created' }, alsoEmail: true, excludeUserId: ownerId });

  const transporter = createTransport();
  if (email) await sendEmailSafe(transporter, email, 'You have been created as a lead ', `You have been created as a lead by ${ownerName}.`);
}

async function handleLeadAssigned(payload) {
  const { id, name, email, assignedTo, assignerId, assignerName } = payload || {};
  let assigneeName = '';
  if (assignedTo) {
    const u = await User.findById(assignedTo).lean().catch(() => null);
    assigneeName = u?.name || u?.email || String(assignedTo);
  }
  const title = 'Lead assigned';
  const body = `Lead ${name || id} assigned to ${assigneeName}`;

  await notifyAdminsManagers({ title, body, data: { id, name, email, assignedTo, assigneeName, assignerId, assignerName, event: 'lead_assigned' }, alsoEmail: true, excludeUserId: assignerId });
  
  const transporter = createTransport();
  if (email) await sendEmailSafe(transporter, email, 'You have been assigned ', `You have been assigned to ${assigneeName}.`);
}

async function routeJob({ type, to, payload }) {
  switch (type) {
    case 'lead_created':
      return handleLeadCreated(payload);
    case 'lead_assigned':
      return handleLeadAssigned(payload);
    default:
      // Generic fallback: just log and optionally email `to`
      const transporter = createTransport();
      if (to) await sendEmailSafe(transporter, to, `Notification: ${type}`, JSON.stringify(payload));
  }
}

await connectMongo();

const worker = new Worker(
  'notifications',
  async (job) => {
    const { type, to, payload } = job.data || {};
    console.log(`[worker] processing`, { id: job.id, data: job.data, type });
    await routeJob({ type, to, payload });
  },
  { connection }
);

worker.on('completed', (job) => console.log(`[worker] completed`, job.id));
worker.on('failed', (job, err) => console.error(`[worker] failed`, job?.id, err?.message));
