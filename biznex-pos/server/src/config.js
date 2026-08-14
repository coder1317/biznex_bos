import dotenv from 'dotenv';
dotenv.config();

function commaList(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me-in-production',
  corsOrigins: commaList(process.env.CORS_ORIGINS),
  publicDir: process.env.PUBLIC_DIR || null, // set to pos-web/dist path when serving the UI
  isDev: process.env.NODE_ENV !== 'production',
};

if (process.env.NODE_ENV === 'production' && config.jwtSecret === 'dev-secret-change-me-in-production') {
  console.warn('  ⚠ JWT_SECRET is using the default value — set a strong secret in .env for production.');
}
