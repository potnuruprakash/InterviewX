'use strict';

const assert = require('assert');
const {
  _assertAudioAnalysisSucceeded,
  _assertVideoAnalysisSucceeded,
} = require('../services/asyncJobService');

function rejects(fn, message) {
  assert.throws(fn, message);
}

// Audio: accept a real feature extraction result even when the downstream
// speech model itself is marked not_trained; observable features are available.
_assertAudioAnalysisSucceeded({
  modelStatus: 'not_trained',
  audioFeaturesAvailable: true,
  speakingDuration: 12.4,
});

// Audio failures must not be treated as completed jobs.
rejects(() => _assertAudioAnalysisSucceeded({
  modelStatus: 'ai_service_unavailable',
  audioFeaturesAvailable: false,
}));
rejects(() => _assertAudioAnalysisSucceeded({
  modelStatus: 'timed_out',
  audioFeaturesAvailable: false,
}));
rejects(() => _assertAudioAnalysisSucceeded({
  modelStatus: 'processed',
  audioFeaturesAvailable: false,
}));
rejects(() => _assertAudioAnalysisSucceeded(null));

// Video: only results with actual processed frames are accepted.
_assertVideoAnalysisSucceeded({
  modelStatus: 'analyzed',
  framesProcessed: 8,
});
rejects(() => _assertVideoAnalysisSucceeded({
  modelStatus: 'ai_service_unavailable',
  framesProcessed: 0,
}));
rejects(() => _assertVideoAnalysisSucceeded({
  modelStatus: 'analyzed',
  framesProcessed: 0,
}));
rejects(() => _assertVideoAnalysisSucceeded({
  modelStatus: 'timed_out',
  framesProcessed: 8,
}));
rejects(() => _assertVideoAnalysisSucceeded(undefined));

console.log('Media analysis result guards: all tests passed');
