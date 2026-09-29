/**
 * Dedicated CORS Verification Suite
 * Verifies production Vercel origins, localhost development, credentials,
 * header allowances, preflight OPTIONS, and route access (/interviews, /progress, /state).
 */

const http = require('http');
const assert = require('assert');
const app = require('../app');

const server = http.createServer(app);

server.listen(0, async () => {
  const port = server.address().port;
  console.log('[Test] Server listening on port', port);

  const sendRequest = (method, path, origin, headers = {}) => {
    return new Promise((resolve) => {
      const reqHeaders = { ...headers };
      if (origin !== undefined) {
        reqHeaders['Origin'] = origin;
      }
      const req = http.request({
        host: 'localhost',
        port: port,
        method: method,
        path: path,
        headers: reqHeaders,
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body,
        }));
      });
      req.on('error', (err) => resolve({ error: err.message }));
      req.end();
    });
  };

  const testCases = [
    // 1. Deployed Vercel Frontend: https://interview-x-five.vercel.app
    {
      name: 'OPTIONS /api/interviews from https://interview-x-five.vercel.app',
      method: 'OPTIONS',
      path: '/api/interviews',
      origin: 'https://interview-x-five.vercel.app',
      reqHeaders: {
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization,Content-Type,x-dev-clerk-user-id',
      },
      expectStatus: 204,
      expectAllowOrigin: 'https://interview-x-five.vercel.app',
      expectCredentials: 'true',
    },
    // 2. Specific Vercel Origin: https://interview-o4wai632-prakash-1cc8.vercel.app
    {
      name: 'OPTIONS /api/progress from https://interview-o4wai632-prakash-1cc8.vercel.app',
      method: 'OPTIONS',
      path: '/api/progress',
      origin: 'https://interview-o4wai632-prakash-1cc8.vercel.app',
      reqHeaders: {
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization,Content-Type',
      },
      expectStatus: 204,
      expectAllowOrigin: 'https://interview-o4wai632-prakash-1cc8.vercel.app',
      expectCredentials: 'true',
    },
    // 3. /api/coach/state from https://interview-x-five.vercel.app
    {
      name: 'OPTIONS /api/coach/state from https://interview-x-five.vercel.app',
      method: 'OPTIONS',
      path: '/api/coach/state',
      origin: 'https://interview-x-five.vercel.app',
      reqHeaders: {
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization,Content-Type',
      },
      expectStatus: 204,
      expectAllowOrigin: 'https://interview-x-five.vercel.app',
      expectCredentials: 'true',
    },
    // 4. Localhost Development
    {
      name: 'OPTIONS /api/interviews from http://localhost:5173',
      method: 'OPTIONS',
      path: '/api/interviews',
      origin: 'http://localhost:5173',
      reqHeaders: {
        'Access-Control-Request-Method': 'GET',
      },
      expectStatus: 204,
      expectAllowOrigin: 'http://localhost:5173',
      expectCredentials: 'true',
    },
    // 5. 127.0.0.1 Localhost Development
    {
      name: 'OPTIONS /api/interviews from http://127.0.0.1:5173',
      method: 'OPTIONS',
      path: '/api/interviews',
      origin: 'http://127.0.0.1:5173',
      reqHeaders: {
        'Access-Control-Request-Method': 'POST',
      },
      expectStatus: 204,
      expectAllowOrigin: 'http://127.0.0.1:5173',
      expectCredentials: 'true',
    },
    // 6. Direct /interviews route
    {
      name: 'OPTIONS /interviews from https://interview-x-five.vercel.app',
      method: 'OPTIONS',
      path: '/interviews',
      origin: 'https://interview-x-five.vercel.app',
      reqHeaders: {
        'Access-Control-Request-Method': 'GET',
      },
      expectStatus: 204,
      expectAllowOrigin: 'https://interview-x-five.vercel.app',
      expectCredentials: 'true',
    },
    // 7. Direct /progress route
    {
      name: 'OPTIONS /progress from https://interview-x-five.vercel.app',
      method: 'OPTIONS',
      path: '/progress',
      origin: 'https://interview-x-five.vercel.app',
      reqHeaders: {
        'Access-Control-Request-Method': 'GET',
      },
      expectStatus: 204,
      expectAllowOrigin: 'https://interview-x-five.vercel.app',
      expectCredentials: 'true',
    },
    // 8. Direct /state route
    {
      name: 'OPTIONS /state from https://interview-x-five.vercel.app',
      method: 'OPTIONS',
      path: '/state',
      origin: 'https://interview-x-five.vercel.app',
      reqHeaders: {
        'Access-Control-Request-Method': 'GET',
      },
      expectStatus: 204,
      expectAllowOrigin: 'https://interview-x-five.vercel.app',
      expectCredentials: 'true',
    },
    // 9. Unauthorized origin blocked (500, no allow origin)
    {
      name: 'OPTIONS from unauthorized origin https://attacker-website.com',
      method: 'OPTIONS',
      path: '/api/interviews',
      origin: 'https://attacker-website.com',
      reqHeaders: {
        'Access-Control-Request-Method': 'GET',
      },
      expectStatus: 500,
      expectAllowOrigin: undefined,
      expectCredentials: undefined,
    },
    // 10. Non-browser request without Origin header -> allowed (e.g. health check)
    {
      name: 'GET /health without Origin header',
      method: 'GET',
      path: '/health',
      origin: undefined,
      expectStatus: 200,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const res = await sendRequest(tc.method, tc.path, tc.origin, tc.reqHeaders);
    const statusMatch = res.status === tc.expectStatus;
    const originMatch = res.headers['access-control-allow-origin'] === tc.expectAllowOrigin;
    const credMatch =
      tc.expectCredentials === undefined ||
      res.headers['access-control-allow-credentials'] === tc.expectCredentials;

    if (statusMatch && originMatch && credMatch) {
      console.log('PASS:', tc.name);
      passed++;
    } else {
      console.error('FAIL:', tc.name, {
        status: res.status,
        expectedStatus: tc.expectStatus,
        allowOrigin: res.headers['access-control-allow-origin'],
        expectedAllowOrigin: tc.expectAllowOrigin,
        credentials: res.headers['access-control-allow-credentials'],
        expectedCredentials: tc.expectCredentials,
      });
      failed++;
    }
  }

  // 11. Test dynamic process.env.FRONTEND_URL with trailing slash
  process.env.FRONTEND_URL = 'https://custom-preview-env.vercel.app/, https://second-domain.com';
  const dynamicRes = await sendRequest(
    'OPTIONS',
    '/api/interviews',
    'https://custom-preview-env.vercel.app',
    { 'Access-Control-Request-Method': 'GET' }
  );
  if (
    dynamicRes.status === 204 &&
    dynamicRes.headers['access-control-allow-origin'] === 'https://custom-preview-env.vercel.app'
  ) {
    console.log('PASS: Dynamic FRONTEND_URL with trailing slash normalized');
    passed++;
  } else {
    console.error('FAIL: Dynamic FRONTEND_URL test failed', dynamicRes);
    failed++;
  }

  // 12. Test GET with origin receives Access-Control-Allow-Origin
  const getRes = await sendRequest(
    'GET',
    '/health',
    'https://interview-x-five.vercel.app'
  );
  if (
    getRes.status === 200 &&
    getRes.headers['access-control-allow-origin'] === 'https://interview-x-five.vercel.app' &&
    getRes.headers['access-control-allow-credentials'] === 'true'
  ) {
    console.log('PASS: GET request carries Access-Control-Allow-Origin and Credentials');
    passed++;
  } else {
    console.error('FAIL: GET request failed to include CORS headers', getRes.headers);
    failed++;
  }

  server.close();
  console.log(`\n========================================`);
  console.log(`CORS Test Summary: ${passed} passed, ${failed} failed`);
  console.log(`========================================`);
  process.exit(failed > 0 ? 1 : 0);
});
