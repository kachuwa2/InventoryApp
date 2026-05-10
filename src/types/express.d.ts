import { UserRole } from '../generated/prisma';

// This tells TypeScript that every Express Request
// object can have a `user` property attached to it.
// Without this, TypeScript would complain every time
// you write req.user in your middleware and controllers.
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: UserRole;
      };
    }
  }
}