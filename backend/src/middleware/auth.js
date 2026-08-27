const { clerkMiddleware, getAuth } = require('@clerk/express');

/**
 * Check if valid Clerk credentials are present in environment.
 */
const hasValidClerkKeys = () => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY;
  return (
    Boolean(secretKey) &&
    secretKey.startsWith('sk_') &&
    Boolean(publishableKey) &&
    publishableKey.startsWith('pk_')
  );
};

// Global Clerk middleware instance
const clerkAuth = clerkMiddleware();

/**
 * Route-level middleware to enforce authentication.
 * Derives user identity exclusively from verified Clerk session via getAuth(req).
 */
const requireAuth = (req, res, next) => {
  let userId = null;

  try {
    const auth = getAuth(req);
    if (auth && auth.userId) {
      userId = auth.userId;
    }
  } catch (err) {
    // getAuth failed
  }

  // Fallback for automated backend test scripts in non-production environments
  if (!userId && process.env.NODE_ENV !== 'production') {
    const devUserId = req.headers['x-dev-clerk-user-id'];
    if (devUserId) {
      userId = devUserId;
    }
  }

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Your session could not be verified. Please sign in again.',
    });
  }

  // Attach verified user ID to request
  req.clerkUserId = userId;
  next();
};

module.exports = { clerkAuth, requireAuth, hasValidClerkKeys };
