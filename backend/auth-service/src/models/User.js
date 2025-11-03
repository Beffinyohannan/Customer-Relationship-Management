import { mongoose, roles } from 'shared/src/index.js';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true },
    password: String,
    name: String,
    role: { type: String, enum: Object.values(roles), default: roles.sales },
  },
  { timestamps: true, bufferCommands: false }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
