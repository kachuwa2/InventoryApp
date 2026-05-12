import { Request, Response, NextFunction } from 'express';
import { getIp, getParam } from '../../utils/request';
import {
  getAllProducts,
  getProductById,
  getProductByBarcode,
  createProduct,
  updateProduct,
  updatePrice,
  deleteProduct,
} from './products.service';

// By importing specific functions from the service and
// then re-exporting them wrapped in Express handlers,
// TypeScript can clearly see the shape of each export.
// This avoids the "namespace import" confusion that
// causes the overload errors in the routes file.

export async function getAll(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filters = {
      categoryId: req.query.categoryId as string | undefined,
      supplierId: req.query.supplierId as string | undefined,
      search:     req.query.search     as string | undefined,
    };
    const products = await getAllProducts(filters);
    res.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
}

export async function getOne(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await getProductById(getParam(req, 'id'));
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

export async function getByBarcode(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await getProductByBarcode(getParam(req, 'code'));
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

export async function createOne(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await createProduct(
      req.body,
      req.user!.userId,
      getIp(req)
    );
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

export async function updateOne(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await updateProduct(
      getParam(req, 'id'),
      req.body,
      req.user!.userId,
      getIp(req)
    );
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

export async function updateProductPrice(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const price = await updatePrice(
      getParam(req, 'id'),
      req.body,
      req.user!.userId,
      getIp(req)
    );
    res.json({ success: true, data: price });
  } catch (error) {
    next(error);
  }
}

export async function removeOne(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await deleteProduct(
      getParam(req, 'id'),
      req.user!.userId,
      getIp(req)
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}