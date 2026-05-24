import { Router } from 'express';
import { getAll, update, deactivate } from './users.controller';
import { authenticate } from '../../middleware/authentication';
import { authorize } from '../../middleware/authorize';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users
 *     description: Get all system users. Restricted to admin only.
 *     responses:
 *       200:
 *         description: User list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', authorize(['admin']), getAll);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Update user
 *     description: Update user name, email, or role. Restricted to admin only.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               role: { type: string, enum: [admin, manager, cashier, warehouse, viewer] }
 *     responses:
 *       200:
 *         description: User updated
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
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', authorize(['admin']), update);

/**
 * @swagger
 * /api/users/{id}/deactivate:
 *   patch:
 *     tags: [Users]
 *     summary: Deactivate a user
 *     description: Deactivate a user account. Restricted to admin only.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User deactivated
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
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/deactivate', authorize(['admin']), deactivate);

export default router;
