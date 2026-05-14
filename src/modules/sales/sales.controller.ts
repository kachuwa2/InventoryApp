import { Request, Response, NextFunction } from 'express';
import { getIp, getParam } from '../../utils/request';
import {
  getAllSales,
  getSaleById,
  createSale,
  getDailySummary,
} from './sales.service';

export async function getAll(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filters = {
      customerId: req.query.customerId as string | undefined,
      type:       req.query.type       as string | undefined,
    };
    const sales = await getAllSales(filters);
    res.json({ success: true, data: sales });
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
    const sale = await getSaleById(getParam(req, 'id'));
    res.json({ success: true, data: sale });
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
    const sale = await createSale(
      req.body,
      req.user!.userId,
      getIp(req)
    );
    res.status(201).json({ success: true, data: sale });
  } catch (error) {
    next(error);
  }
}

export async function dailySummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const summary = await getDailySummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
}