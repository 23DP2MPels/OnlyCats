import 'dotenv/config';
import { resolve } from 'node:path';

export const config = {
  port: Number(process.env.PORT || 3000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || '',
  uploadDir: resolve(process.env.UPLOAD_DIR || './uploads'),
  paypal: {
    baseUrl: 'https://api-m.sandbox.paypal.com',
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    planId: process.env.PAYPAL_PLAN_ID || '',
    webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
  },
};

export function validateConfig() {
  if (config.jwtSecret.length < 32)
    throw new Error('JWT_SECRET must contain at least 32 characters');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  new URL(config.frontendUrl);
}
