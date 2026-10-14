import { createHmac, timingSafeEqual } from 'node:crypto';

const TWELVE_HOURS = 60 * 60 * 12;

export function jwtSecret() {
  return process.env.JWT_SECRET || 'afez-local-jwt-secret';
}

export function signToken(payload: Record<string, unknown>) {
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + TWELVE_HOURS,
    }),
  ).toString('base64url');
  const signature = createHmac('sha256', jwtSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
}

export function verifyToken<T extends { exp: number }>(token: string): T {
  const [body, signature] = token.split('.');
  if (!body || !signature) throw new Error('Invalid token');
  const expected = createHmac('sha256', jwtSecret())
    .update(body)
    .digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid token');
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as T;
  if (payload.exp < Math.floor(Date.now() / 1000))
    throw new Error('Expired token');
  return payload;
}
