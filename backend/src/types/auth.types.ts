import { Request } from 'express';

export type UserRole = 'admin' | 'user';

export interface JwtAccessPayload {
  sub: string;
  role: UserRole;
}

export interface JwtRefreshPayload {
  sub: string;
  tokenVersion: number;
}

declare global {
  namespace Express {
    // passport's types add `req.user`; make it the JWT payload used by authenticate().
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends JwtAccessPayload {}
  }
}

export interface AuthenticatedRequest extends Request {
  user?: JwtAccessPayload;
}
