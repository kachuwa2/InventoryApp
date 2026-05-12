import { Request, Response, NextFunction } from 'express';
import * as suppliersService from './suppliers.service';
import { getIp, getParam } from '../../utils/request';

export async function getAll(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const suppliers = await suppliersService.getAllSuppliers();
    res.json({ success: true, data: suppliers });
  } catch (error) {
    next(error);
  }
}

export async function getOne(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const supplier = await suppliersService.getSupplierById(
      getParam(req, 'id')
    );
    res.json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
}

export async function create(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const supplier = await suppliersService.createSupplier(
      req.body,
      req.user!.userId,
      getIp(req)
    );
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
}

export async function update(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const supplier = await suppliersService.updateSupplier(
      getParam(req, 'id'),
      req.body,
      req.user!.userId,
      getIp(req)
    );
    res.json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
}

export async function remove(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await suppliersService.deleteSupplier(
      getParam(req, 'id'),
      req.user!.userId,
      getIp(req)
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}