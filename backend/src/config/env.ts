import dotenv from 'dotenv';

dotenv.config();

interface Env {
  NODE_ENV: string;
  PORT: number;
  MONGO_URI: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  CLIENT_URL: string;
  API_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  FACEBOOK_APP_ID: string;
  FACEBOOK_APP_SECRET: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV === 'test') return `test_${name}`;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const port = Number(process.env.PORT) || 5000;

function optional(name: string): string {
  return process.env.NODE_ENV === 'test' ? '' : process.env[name] || '';
}

function assertStrongSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const access = process.env.JWT_ACCESS_SECRET ?? '';
  const refresh = process.env.JWT_REFRESH_SECRET ?? '';
  const weak = (s: string) => s.length < 32 || s.startsWith('change_me');
  if (weak(access) || weak(refresh) || access === refresh) {
    throw new Error('JWT secrets must be distinct, at least 32 characters, and not placeholders in production');
  }
}
assertStrongSecrets();

export const env: Env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: port,
  MONGO_URI: required('MONGO_URI'),
  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  API_URL: process.env.API_URL || `http://localhost:${port}`,
  // OAuth credentials are optional: email/password login works without them.
  // Tests never use the developer's real credentials from .env, so they behave the same everywhere.
  GOOGLE_CLIENT_ID: optional('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: optional('GOOGLE_CLIENT_SECRET'),
  FACEBOOK_APP_ID: optional('FACEBOOK_APP_ID'),
  FACEBOOK_APP_SECRET: optional('FACEBOOK_APP_SECRET'),
};
