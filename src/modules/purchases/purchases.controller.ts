import { Request, Response, NextFunction } from 'express';
import { getIp, getParam } from '../../utils/request';
import {
  getAllPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  approvePurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} from './purchases.service';

export async function getAll(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filters = {
      status:     req.query.status     as string | undefined,
      supplierId: req.query.supplierId as string | undefined,
    };
    const orders = await getAllPurchaseOrders(filters);
    res.json({ success: true, data: orders });
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
    const order = await getPurchaseOrderById(getParam(req, 'id'));
    res.json({ success: true, data: order });
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
    const order = await createPurchaseOrder(
      req.body,
      req.user!.userId,
      getIp(req)
    );
    res.status(201).json({ success: true, data: order });
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
    const order = await updatePurchaseOrder(
      getParam(req, 'id'),
      req.body,
      req.user!.userId,
      getIp(req)
    );
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function approve(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await approvePurchaseOrder(
      getParam(req, 'id'),
      req.user!.userId,
      getIp(req)
    );
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function receive(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await receivePurchaseOrder(
      getParam(req, 'id'),
      req.body,
      req.user!.userId,
      getIp(req)
    );
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function cancel(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await cancelPurchaseOrder(
      getParam(req, 'id'),
      req.user!.userId,
      getIp(req)
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}