import 'dotenv/config';
import { resolve } from 'node:path';

export const config = {
  port: Number(process.env.PORT || 3000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || '/api',
  frontendDist: process.env.FRONTEND_DIST,
  corsOrigins: (
    process.env.CORS_ORIGIN ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  cookieSameSite: (process.env.COOKIE_SAME_SITE || 'lax') as
    'lax' | 'strict' | 'none',
  cookieSecure:
    process.env.COOKIE_SECURE === 'true' ||
    (process.env.FRONTEND_URL || '').startsWith('https://'),
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
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:'))
    throw new Error(
      'DATABASE_URL must be a SQLite file URL (file:./data/onlycats.db)',
    );
  new URL(config.frontendUrl);
  for (const origin of config.corsOrigins) {
    const parsed = new URL(origin);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin
    )
      throw new Error(
        'CORS_ORIGIN must contain comma-separated HTTP(S) origins without paths',
      );
  }
  if (config.apiUrl !== '/api') {
    const apiUrl = new URL(config.apiUrl);
    if (
      !['http:', 'https:'].includes(apiUrl.protocol) ||
      apiUrl.search ||
      apiUrl.hash
    )
      throw new Error(
        'API_URL must be /api or an absolute HTTP(S) API base URL',
      );
  }
  if (!['lax', 'strict', 'none'].includes(config.cookieSameSite))
    throw new Error('COOKIE_SAME_SITE must be lax, strict or none');
  if (config.cookieSameSite === 'none' && !config.cookieSecure)
    throw new Error(
      'COOKIE_SAME_SITE=none requires COOKIE_SECURE=true and HTTPS',
    );
}
