import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { getIp } from '../../utils/request';
import { ValidationError } from '../../utils/errors';

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
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
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

    // Rotate the refresh token — issue a fresh cookie on every refresh
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      success: true,
      data: { accessToken: result.accessToken },
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
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });
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

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email } = req.body;
    if (!email) throw new ValidationError('Email required');
    await authService.forgotPassword(email);
    res.json({
      success: true,
      message: 'If an account exists, a reset link has been sent',
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      throw new ValidationError('Token and password required');
    }
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }
    await authService.resetPassword(token, password);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
}