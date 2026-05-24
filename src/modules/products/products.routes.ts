import { Router } from 'express';
import {
  getAll,
  getOne,
  getByBarcode,
  createOne,
  updateOne,
  updateProductPrice,
  removeOne,
} from './products.controller';
import { authenticate }  from '../../middleware/authentication';
import { authorize }     from '../../middleware/authorize';
import { validate }      from '../../middleware/validate';
import {
  createProductSchema,
  updateProductSchema,
  updatePriceSchema,
  idParamSchema,
  barcodeParamSchema,
} from './products.schema';

const router = Router();

// All product routes require a valid login token
router.use(authenticate);

// Any logged-in user can view and search products.
// The barcode route must be defined BEFORE /:id
// because Express matches routes top to bottom —
// if /:id comes first, "/barcode/123" would be treated
// as an id lookup for "barcode" which is wrong.
/**
 * @swagger
 * /api/products:
 *   get:
 *     tags: [Products]
 *     summary: List all products
 *     description: Get all products with their current pricing and category information.
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name, SKU, or barcode
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *         description: Filter by category
 *       - in: query
 *         name: supplierId
 *         schema: { type: string, format: uuid }
 *         description: Filter by supplier
 *     responses:
 *       200:
 *         description: Product list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/',
  getAll
);

/**
 * @swagger
 * /api/products/barcode/{code}:
 *   get:
 *     tags: [Products]
 *     summary: Look up product by barcode
 *     description: |
 *       Quick lookup for POS systems. Returns the product with current pricing.
 *       Must be called before the /:id route to work correctly.
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *         description: Product barcode
 *         example: "5012345001234"
 *     responses:
 *       200:
 *         description: Product found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Barcode not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: NOT_FOUND
 *               message: No product found with this barcode
 */
router.get('/barcode/:code',
  validate(barcodeParamSchema),
  getByBarcode
);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get product by ID
 *     description: Get product details including full price history.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id',
  validate(idParamSchema),
  getOne
);

// Only admin and manager can write product data
/**
 * @swagger
 * /api/products:
 *   post:
 *     tags: [Products]
 *     summary: Create a new product
 *     description: Create a new product with initial pricing. Restricted to admin and manager.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, sku, categoryId, supplierId, unit, reorderPoint, costPrice, retailPrice, wholesalePrice]
 *             properties:
 *               name:
 *                 type: string
 *                 example: 26cm Non-Stick Frying Pan
 *               sku:
 *                 type: string
 *                 example: PAN-001
 *               barcode:
 *                 type: string
 *                 nullable: true
 *                 example: "5012345001234"
 *               description:
 *                 type: string
 *                 nullable: true
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               supplierId:
 *                 type: string
 *                 format: uuid
 *               unit:
 *                 type: string
 *                 example: piece
 *               reorderPoint:
 *                 type: string
 *                 example: "10"
 *               costPrice:
 *                 type: string
 *                 example: "8.50"
 *               retailPrice:
 *                 type: string
 *                 example: "14.99"
 *               wholesalePrice:
 *                 type: string
 *                 example: "11.50"
 *     responses:
 *       201:
 *         description: Product created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/',
  authorize(['admin', 'manager']),
  validate(createProductSchema),
  createOne
);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     tags: [Products]
 *     summary: Update product details
 *     description: Update product name, description, SKU, or basic info. Restricted to admin and manager.
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
 *               sku: { type: string }
 *               barcode: { type: string, nullable: true }
 *               description: { type: string, nullable: true }
 *               unit: { type: string }
 *               reorderPoint: { type: string }
 *               categoryId: { type: string, format: uuid }
 *               supplierId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

// Price update is a separate endpoint — changing a price
// is a deliberate business action that always creates
// a new record in product_price_history
/**
 * @swagger
 * /api/products/{id}/price:
 *   put:
 *     tags: [Products]
 *     summary: Update product pricing
 *     description: |
 *       Create a new price record. Prices are append-only — this endpoint
 *       never modifies existing prices, only creates new ones.
 *       Restricted to admin and manager.
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
 *             required: [costPrice, retailPrice, wholesalePrice]
 *             properties:
 *               costPrice:
 *                 type: string
 *                 example: "8.50"
 *               retailPrice:
 *                 type: string
 *                 example: "14.99"
 *               wholesalePrice:
 *                 type: string
 *                 example: "11.50"
 *               note:
 *                 type: string
 *                 nullable: true
 *                 example: "Seasonal promotion"
 *     responses:
 *       200:
 *         description: Price updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/PriceHistory'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id/price',
  authorize(['admin', 'manager']),
  validate(updatePriceSchema),
  updateProductPrice
);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Delete a product
 *     description: Soft-delete a product. Restricted to admin and manager.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

export default router;