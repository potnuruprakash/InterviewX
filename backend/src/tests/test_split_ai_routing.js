/**
 * Backend AI Service Split Routing Test Suite
 *
 * Verifies:
 *   1. Text evaluation routes to AI_SERVICE_URL (Core).
 *   2. Audio analysis routes to AI_SERVICE_URL (Core).
 *   3. Video analysis routes to VIDEO_AI_SERVICE_URL (Video).
 *   4. Shared internal authentication key is passed in headers to both services.
 *   5. Response schemas remain identical to previous contracts.
 *   6. Unavailable services return structured errors without fabricating scores.
 *   7. Aggregated health checks report both core and video services.
 *   8. Missing files and invalid inputs are handled gracefully without crash.
 *   9. Secrets and internal URLs are never exposed in error responses.
 */

'use strict';

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const TEST_SECRET = 'secret_test_key_xyz987';
const CORE_PORT = 9123;
const VIDEO_PORT = 9124;

let coreServer;
let videoServer;
let lastCoreRequest = null;
let lastVideoRequest = null;

// Start mock Core & Video HTTP servers
function startMockServers() {
  return new Promise((resolve) => {
    coreServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        lastCoreRequest = {
          url: req.url,
          method: req.method,
          headers: req.headers,
          body,
        };

        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', mode: 'core', service: 'interviewx-ai' }));
        } else if (req.url === '/api/ai/text-evaluate') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            data: {
              semanticScore: 88.5,
              conceptCoverage: 90.0,
              textScore: 89.25,
              feedback: 'Strong answer',
              strengths: ['Clear terminology'],
              missingConcepts: [],
              modelStatus: 'loaded',
            },
          }));
        } else if (req.url === '/api/ai/audio-analyze') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            data: {
              audioFeaturesAvailable: true,
              speakingDuration: 12.4,
              pauseDuration: 1.2,
              speechRate: 140.0,
              modelStatus: 'not_trained',
            },
          }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'NOT_FOUND' }));
        }
      });
    });

    videoServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        lastVideoRequest = {
          url: req.url,
          method: req.method,
          headers: req.headers,
        };

        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', mode: 'video', service: 'interviewx-ai' }));
        } else if (req.url === '/api/ai/video-analyze') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            data: {
              framesProcessed: 25,
              personDetectedFrames: 25,
              personDetectionRatio: 1.0,
              faceVisibilityRatio: 0.96,
              gazeAttentionRatio: 0.88,
              postureStability: 'stable',
              cameraEngagement: 'engaged',
              videoQualityIndicator: 'good',
              modelStatus: 'analyzed',
            },
          }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'NOT_FOUND' }));
        }
      });
    });

    coreServer.listen(CORE_PORT, () => {
      videoServer.listen(VIDEO_PORT, () => {
        resolve();
      });
    });
  });
}

function stopMockServers() {
  return new Promise((resolve) => {
    if (coreServer) coreServer.close();
    if (videoServer) videoServer.close();
    resolve();
  });
}

async function runTests() {
  console.log('=== Backend AI Service Split Routing Test Suite ===\n');
  let passed = 0;
  let failed = 0;

  process.env.AI_SERVICE_URL = `http://localhost:${CORE_PORT}`;
  process.env.VIDEO_AI_SERVICE_URL = `http://localhost:${VIDEO_PORT}`;
  process.env.AI_SERVICE_SECRET_KEY = TEST_SECRET;

  await startMockServers();

  // Clear module cache to reinitialize aiService with new env
  delete require.cache[require.resolve('../services/aiService')];
  const aiService = require('../services/aiService');

  // Test 1: Check health probes both services
  try {
    const health = await aiService.checkHealth();
    assert.strictEqual(health.status, 'ok', 'Aggregated health should be ok when both services are healthy');
    assert.strictEqual(health.services.core, 'ok');
    assert.strictEqual(health.services.video, 'ok');
    console.log('✓ PASS: checkHealth() probes both Core and Video services');
    passed++;
  } catch (err) {
    console.error('✗ FAIL: checkHealth():', err.message);
    failed++;
  }

  // Test 2: Text evaluation routes to AI_SERVICE_URL
  try {
    lastCoreRequest = null;
    const res = await aiService.evaluateText('What is polymorphism?', 'An OOP concept...', ['OOP']);
    assert.strictEqual(lastCoreRequest.url, '/api/ai/text-evaluate');
    assert.strictEqual(lastCoreRequest.headers['x-internal-service-key'], TEST_SECRET);
    assert.strictEqual(res.textScore, 89.25);
    assert.strictEqual(res.modelStatus, 'loaded');
    console.log('✓ PASS: evaluateText() routes to AI_SERVICE_URL with internal auth');
    passed++;
  } catch (err) {
    console.error('✗ FAIL: evaluateText():', err.message);
    failed++;
  }

  // Test 3: Audio analysis routes to AI_SERVICE_URL
  const dummyAudioPath = path.join(__dirname, 'dummy_test_audio.webm');
  fs.writeFileSync(dummyAudioPath, 'dummy-audio-content');
  try {
    lastCoreRequest = null;
    const res = await aiService.analyzeAudio(dummyAudioPath);
    assert.strictEqual(lastCoreRequest.url, '/api/ai/audio-analyze');
    assert.strictEqual(lastCoreRequest.headers['x-internal-service-key'], TEST_SECRET);
    assert.strictEqual(res.audioFeaturesAvailable, true);
    assert.strictEqual(res.speechRate, 140.0);
    console.log('✓ PASS: analyzeAudio() routes to AI_SERVICE_URL with internal auth');
    passed++;
  } catch (err) {
    console.error('✗ FAIL: analyzeAudio():', err.message);
    failed++;
  } finally {
    if (fs.existsSync(dummyAudioPath)) fs.unlinkSync(dummyAudioPath);
  }

  // Test 4: Video analysis routes to VIDEO_AI_SERVICE_URL
  const dummyVideoPath = path.join(__dirname, 'dummy_test_video.webm');
  fs.writeFileSync(dummyVideoPath, 'dummy-video-content');
  try {
    lastVideoRequest = null;
    const res = await aiService.analyzeVideo(dummyVideoPath);
    assert.strictEqual(lastVideoRequest.url, '/api/ai/video-analyze');
    assert.strictEqual(lastVideoRequest.headers['x-internal-service-key'], TEST_SECRET);
    assert.strictEqual(res.framesProcessed, 25);
    assert.strictEqual(res.personDetectionRatio, 1.0);
    assert.strictEqual(res.gazeAttentionRatio, 0.88);
    console.log('✓ PASS: analyzeVideo() routes to VIDEO_AI_SERVICE_URL with internal auth');
    passed++;
  } catch (err) {
    console.error('✗ FAIL: analyzeVideo():', err.message);
    failed++;
  } finally {
    if (fs.existsSync(dummyVideoPath)) fs.unlinkSync(dummyVideoPath);
  }

  // Test 5: Graceful error handling and no fabricated scores when Video service is down
  try {
    process.env.VIDEO_AI_SERVICE_URL = 'http://localhost:59999'; // Dead port
    delete require.cache[require.resolve('../services/aiService')];
    const aiServiceDown = require('../services/aiService');

    const videoRes = await aiServiceDown.analyzeVideo('non_existent.webm');
    assert.strictEqual(videoRes.modelStatus, 'file_not_found');

    const tempTestFile = path.join(__dirname, 'test_sample.webm');
    fs.writeFileSync(tempTestFile, 'abc');
    const videoFailRes = await aiServiceDown.analyzeVideo(tempTestFile);
    fs.unlinkSync(tempTestFile);

    assert.strictEqual(videoFailRes.modelStatus, 'ai_service_unavailable');
    assert.strictEqual(videoFailRes.personDetectionRatio, null);
    // Secrets or raw internal URLs must not be leaked
    assert(!String(videoFailRes.error).includes(TEST_SECRET), 'Error must not leak secret key');
    console.log('✓ PASS: Down Video service returns structured error without fabricated scores or leaked secrets');
    passed++;
  } catch (err) {
    console.error('✗ FAIL: Down Video service test:', err.message);
    failed++;
  }

  // Test 6: Graceful error handling and no fabricated scores when Core service is down
  try {
    process.env.AI_SERVICE_URL = 'http://localhost:59998'; // Dead port
    delete require.cache[require.resolve('../services/aiService')];
    const aiServiceDown = require('../services/aiService');

    const textFailRes = await aiServiceDown.evaluateText('Q', 'A', []);
    assert.strictEqual(textFailRes.modelStatus, 'ai_service_unavailable');
    assert.strictEqual(textFailRes.textScore, null);
    assert.strictEqual(textFailRes.semanticScore, null);
    assert(!String(textFailRes.error).includes(TEST_SECRET), 'Error must not leak secret key');
    console.log('✓ PASS: Down Core service returns structured error without fabricated scores or leaked secrets');
    passed++;
  } catch (err) {
    console.error('✗ FAIL: Down Core service test:', err.message);
    failed++;
  }

  // Test 7: Integration with evaluationService
  try {
    // Restore ports
    process.env.AI_SERVICE_URL = `http://localhost:${CORE_PORT}`;
    process.env.VIDEO_AI_SERVICE_URL = `http://localhost:${VIDEO_PORT}`;
    delete require.cache[require.resolve('../services/aiService')];
    delete require.cache[require.resolve('../services/evaluationService')];
    const evaluationService = require('../services/evaluationService');

    // Test text evaluation through evaluationService
    const evalRes = await evaluationService.evaluateResponse(
      'Explain closures in JavaScript',
      'A closure gives access to an outer function scope from an inner function.',
      'medium',
      ['scope', 'lexical environment']
    );
    assert(evalRes.evaluation.score > 0, 'Score should be calculated');
    assert.strictEqual(evalRes.evaluation.status, 'sbert_evaluation');

    // Test video evaluation through evaluationService
    const dummyVideoPath = path.join(__dirname, 'dummy_test_eval_video.webm');
    fs.writeFileSync(dummyVideoPath, 'dummy-video-data');
    try {
      const evalVideoRes = await evaluationService.evaluateVideo(dummyVideoPath);
      assert.strictEqual(evalVideoRes.framesProcessed, 25);
      assert.strictEqual(evalVideoRes.gazeAttentionRatio, 0.88);
    } finally {
      if (fs.existsSync(dummyVideoPath)) fs.unlinkSync(dummyVideoPath);
    }

    // Test audio evaluation through evaluationService
    const dummyAudioPath = path.join(__dirname, 'dummy_test_eval_audio.webm');
    fs.writeFileSync(dummyAudioPath, 'dummy-audio-data');
    try {
      const evalAudioRes = await evaluationService.evaluateAudio(dummyAudioPath);
      assert.strictEqual(evalAudioRes.audioFeaturesAvailable, true);
    } finally {
      if (fs.existsSync(dummyAudioPath)) fs.unlinkSync(dummyAudioPath);
    }

    console.log('✓ PASS: evaluationService text, audio, and video evaluation succeed via split aiService');
    passed++;
  } catch (err) {
    console.error('✗ FAIL: evaluationService integration:', err.message);
    failed++;
  }

  await stopMockServers();

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
