import { Router } from 'express';
import * as authController from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authentication';
import { loginSchema, registerSchema } from './auth.schema';

const router = Router();

// ─── Public routes — no token required ──────────────────
router.post('/register', validate(registerSchema), authController.register);
router.post('/login',    validate(loginSchema),    authController.login);
router.post('/refresh',                            authController.refresh);
router.post('/logout',                             authController.logout);

// ─── Protected route — token required ───────────────────
router.get('/me', authenticate, authController.getMe);

export default router;