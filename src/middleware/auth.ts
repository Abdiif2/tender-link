import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { AccessTokenPayload, verifyAccessToken } from '../db/auth.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  sessionUser?: AccessTokenPayload;
}

const ADMIN_ROLES = new Set(['moderator', 'finance_admin', 'super_admin']);

/**
 * Extracts authenticated user context if a valid Bearer token is present,
 * without blocking anonymous requests. Used on mixed endpoints (e.g., consent,
 * abuse reporting, PII-redacted billing history).
 */
export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const sessionPayload = verifyAccessToken(token);
  if (sessionPayload) {
    req.sessionUser = sessionPayload;
    return next();
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
  } catch {
    // Ignore invalid optional token and treat as unauthenticated
  }
  return next();
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please sign in to continue.',
      },
    });
  }

  const token = authHeader.slice('Bearer '.length).trim();

  // 1. Support TenderLink native session Bearer tokens (used by Web, Android & email/phone auth)
  const sessionPayload = verifyAccessToken(token);
  if (sessionPayload) {
    req.sessionUser = sessionPayload;
    return next();
  }

  // 2. Fallback to Firebase Auth ID token verification
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying authentication token:', error);
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired authentication token.',
      },
    });
  }
};

export function getActorRoles(req: AuthRequest): string[] {
  if (req.sessionUser?.roles?.length) {
    return req.sessionUser.roles;
  }
  const firebaseRole = req.user?.role;
  if (typeof firebaseRole === 'string') {
    return [firebaseRole];
  }
  return [];
}

export function hasAnyRole(req: AuthRequest, allowedRoles: string[]): boolean {
  const actorRoles = getActorRoles(req);
  return actorRoles.some((r) => allowedRoles.includes(r));
}

/**
 * Role-Based Access Control (RBAC) guard. Always enforces requireAuth first.
 */
export const requireRole = (...allowedRoles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const proceed = () => {
      if (!hasAnyRole(req, allowedRoles)) {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}.`,
          },
        });
      }
      return next();
    };

    if (req.sessionUser || req.user) {
      return proceed();
    }
    return requireAuth(req, res, proceed);
  };
};

/**
 * Enforces MFA verification on high-privilege admin accounts in production
 * (or whenever an admin account has MFA enabled).
 */
export const requireAdminMfa = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const actorRoles = getActorRoles(req);
  const isAdmin = actorRoles.some((r) => ADMIN_ROLES.has(r));
  if (!isAdmin) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Administrative privileges required.',
      },
    });
  }

  if (process.env.NODE_ENV === 'production' && !req.sessionUser?.mfaVerified) {
    return res.status(403).json({
      error: {
        code: 'MFA_REQUIRED',
        message: 'Multi-factor authentication (TOTP) is required for admin actions.',
      },
    });
  }

  return next();
};
