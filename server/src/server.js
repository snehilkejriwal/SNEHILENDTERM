import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';

const app = createApp();

// Start standalone HTTP listener if not running within a Vercel serverless environment
if (!process.env.VERCEL) {
  connectDB()
    .then(() => {
      app.listen(env.PORT, () => console.log(`SettleWise API listening on port ${env.PORT}`));
    })
    .catch((err) => {
      console.error('Failed to start server:', err.message);
      process.exit(1);
    });
} else {
  // In Vercel, initiate the DB connection immediately on cold start
  connectDB().catch((err) => {
    console.error('Initial DB connection warning:', err.message);
  });
}

export default app;
