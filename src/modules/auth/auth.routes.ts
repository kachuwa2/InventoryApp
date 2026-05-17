import { Router } from 'express';
import * as authController from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate, optionalAuthenticate } from '../../middleware/authentication';
import { requireAdminOrFirstUser } from '../../middleware/requireAdminOrFirstUser';
import { loginSchema, registerSchema } from './auth.schema';

const router = Router();

// ─── Public routes ───────────────────────────────────────
router.get('/setup-status',                                                 authController.setupStatus);
router.post('/login',    validate(loginSchema),                             authController.login);
router.post('/refresh',                                                     authController.refresh);
router.post('/logout',                                                      authController.logout);

// ─── Register: open for first user, admin-only afterward ─
router.post('/register',
  optionalAuthenticate,
  requireAdminOrFirstUser,
  validate(registerSchema),
  authController.register,
);

// ─── Protected route — token required ────────────────────
router.get('/me', authenticate, authController.getMe);

export default router;