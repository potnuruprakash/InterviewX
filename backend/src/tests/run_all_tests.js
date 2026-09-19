/**
 * Master Test Runner for InterviewX Backend
 * Executes all security, isolation, authentication, and core regression suites.
 */

process.env.NODE_ENV = 'test';
process.env.TEST_AUTH_ENABLED = 'true';

const path = require('path');
const { spawn } = require('child_process');

const testSuites = [
  { name: 'Auth & Route Verification', file: 'auth_verification_test.js' },
  { name: 'Multi-Tenant Security & Isolation', file: 'security_and_isolation_test.js' },
  { name: 'Adversarial Red-Team & IDOR Audit', file: 'redteam_audit_suite.js' },
  { name: 'AI Service Resource Limits & Security', file: 'test_ai_service_resources.js' },
  { name: 'Chatbot Architecture & Context Separation', file: 'chatbot_separation_test.js' },
];

function runTest(suite) {
  return new Promise((resolve, reject) => {
    console.log(`\n=============================================================`);
    console.log(`RUNNING SUITE: ${suite.name} (${suite.file})`);
    console.log(`=============================================================`);

    const filePath = path.join(__dirname, suite.file);
    const proc = spawn(process.execPath, [filePath], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_AUTH_ENABLED: 'true',
      },
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`\n>>> ${suite.name}: PASSED ✅`);
        resolve();
      } else {
        console.error(`\n>>> ${suite.name}: FAILED (exit code ${code}) ❌`);
        reject(new Error(`Suite ${suite.name} failed with exit code ${code}`));
      }
    });

    proc.on('error', (err) => {
      console.error(`\n>>> ${suite.name} process error:`, err);
      reject(err);
    });
  });
}

async function runAll() {
  const startTime = Date.now();
  console.log('=============================================================');
  console.log('INTERVIEWX AUTOMATED PRODUCTION VERIFICATION SUITE');
  console.log(`Total Suites: ${testSuites.length}`);
  console.log('=============================================================');

  for (const suite of testSuites) {
    await runTest(suite);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=============================================================');
  console.log(`ALL TEST SUITES COMPLETED SUCCESSFULLY IN ${elapsed}s ✅`);
  console.log('=============================================================\n');
}

if (require.main === module) {
  runAll()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\nMaster test runner failed:', err.message);
      process.exit(1);
    });
}

module.exports = runAll;
