import { memo } from 'react'
import {
  Video, VideoOff, Mic, MicOff, User, Sparkles, Shield, Eye
} from 'lucide-react'
import VideoRecorder from '../VideoRecorder'
import './InterviewVideoPanel.css'

/**
 * InterviewCameraCard Component
 *
 * Fixed 16:9 aspect ratio candidate camera view.
 * Embeds VideoRecorder without layout shifting.
 */
export const InterviewCameraCard = memo(function InterviewCameraCard({
  userName = 'Candidate',
  videoEnabled = true,
  onToggleVideo,
  isMicActive = true,
  onToggleMic,
  isRecording = false,
  onVideoBlob,
  videoRecorderRef,
  disabled = false,
}) {
  const userInitials = (userName || 'Candidate')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'C'

  return (
    <div className="ivp-camera-card glass-card">
      {/* Header: Candidate Info & Recording Status */}
      <div className="ivp-camera-header">
        <div className="ivp-user-label">
          <User size={13} className="ivp-user-icon" />
          <span className="ivp-user-name" title={userName}>
            {userName}
          </span>
        </div>

        {/* Live Recording Badge */}
        <div className="ivp-status-badge">
          {videoEnabled && isRecording ? (
            <span className="rec-badge rec-live" title="Video recording in progress">
              <span className="rec-dot-pulse" />
              <span>REC</span>
            </span>
          ) : videoEnabled ? (
            <span className="rec-badge rec-standby" title="Camera stream active">
              <span className="rec-dot-idle" />
              <span>Live Feed</span>
            </span>
          ) : (
            <span className="rec-badge rec-disabled" title="Camera turned off">
              <span className="rec-dot-off" />
              <span>Camera Off</span>
            </span>
          )}
        </div>
      </div>

      {/* 16:9 Stable Camera Viewport */}
      <div className="ivp-viewport-container">
        <div className="ivp-aspect-ratio-box">
          {/* Always keep VideoRecorder mounted so its ref and streams are not lost */}
          <div
            className="ivp-video-recorder-mount"
            style={{ display: videoEnabled ? 'block' : 'none' }}
          >
            <VideoRecorder
              ref={videoRecorderRef}
              isRecording={isRecording && videoEnabled}
              onRecordingComplete={onVideoBlob}
              disabled={disabled}
              autoStartStream={true}
            />
          </div>

          {/* Offline Avatar Viewport when video is disabled */}
          {!videoEnabled && (
            <div className="ivp-camera-off-state animate-fade-in">
              <div className="ivp-avatar-circle">
                <span className="ivp-avatar-text">{userInitials}</span>
              </div>
              <span className="ivp-camera-off-label">Camera is turned off</span>
              <button
                type="button"
                className="btn btn-ghost btn-xs ivp-enable-cam-btn"
                onClick={onToggleVideo}
                disabled={disabled}
              >
                <Video size={12} />
                <span>Turn On Camera</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Camera & Mic Controls Toolbar */}
      <div className="ivp-camera-footer">
        <div className="ivp-toggle-group">
          {/* Camera Toggle */}
          <button
            type="button"
            className={`ivp-control-btn ${videoEnabled ? 'is-active' : 'is-off'}`}
            onClick={onToggleVideo}
            disabled={disabled}
            title={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
            aria-label={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
          >
            {videoEnabled ? <Video size={13} /> : <VideoOff size={13} />}
            <span>{videoEnabled ? 'Camera' : 'Cam Off'}</span>
          </button>

          {/* Mic Toggle */}
          <button
            type="button"
            className={`ivp-control-btn ${isMicActive ? 'is-active' : 'is-muted'}`}
            onClick={onToggleMic}
            disabled={disabled}
            title={isMicActive ? 'Mute microphone' : 'Unmute microphone'}
            aria-label={isMicActive ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isMicActive ? <Mic size={13} /> : <MicOff size={13} />}
            <span>{isMicActive ? 'Mic Active' : 'Muted'}</span>
          </button>
        </div>

        <div className="ivp-resolution-tag" title="HD 16:9 Standard Video Capture">
          <span>HD 16:9</span>
        </div>
      </div>
    </div>
  )
})

/**
 * InterviewSignalsCard Component
 *
 * Real-time multimodal signals and candidate guidance tips.
 */
export const InterviewSignalsCard = memo(function InterviewSignalsCard({
  videoEnabled = true,
  isMicActive = true,
  speechStatus,
  targetSkill,
}) {
  return (
    <div className="ivp-signals-card glass-card">
      <div className="ivp-signals-header">
        <span className="ivp-signals-title">Session Signals</span>
        <span className="ivp-signals-badge">AI Active</span>
      </div>

      {/* Signal Indicators List */}
      <div className="ivp-signals-list">
        <div className="ivp-signal-row">
          <div className="ivp-signal-icon-box signal-blue">
            <Eye size={13} />
          </div>
          <div className="ivp-signal-content">
            <span className="ivp-signal-name">Vision Analysis</span>
            <span className="ivp-signal-status">
              {videoEnabled ? 'YOLO & MediaPipe tracking' : 'Camera disabled'}
            </span>
          </div>
          <span className={`signal-status-dot ${videoEnabled ? 'status-green' : 'status-gray'}`} />
        </div>

        <div className="ivp-signal-row">
          <div className="ivp-signal-icon-box signal-purple">
            <Mic size={13} />
          </div>
          <div className="ivp-signal-content">
            <span className="ivp-signal-name">Voice & Transcription</span>
            <span className="ivp-signal-status">
              {isMicActive
                ? speechStatus === 'recording'
                  ? 'Transcribing live...'
                  : 'Automatic STT active'
                : 'Microphone muted'}
            </span>
          </div>
          <span className={`signal-status-dot ${isMicActive ? 'status-green' : 'status-amber'}`} />
        </div>

        <div className="ivp-signal-row">
          <div className="ivp-signal-icon-box signal-emerald">
            <Shield size={13} />
          </div>
          <div className="ivp-signal-content">
            <span className="ivp-signal-name">Adaptive Sequence</span>
            <span className="ivp-signal-status">
              {targetSkill ? `Skill: ${targetSkill}` : 'Dynamic difficulty active'}
            </span>
          </div>
          <span className="signal-status-dot status-green" />
        </div>
      </div>

      {/* Quick Best Practices Tips */}
      <div className="ivp-tips-box">
        <div className="ivp-tip-title">
          <Sparkles size={12} className="ivp-tip-sparkle" />
          <span>Workspace Guidelines</span>
        </div>
        <ul className="ivp-tips-list">
          <li>Keep camera eye-level for accurate posture metrics.</li>
          <li>Spoken answers transcribe live into your answer box.</li>
          <li>Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to submit your answer.</li>
        </ul>
      </div>
    </div>
  )
})

/**
 * Default Combined Right Panel
 */
function InterviewVideoPanel(props) {
  return (
    <aside className="interview-video-panel" aria-label="Candidate Video & Session Monitoring">
      <InterviewCameraCard {...props} />
      <InterviewSignalsCard {...props} />
    </aside>
  )
}

export default memo(InterviewVideoPanel)
