import { mongoose } from '../shared/index.js';

const notificationSchema = new mongoose.Schema(
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
);

notificationSchema.index({ 'recipients.userId': 1, createdAt: -1 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;
