import { Request, Response, NextFunction } from 'express';
import {
  getDashboardKPIs,
  getProfitLoss,
  getTopProducts,
  getSlowMovingProducts,
} from './reports.service';
import { ValidationError } from '../../utils/errors';

export async function dashboard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await getDashboardKPIs();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function profitLoss(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      throw new ValidationError(
        'Please provide both "from" and "to" date parameters. ' +
        'Example: ?from=2026-01-01&to=2026-12-31'
      );
    }

    const fromDate = new Date(from as string);
    const toDate   = new Date(to   as string);

    // Set toDate to end of day so the full day is included
    toDate.setHours(23, 59, 59, 999);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new ValidationError(
        'Invalid date format. Use YYYY-MM-DD. Example: ?from=2026-01-01&to=2026-12-31'
      );
    }

    if (fromDate > toDate) {
      throw new ValidationError('"from" date must be before "to" date');
    }

    const data = await getProfitLoss(fromDate, toDate);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function topProducts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit = req.query.limit
      ? parseInt(req.query.limit as string)
      : 10;
    const data = await getTopProducts(limit);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function slowMoving(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const days = req.query.days
      ? parseInt(req.query.days as string)
      : 30;
    const data = await getSlowMovingProducts(days);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}