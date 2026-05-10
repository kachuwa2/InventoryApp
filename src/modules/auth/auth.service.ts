import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../config/database';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from '../../utils/errors';
import { RegisterInput, LoginInput } from './auth.schema';
import { UserRole } from '../../generated/prisma';

// ─── Token Helpers ──────────────────────────────────────

function generateAccessToken(userId: string, role: UserRole): string {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as object
  );
}

function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' } as object
  );
}

// ─── Register ───────────────────────────────────────────

export async function register(data: RegisterInput, ip: string) {
  // Check if email already exists
  const existing = await db.user.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  // Hash the password — cost factor 12 means bcrypt runs
  // 2^12 = 4096 iterations. Takes ~300ms which makes
  // brute force attacks extremely slow.
  const passwordHash = await bcrypt.hash(data.password, 12);

  // Create user and audit log in ONE transaction.
  // If either fails, both are rolled back.
  // You never get a user without an audit record or vice versa.
  const user = await db.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role as UserRole,
      },
      // Only return safe fields — never return passwordHash
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: newUser.id,
        action: 'USER_REGISTERED',
        tableName: 'users',
        recordId: newUser.id,
        afterState: {
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
        ipAddress: ip,
      },
    });

    return newUser;
  });

  return user;
}

// ─── Login ──────────────────────────────────────────────

export async function login(data: LoginInput, ip: string) {
  const user = await db.user.findUnique({
    where: { email: data.email },
  });

  // Always run bcrypt.compare even if user doesn't exist.
  // This prevents timing attacks — without this an attacker
  // could tell if an email is registered by measuring
  // how fast the server responds.
  const dummyHash = '$2a$12$dummyhashtopreventtimingattacksxxxxxxxxxxxxxxxxxxx';
  const isValidPassword = await bcrypt.compare(
    data.password,
    user?.passwordHash ?? dummyHash
  );

  if (!user || !isValidPassword || !user.isActive || user.deletedAt) {
    // Never reveal WHICH check failed
    throw new UnauthorizedError('Invalid email or password');
  }

  const accessToken  = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);

  // Log the login
  await db.auditLog.create({
    data: {
      userId: user.id,
      action: 'USER_LOGIN',
      ipAddress: ip,
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

// ─── Get current user ───────────────────────────────────

export async function getMe(userId: string) {
  const user = await db.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user) throw new NotFoundError('User');
  return user;
}

// ─── Refresh access token ───────────────────────────────

export async function refreshAccessToken(token: string) {
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as { userId: string };

    const user = await db.user.findFirst({
      where: {
        id: payload.userId,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!user) throw new UnauthorizedError('User no longer active');

    const accessToken = generateAccessToken(user.id, user.role);
    return { accessToken };

  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
}