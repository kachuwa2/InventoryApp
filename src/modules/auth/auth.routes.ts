import { Router } from 'express';
import * as authController from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate, optionalAuthenticate } from '../../middleware/authentication';
import { requireAdminOrFirstUser } from '../../middleware/requireAdminOrFirstUser';
import { loginSchema, registerSchema } from './auth.schema';

const router = Router();

// ─── Public routes ───────────────────────────────────────
/**
 * @swagger
 * /api/auth/setup-status:
 *   get:
 *     tags: [Auth]
 *     summary: Check if system is initialized
 *     description: |
 *       Returns true if the system has been initialized (at least one admin user exists).
 *       Use this endpoint on application startup to determine if users need to register an admin.
 *     security: []
 *     responses:
 *       200:
 *         description: Setup status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     initialized: { type: boolean, example: true }
 */
router.get('/setup-status',                                                 authController.setupStatus);
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     description: |
 *       Authenticates the user and returns a JWT access token.
 *       The refresh token is set as an httpOnly cookie automatically.
 *       Access token expires in 15 minutes; refresh token expires in 7 days.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: sara@shop.com
 *               password:
 *                 type: string
 *                 example: Admin1234
 *                 minLength: 1
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: UNAUTHORIZED
 *               message: Invalid email or password
 */
router.post('/login',    validate(loginSchema),                             authController.login);
/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     description: |
 *       Exchanges the httpOnly refresh cookie for a new access token.
 *       The refresh token must be sent in the Cookie header automatically by the browser.
 *     security: []
 *     responses:
 *       200:
 *         description: Token refreshed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       401:
 *         description: Refresh token invalid or expired
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: UNAUTHORIZED
 *               message: Refresh token invalid or expired
 */
router.post('/refresh',                                                     authController.refresh);
/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and clear session
 *     description: |
 *       Clears the httpOnly refresh token cookie and invalidates the session.
 *     security: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   example: {}
 */
router.post('/logout',                                                      authController.logout);

// ─── Register: open for first user, admin-only afterward ─
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     description: |
 *       Register a new user account. The first user will be created as an admin.
 *       Subsequent registrations require an admin token.
 *       The first user may be registered without authentication.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Sara Admin
 *               email:
 *                 type: string
 *                 format: email
 *                 example: sara@shop.com
 *               password:
 *                 type: string
 *                 example: Admin1234
 *                 minLength: 8
 *               role:
 *                 type: string
 *                 enum: [admin, manager, cashier, warehouse, viewer]
 *                 example: admin
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/register',
  optionalAuthenticate,
  requireAdminOrFirstUser,
  validate(registerSchema),
  authController.register,
);

// ─── Protected route — token required ────────────────────
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     description: |
 *       Returns the profile of the currently authenticated user.
 *       Requires a valid JWT access token in the Authorization header.
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/me', authenticate, authController.getMe);

export default router;