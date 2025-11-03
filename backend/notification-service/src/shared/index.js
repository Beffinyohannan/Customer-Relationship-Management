import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import winston from 'winston';

dotenv.config();

export const roles = {
  admin: 'admin',
  manager: 'manager',
  sales: 'sales',
};

export const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

export function signAccessToken(payload, expiresIn = process.env.JWT_EXPIRES_IN || '1d') {
  return jwt.sign(payload, process.env.JWT_SECRET , { expiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET );
}

export function hashPassword(password) {
  const salt = bcrypt.genSaltSync(parseInt(process.env.BCRYPT_COST || '10', 10));
  return bcrypt.hashSync(password, salt);
}

export function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export async function connectMongo(uri) {
  const url = uri || process.env.MONGO_URL ;
  mongoose.set('strictQuery', true);
  mongoose.set('bufferCommands', false);
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await mongoose.connect(url, {
        serverSelectionTimeoutMS: 20000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
      });
      logger.info(`Mongo connected: ${url}`);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      const backoff = Math.min(8000, 500 * Math.pow(2, attempt - 1));
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  if (lastErr) {
    logger.error(`Mongo connect error: ${lastErr.message}`);
    throw lastErr;
  }

  mongoose.connection.on('error', (err) => {
    logger.error(`Mongo connection error: ${err.message}`);
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('Mongo disconnected');
  });
}

export { mongoose };

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!allowed.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}
