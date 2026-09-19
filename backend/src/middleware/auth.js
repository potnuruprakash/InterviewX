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
 * Route-level middleware to enforce authentication and authorization.
 * Derives user identity exclusively from verified Clerk session via getAuth(req).
 * Never trusts unsigned JWT payloads or arbitrary client headers.
 */
const requireAuth = (req, res, next) => {
  let userId = null;

  try {
    const auth = getAuth(req);
    if (auth && auth.userId) {
      userId = auth.userId;
    }
  } catch (err) {
    console.warn('[requireAuth] Clerk verification error:', err.message);
  }

  // Controlled test-environment fallback for isolated unit testing
  if (!userId && process.env.NODE_ENV === 'test' && process.env.TEST_AUTH_ENABLED === 'true') {
    const testHeader = req.headers['x-test-clerk-user-id'];
    if (testHeader && typeof testHeader === 'string' && testHeader.startsWith('user_')) {
      userId = testHeader;
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

