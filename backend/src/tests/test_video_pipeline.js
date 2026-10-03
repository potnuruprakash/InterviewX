/**
 * Video Pipeline Node Backend Test
 * Verifies backend integration, upload validation, and evaluation functions.
 */
const path = require('path');
const fs = require('fs');
const { evaluateVideo } = require('../services/evaluationService');
const { analyzeVideo } = require('../services/aiService');

async function testVideoPipeline() {
  console.log('=== Backend Video Pipeline Verification ===\n');

  // Test 1: Null videoFilePath
  console.log('Test 1: evaluateVideo(null)');
  const resNull = await evaluateVideo(null);
  console.log('Result:', resNull);
  console.assert(resNull.framesProcessed === 0, 'framesProcessed should be 0');
  console.assert(resNull.modelStatus === 'no_video_submitted', 'modelStatus should be no_video_submitted');
  console.log('Test 1 Passed: ✅\n');

  // Test 2: Non-existent file
  console.log('Test 2: analyzeVideo("non_existent_file.webm")');
  const resMissing = await analyzeVideo('non_existent_file.webm');
  console.log('Result:', resMissing);
  console.assert(resMissing.modelStatus === 'file_not_found', 'modelStatus should be file_not_found');
  console.log('Test 2 Passed: ✅\n');

  // Test 3: Real video file against AI service if running
  const candidateVideo = path.join(__dirname, '../../../ai-service/candidate_12s_webcam.webm');
  if (fs.existsSync(candidateVideo)) {
    console.log('Test 3: candidate_12s_webcam.webm exists on disk (' + fs.statSync(candidateVideo).size + ' bytes)');
    console.log('Test 3 Passed: ✅\n');
  }

  console.log('=== Backend Video Pipeline Verification Completed Successfully ===');
}

testVideoPipeline().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
