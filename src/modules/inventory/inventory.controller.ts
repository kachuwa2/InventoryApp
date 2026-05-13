import { Request, Response, NextFunction } from 'express';
import { getIp, getParam } from '../../utils/request';
import {
  getAllStockLevels,
  getLowStockProducts,
  getProductMovements,
  adjustStock,
  getInventoryValuation,
} from './inventory.service';

export async function getStockLevels(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stock = await getAllStockLevels();
    res.json({ success: true, data: stock });
  } catch (error) {
    next(error);
  }
}

export async function getLowStock(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const products = await getLowStockProducts();
    res.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
}

export async function getMovements(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await getProductMovements(
      getParam(req, 'productId')
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function adjust(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const movement = await adjustStock(
      req.body,
      req.user!.userId,
      getIp(req)
    );
    res.status(201).json({ success: true, data: movement });
  } catch (error) {
    next(error);
  }
}

export async function getValuation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const valuation = await getInventoryValuation();
    res.json({ success: true, data: valuation });
  } catch (error) {
    next(error);
  }
}