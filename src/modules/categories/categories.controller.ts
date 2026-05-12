import { Request, Response, NextFunction } from 'express';
import * as categoriesService from './categories.service';

// Both helpers come from the same utils file.
// getIp handles the IP extraction safely.
// getParam handles URL parameter extraction safely.
import { getIp, getParam } from '../../utils/request';

export async function getAll(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const categories = await categoriesService.getAllCategories();
    res.json({ success: true, data: categories });
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
    // getParam safely extracts req.params.id as a plain string
    const category = await categoriesService.getCategoryById(
      getParam(req, 'id')
    );
    res.json({ success: true, data: category });
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
    const category = await categoriesService.createCategory(
      req.body,
      req.user!.userId,
      getIp(req)
    );
    res.status(201).json({ success: true, data: category });
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
    const category = await categoriesService.updateCategory(
      getParam(req, 'id'),
      req.body,
      req.user!.userId,
      getIp(req)
    );
    res.json({ success: true, data: category });
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
    const result = await categoriesService.deleteCategory(
      getParam(req, 'id'),
      req.user!.userId,
      getIp(req)
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}