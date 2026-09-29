const { clerkMiddleware, getAuth } = require('@clerk/express');

/**
 * Check if valid Clerk credentials are present in environment.
 */
const hasValidClerkKeys = () => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey =
    process.env.CLERK_PUBLISHABLE_KEY ||
    process.env.VITE_CLERK_PUBLISHABLE_KEY;

  return (
    Boolean(secretKey) &&
    secretKey.startsWith('sk_') &&
    Boolean(publishableKey) &&
    publishableKey.startsWith('pk_')
  );
};

/**
 * Global Clerk middleware.
 *
 * In CI/test mode, skip Clerk completely because the test suite
 * uses x-test-clerk-user-id for controlled authentication.
 */
const clerkAuth = (req, res, next) => {
  const isTestAuthEnabled =
    process.env.NODE_ENV === 'test' &&
    process.env.TEST_AUTH_ENABLED === 'true';

  if (isTestAuthEnabled) {
    return next();
  }

  return clerkMiddleware()(req, res, next);
};

/**
 * Route-level authentication and authorization.
 */
const requireAuth = (req, res, next) => {
  let userId = null;

  const isTestAuthEnabled =
    process.env.NODE_ENV === 'test' &&
    process.env.TEST_AUTH_ENABLED === 'true';

  // Controlled test authentication for CI
  if (isTestAuthEnabled) {
    const testHeader = req.headers['x-test-clerk-user-id'];
    if (
      testHeader &&
      typeof testHeader === 'string' &&
      testHeader.startsWith('user_')
    ) {
      userId = testHeader;
    }
  }

  // Production authentication through verified Clerk session
  if (!userId) {
    try {
      const auth = getAuth(req);
      if (auth && auth.userId) {
        userId = auth.userId;
      }
    } catch (err) {
      console.warn('[requireAuth] Clerk verification error:', err.message);
    }
  }

  // Production identity must come from verified Clerk authentication.
  // Note: Unverified JWT payload decoding without cryptographic signature verification
  // has been permanently removed to prevent forged token attacks.

  // Fallback 2: Automated backend test scripts / dev fallback in non-production environments
  if (!userId && process.env.NODE_ENV !== 'production') {
    const devUserId = req.headers['x-dev-clerk-user-id'] || req.headers['x-test-clerk-user-id'];
    if (devUserId && typeof devUserId === 'string' && devUserId.startsWith('user_')) {
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

  req.clerkUserId = userId;
  next();
};

module.exports = {
  clerkAuth,
  requireAuth,
  hasValidClerkKeys,
};