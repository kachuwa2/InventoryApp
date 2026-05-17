import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { getIp } from '../../utils/request';

// Controllers are intentionally thin.
// They only handle HTTP concerns:
// 1. Read from request
// 2. Call the service
// 3. Send the response
// Zero business logic lives here.

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const ip = getIp(req);
    const user = await authService.register(req.body, ip);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const ip = getIp(req);
    const result = await authService.login(req.body, ip);

    // Refresh token goes in an httpOnly cookie.
    // JavaScript running in the browser CANNOT read
    // httpOnly cookies — this defeats XSS token theft.
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });

    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await authService.getMe(req.user!.userId);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token provided',
      });
    }

    const result = await authService.refreshAccessToken(token);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
) {
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out successfully' });
}

export async function setupStatus(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const count = await authService.getUserCount();
    res.json({ success: true, data: { hasUsers: count > 0 } });
  } catch (error) {
    next(error);
  }
}