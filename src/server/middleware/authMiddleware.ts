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
    // Development / Local bypass if no token is sent (browser client, electron, local dev)
    if (process.env.NODE_ENV !== 'production' || !adminAuth || req.headers['x-dev-user-id'] || !process.env.FIREBASE_PROJECT_ID) {
      const devUid = (req.headers['x-dev-user-id'] as string) || 'dev-user-001';
      req.user = {
        uid: devUid,
        email: 'dev@localhost',
        name: 'Dev User'
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
        uid: 'dev-user-001',
        email: 'dev@localhost',
        name: 'Dev User'
      };
      return next();
    }
  } catch (error: any) {
    console.warn('[Auth Middleware] JWT verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired authentication token', details: error.message });
  }
}
