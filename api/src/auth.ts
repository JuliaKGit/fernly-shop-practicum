import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from './errors.js';
import type { User } from './schemas.js';
import { store } from './store.js';

const SECRET = process.env.JWT_SECRET ?? 'fernly-local-practice-only';

export function issueToken(user: User): string {
  return jwt.sign({ sub: user.id }, SECRET, { expiresIn: '8h' });
}

/** Returns the signed-in user, or throws 401 with rule auth_required. */
export function requireUser(req: Request): User {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Sign in to continue.', 'auth_required');
  try {
    const payload = jwt.verify(token, SECRET) as { sub: string };
    return store.user(payload.sub);
  } catch {
    throw new ApiError(401, 'Your session has expired. Sign in again.', 'auth_required');
  }
}
