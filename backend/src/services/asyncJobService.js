/**
 * Async Job Service - Phase 2 Performance Optimization
 *
 * Implements a lightweight in-process job queue for expensive AI operations
 * (audio, video analysis) so that HTTP responses return immediately while
 * ML processing continues in the background.
 *
 * Design constraints:
 *   - No Redis / BullMQ / separate paid infrastructure required
 *   - Compatible with Render free tier (single Node.js process)
 *   - Single worker per job type to prevent CPU/RAM overload
 *
 * Job states: queued -> processing -> completed | failed
 */

'use strict';

const { EventEmitter } = require('events');

// Structured logger - never logs secrets/tokens/answers
const log = (level, operation, data) => {
  const entry = { ts: new Date().toISOString(), level, op: operation, ...(data || {}) };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
};

// In-process job queue
class InProcessJobQueue extends EventEmitter {
  constructor(name, opts) {
    super();
    const options = opts || {};
    this.name = name;
    this.concurrency = options.concurrency || 1;
    this.maxRetries = options.maxRetries || 1;
    this._queue = [];
    this._active = 0;
    this._handlers = {};
  }

  process(type, fn) {
    this._handlers[type] = fn;
  }

  add(type, data, opts) {
    const options = opts || {};
    const job = {
      id: type + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      type: type,
      data: data,
      attempt: 0,
      maxRetries: options.maxRetries !== undefined ? options.maxRetries : this.maxRetries,
      addedAt: Date.now(),
    };
    this._queue.push(job);
    log('info', this.name + '.JOB_QUEUED', { jobId: job.id, type: type, queueLen: this._queue.length });
    setImmediate(() => this._drain());
    return job;
  }

  _drain() {
    while (this._active < this.concurrency && this._queue.length > 0) {
      const job = this._queue.shift();
      this._active += 1;
      this._run(job).finally(() => {
        this._active -= 1;
        this._drain();
      });
    }
  }

  async _run(job) {
    const handler = this._handlers[job.type];
    if (!handler) {
      log('error', this.name + '.NO_HANDLER', { jobId: job.id, type: job.type });
      this.emit('failed', job, new Error('No handler for job type: ' + job.type));
      return;
    }

    job.attempt += 1;
    const start = Date.now();
    log('info', this.name + '.JOB_START', { jobId: job.id, type: job.type, attempt: job.attempt });

    try {
      const result = await handler(job.data, job);
      const durationMs = Date.now() - start;
      log('info', this.name + '.JOB_DONE', { jobId: job.id, type: job.type, durationMs: durationMs });
      this.emit('completed', job, result);
    } catch (err) {
      const durationMs = Date.now() - start;
      log('error', this.name + '.JOB_FAILED', {
        jobId: job.id,
        type: job.type,
        attempt: job.attempt,
        error: err.message,
        durationMs: durationMs,
      });

      if (job.attempt < job.maxRetries) {
        const delay = 2000 * job.attempt;
        log('info', this.name + '.JOB_RETRY', { jobId: job.id, delayMs: delay });
        setTimeout(() => {
          this._queue.push(job);
          this._drain();
        }, delay);
      } else {
        this.emit('failed', job, err);
      }
    }
  }
}

// Singleton queues - concurrency=1 to avoid RAM overload on Render free tier
const videoQueue = new InProcessJobQueue('VideoQueue', { concurrency: 1, maxRetries: 1 });
const audioQueue = new InProcessJobQueue('AudioQueue', { concurrency: 1, maxRetries: 1 });

let _handlersRegistered = false;

function _ensureHandlers() {
  if (_handlersRegistered) return;
  _handlersRegistered = true;

  const Response = require('../models/Response');
  const Interview = require('../models/Interview');
  const { evaluateVideo, evaluateAudio } = require('./evaluationService');
  const { deleteFile } = require('../middleware/upload');

  // VIDEO HANDLER
  videoQueue.process('analyze_video', async function(data) {
    const responseId = data.responseId;
    const interviewId = data.interviewId;
    const videoPath = data.videoPath;
    const clerkUserId = data.clerkUserId;
    const reqId = 'vid_' + responseId;
    const start = Date.now();

    log('info', 'VIDEO_ANALYSIS.START', { requestId: reqId, responseId: responseId, interviewId: interviewId });

    try {
      const exists = await Response.exists({ _id: responseId, clerkUserId: clerkUserId });
      if (!exists) {
        log('error', 'VIDEO_ANALYSIS.RESPONSE_NOT_FOUND', { requestId: reqId, responseId: responseId });
        deleteFile(videoPath);
        return;
      }

      // Mark as processing
      await Response.updateOne(
        { _id: responseId },
        { $set: { 'videoEvaluation.modelStatus': 'processing' } }
      );

      const videoResult = await evaluateVideo(videoPath);
      const durationMs = Date.now() - start;

      const videoEval = {
        framesProcessed: videoResult.framesProcessed != null ? videoResult.framesProcessed : 0,
        personDetectionRatio: videoResult.personDetectionRatio != null ? videoResult.personDetectionRatio : null,
        faceVisibilityRatio: videoResult.faceVisibilityRatio != null ? videoResult.faceVisibilityRatio : null,
        gazeAttentionRatio: videoResult.gazeAttentionRatio != null ? videoResult.gazeAttentionRatio : null,
        postureStability: videoResult.postureStability || null,
        postureStabilityIndex: videoResult.postureStabilityIndex != null ? videoResult.postureStabilityIndex : null,
        postureScore: videoResult.postureScore != null ? videoResult.postureScore : null,
        shoulderTiltDegrees: videoResult.shoulderTiltDegrees != null ? videoResult.shoulderTiltDegrees : null,
        cameraEngagement: videoResult.cameraEngagement || null,
        observableMetrics: videoResult.metrics || videoResult.observableMetrics || null,
        videoQualityIndicator: videoResult.videoQualityIndicator || null,
        // Preserve terminal failures returned by the AI service so the results
        // page can distinguish "failed/unavailable" from a queued job.
        modelStatus: videoResult.modelStatus || 'processed',
        processingConfidence: videoResult.processingConfidence != null ? videoResult.processingConfidence : null,
        visibleMovement: videoResult.metrics && videoResult.metrics.movement_stability_index != null
          ? (videoResult.metrics.movement_stability_index >= 80 ? 'stable' : 'visible_movement')
          : null,
        feedback: videoResult.feedback || (videoResult.metrics && videoResult.metrics.observable_observations ? videoResult.metrics.observable_observations.join(' ') : null) || null,
      };

      await Response.updateOne(
        { _id: responseId },
        { $set: { videoEvaluation: videoEval } }
      );

      log('info', 'VIDEO_ANALYSIS.DONE', {
        requestId: reqId,
        responseId: responseId,
        framesProcessed: videoEval.framesProcessed,
        personDetectionRatio: videoEval.personDetectionRatio,
        durationMs: durationMs,
      });

      // Recompute final evaluation for the interview if it's completed
      const interview = await Interview.findOne({ _id: interviewId, clerkUserId: clerkUserId }).lean();
      if (interview && interview.status === 'completed') {
        const { computeAndPersistFinalEvaluation } = require('../controllers/interviewController');
        await computeAndPersistFinalEvaluation(interview, clerkUserId);
        log('info', 'VIDEO_ANALYSIS.FINAL_EVAL_UPDATED', { requestId: reqId, interviewId: interviewId });
      }
    } catch (err) {
      log('error', 'VIDEO_ANALYSIS.ERROR', { requestId: reqId, responseId: responseId, error: err.message });
      try {
        await Response.updateOne(
          { _id: responseId },
          { $set: { 'videoEvaluation.modelStatus': 'analysis_failed' } }
        );
      } catch (_e) { /* best-effort */ }
      throw err;
    } finally {
      deleteFile(videoPath);
    }
  });

  videoQueue.on('failed', function(job, err) {
    log('error', 'VideoQueue.PERMANENTLY_FAILED', { jobId: job.id, error: err.message });
  });

  // AUDIO HANDLER
  audioQueue.process('analyze_audio', async function(data) {
    const responseId = data.responseId;
    const interviewId = data.interviewId;
    const audioPath = data.audioPath;
    const clerkUserId = data.clerkUserId;
    const reqId = 'aud_' + responseId;
    const start = Date.now();

    log('info', 'AUDIO_ANALYSIS.START', { requestId: reqId, responseId: responseId, interviewId: interviewId });

    try {
      await Response.updateOne(
        { _id: responseId },
        { $set: { 'audioEvaluation.modelStatus': 'processing' } }
      );

      const audioResult = await evaluateAudio(audioPath);
      const durationMs = Date.now() - start;

      const audioEval = {
        speakingDuration: audioResult.speakingDuration || null,
        pauseDuration: audioResult.pauseDuration || null,
        speechRate: audioResult.speechRate || null,
        mfccSummary: audioResult.mfccSummary || null,
        energyCharacteristics: audioResult.energyCharacteristics || null,
        pitchStatistics: audioResult.pitchStatistics || null,
        audioFeaturesAvailable: audioResult.audioFeaturesAvailable || false,
        // Preserve terminal failures returned by the AI service so the results
        // page can distinguish "failed/unavailable" from a queued job.
        modelStatus: audioResult.modelStatus || 'processed',
      };

      await Response.updateOne(
        { _id: responseId },
        { $set: { audioEvaluation: audioEval } }
      );

      log('info', 'AUDIO_ANALYSIS.DONE', {
        requestId: reqId,
        responseId: responseId,
        speakingDuration: audioEval.speakingDuration,
        durationMs: durationMs,
      });

      const interview = await Interview.findOne({ _id: interviewId, clerkUserId: clerkUserId }).lean();
      if (interview && interview.status === 'completed') {
        const { computeAndPersistFinalEvaluation } = require('../controllers/interviewController');
        await computeAndPersistFinalEvaluation(interview, clerkUserId);
      }
    } catch (err) {
      log('error', 'AUDIO_ANALYSIS.ERROR', { requestId: reqId, responseId: responseId, error: err.message });
      try {
        await Response.updateOne(
          { _id: responseId },
          { $set: { 'audioEvaluation.modelStatus': 'analysis_failed' } }
        );
      } catch (_e) { /* best-effort */ }
      throw err;
    } finally {
      deleteFile(audioPath);
    }
  });

  audioQueue.on('failed', function(job, err) {
    log('error', 'AudioQueue.PERMANENTLY_FAILED', { jobId: job.id, error: err.message });
  });
}

/**
 * Enqueue an async video analysis job.
 * Returns job ID immediately. The response document is updated when analysis completes.
 */
function enqueueVideoJob(opts) {
  _ensureHandlers();
  const job = videoQueue.add('analyze_video', {
    responseId: opts.responseId,
    interviewId: opts.interviewId,
    videoPath: opts.videoPath,
    clerkUserId: opts.clerkUserId,
  });
  return job.id;
}

/**
 * Enqueue an async audio analysis job.
 * Returns job ID immediately.
 */
function enqueueAudioJob(opts) {
  _ensureHandlers();
  const job = audioQueue.add('analyze_audio', {
    responseId: opts.responseId,
    interviewId: opts.interviewId,
    audioPath: opts.audioPath,
    clerkUserId: opts.clerkUserId,
  });
  return job.id;
}

/**
 * Get current queue depths for monitoring.
 */
function getQueueStats() {
  return {
    video: { queued: videoQueue._queue.length, active: videoQueue._active },
    audio: { queued: audioQueue._queue.length, active: audioQueue._active },
  };
}

module.exports = {
  enqueueVideoJob,
  enqueueAudioJob,
  getQueueStats,
};
