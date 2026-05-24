import { Router } from 'express';
import {
  dashboard,
  profitLoss,
  topProducts,
  slowMoving,
  salesAudit,
} from './reports.controller';
import { authenticate } from '../../middleware/authentication';
import { authorize }    from '../../middleware/authorize';

const router = Router();

router.use(authenticate);

// Reports are restricted to admin and manager only —
// financial data is sensitive
router.use(authorize(['admin', 'manager']));

/**
 * @swagger
 * /api/reports/dashboard:
 *   get:
 *     tags: [Reports]
 *     summary: Get dashboard KPIs
 *     description: Get key performance indicators for the dashboard (revenue, stock value, orders).
 *     responses:
 *       200:
 *         description: Dashboard KPIs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRevenue: { type: number, example: 45000.50 }
 *                     totalCost: { type: number, example: 20000.00 }
 *                     totalProfit: { type: number, example: 25000.50 }
 *                     inventoryValue: { type: number, example: 15000.00 }
 *                     totalOrders: { type: integer, example: 125 }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/dashboard',     dashboard);

/**
 * @swagger
 * /api/reports/profit-loss:
 *   get:
 *     tags: [Reports]
 *     summary: Get profit and loss report
 *     description: Get detailed P&L statement with cost and revenue breakdown.
 *     responses:
 *       200:
 *         description: P&L Report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRevenue: { type: number }
 *                     totalCost: { type: number }
 *                     grossProfit: { type: number }
 *                     netProfit: { type: number }
 *                     margin: { type: number, example: 55.5 }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/profit-loss',   profitLoss);

/**
 * @swagger
 * /api/reports/top-products:
 *   get:
 *     tags: [Reports]
 *     summary: Get top-selling products
 *     description: Get products ranked by sales volume.
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Number of products to return
 *     responses:
 *       200:
 *         description: Top products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productName: { type: string }
 *                       totalQuantity: { type: integer }
 *                       totalRevenue: { type: number }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/top-products',  topProducts);

/**
 * @swagger
 * /api/reports/slow-moving:
 *   get:
 *     tags: [Reports]
 *     summary: Get slow-moving products
 *     description: Get products with low sales velocity.
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30 }
 *         description: Look back period in days
 *     responses:
 *       200:
 *         description: Slow-moving products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productName: { type: string }
 *                       lastSaleDate: { type: string, format: date-time, nullable: true }
 *                       quantityOnHand: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/slow-moving',   slowMoving);

/**
 * @swagger
 * /api/reports/sales-audit:
 *   get:
 *     tags: [Reports]
 *     summary: Get sales audit report
 *     description: Detailed audit report of all sales with export capability.
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Report start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: Report end date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Sales audit report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SalesOrder'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */

export default router;