import mongoose from 'mongoose';
import { env } from './env.js';

let connectionPromise = null;

export async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  if (!connectionPromise) {
    mongoose.set('strictQuery', true);
    connectionPromise = mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
      .then(() => {
        console.log(`MongoDB connected: ${mongoose.connection.name}`);
      })
      .catch((err) => {
        connectionPromise = null;
        throw err;
      });
  }
  await connectionPromise;
}
