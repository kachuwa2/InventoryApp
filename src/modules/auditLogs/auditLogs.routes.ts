import { Router } from 'express';
import { getAll } from './auditLogs.controller';
import { authenticate } from '../../middleware/authentication';
import { authorize } from '../../middleware/authorize';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     tags: [Audit]
 *     summary: Get audit logs
 *     description: |
 *       Get system audit logs showing all data modifications.
 *       Includes user, timestamp, action, and before/after states.
 *       Restricted to admin only.
 *     parameters:
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *         description: Filter by action type (e.g. PRODUCT_CREATED, SALE_COMPLETED)
 *       - in: query
 *         name: tableName
 *         schema: { type: string }
 *         description: Filter by table name
 *       - in: query
 *         name: userId
 *         schema: { type: string, format: uuid }
 *         description: Filter by user
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *         description: Start date for log range
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *         description: End date for log range
 *     responses:
 *       200:
 *         description: Audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', authorize(['admin']), getAll);

export default router;
