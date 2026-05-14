
import { Request, Response, NextFunction } from 'express';
import { getIp, getParam } from '../../utils/request';
import {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from './customers.service';

export async function getAll(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filters = {
      type:   req.query.type   as string | undefined,
      search: req.query.search as string | undefined,
    };
    const customers = await getAllCustomers(filters);
    res.json({ success: true, data: customers });
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
    const customer = await getCustomerById(getParam(req, 'id'));
    res.json({ success: true, data: customer });
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
    const customer = await createCustomer(
      req.body,
      req.user!.userId,
      getIp(req)
    );
    res.status(201).json({ success: true, data: customer });
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
    const customer = await updateCustomer(
      getParam(req, 'id'),
      req.body,
      req.user!.userId,
      getIp(req)
    );
    res.json({ success: true, data: customer });
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
    const result = await deleteCustomer(
      getParam(req, 'id'),
      req.user!.userId,
      getIp(req)
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}