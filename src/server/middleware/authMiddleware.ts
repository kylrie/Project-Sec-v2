import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebaseAdmin.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Development bypass if Firebase Admin is not configured or in local sandbox
    if (process.env.NODE_ENV !== 'production' && (!adminAuth || req.headers['x-dev-user-id'])) {
      const devUid = (req.headers['x-dev-user-id'] as string) || 'dev-executive-001';
      req.user = {
        uid: devUid,
        email: 'tony.stark@enterprise.io',
        name: 'Tony Stark'
      };
      return next();
    }
    return res.status(401).json({ error: 'Authorization header missing or malformed. Format: Bearer <token>' });
  }

  const idToken = authHeader.split('Bearer ')[1].trim();

  try {
    if (adminAuth) {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name
      };
      return next();
    } else {
      // If adminAuth is not configured in local development, accept mock token
      req.user = {
        uid: 'dev-executive-001',
        email: 'tony.stark@enterprise.io',
        name: 'Tony Stark'
      };
      return next();
    }
  } catch (error: any) {
    console.warn('[Auth Middleware] JWT verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired authentication token', details: error.message });
  }
}
