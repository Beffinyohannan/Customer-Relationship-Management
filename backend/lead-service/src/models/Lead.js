import { mongoose } from '../shared/index.js';

const leadSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    phone: String,
    status: { type: String, default: 'new' },
    ownerId: { type: String },
    ownerName: { type: String },
    assignedTo: { type: String },
  },
  { timestamps: true, bufferCommands: false }
);

leadSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });

const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
export default Lead;
