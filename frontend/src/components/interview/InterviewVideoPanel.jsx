import { memo } from 'react'
import {
  Video, VideoOff, Mic, MicOff, User
} from 'lucide-react'
import VideoRecorder from '../VideoRecorder'
import './InterviewVideoPanel.css'

/**
 * Enterprise Camera Card
 *
 * Fixed 16:9 aspect ratio candidate camera feed.
 * Keeps VideoRecorder continuously mounted to preserve streams and blobs.
 * Compact, subtle recording indicators, zero bulky decorative frames.
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
    <div className="enterprise-camera-card glass-card">
      {/* ── Header: Candidate Name & Quiet Status ────────────────────── */}
      <div className="camera-header-row">
        <div className="camera-user-info">
          <User size={12} className="user-info-icon" />
          <span className="user-info-name" title={userName}>
            {userName}
          </span>
        </div>

        <div className="camera-status-pill-wrap">
          {videoEnabled && isRecording ? (
            <span className="rec-status-pill is-recording">
              <span className="rec-pulse-dot" />
              <span>REC</span>
            </span>
          ) : videoEnabled ? (
            <span className="rec-status-pill is-standby">
              <span className="standby-dot" />
              <span>Live</span>
            </span>
          ) : (
            <span className="rec-status-pill is-off">
              <span className="off-dot" />
              <span>Off</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Fixed 16:9 Viewport Container ────────────────────────────── */}
      <div className="camera-viewport-shell">
        <div className="camera-aspect-16-9">
          {/* Always mount VideoRecorder so ref and audio/video blob methods are active */}
          <div
            className="video-recorder-mount-node"
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

          {/* Clean Offline State when camera is turned off */}
          {!videoEnabled && (
            <div className="camera-offline-view animate-fade-in">
              <div className="offline-avatar-badge">
                <span>{userInitials}</span>
              </div>
              <span className="offline-note">Camera turned off</span>
              <button
                type="button"
                className="btn-enable-camera"
                onClick={onToggleVideo}
                disabled={disabled}
              >
                <Video size={11} />
                <span>Turn On Camera</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer Controls: Compact Camera & Mic Toggles ─────────────── */}
      <div className="camera-footer-controls">
        <div className="hardware-toggles-cluster">
          <button
            type="button"
            className={`btn-hw-toggle ${videoEnabled ? 'is-active' : 'is-inactive'}`}
            onClick={onToggleVideo}
            disabled={disabled}
            title={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
            aria-label={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
          >
            {videoEnabled ? <Video size={12} /> : <VideoOff size={12} />}
            <span>{videoEnabled ? 'Camera' : 'Cam Off'}</span>
          </button>

          <button
            type="button"
            className={`btn-hw-toggle ${isMicActive ? 'is-active' : 'is-inactive'}`}
            onClick={onToggleMic}
            disabled={disabled}
            title={isMicActive ? 'Mute microphone' : 'Unmute microphone'}
            aria-label={isMicActive ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isMicActive ? <Mic size={12} /> : <MicOff size={12} />}
            <span>{isMicActive ? 'Mic' : 'Muted'}</span>
          </button>
        </div>

        <span className="resolution-spec">16:9 HD</span>
      </div>
    </div>
  )
})

/**
 * Enterprise Unified Session & Guidelines Panel
 *
 * Compact, quiet right sidebar that supports the interview without visual competition.
 */
export const InterviewSignalsCard = memo(function InterviewSignalsCard({
  videoEnabled = true,
  isMicActive = true,
  speechStatus,
  targetSkill,
}) {
  return (
    <div className="enterprise-session-panel glass-card">
      {/* Session Diagnostics */}
      <div className="session-section-block">
        <div className="session-section-header">
          <span className="session-section-title">SESSION</span>
          <span className="session-status-badge">Active</span>
        </div>

        <div className="session-rows-list">
          <div className="session-item-row">
            <div className="item-row-left">
              <span className={`status-indicator-dot ${videoEnabled ? 'dot-green' : 'dot-muted'}`} />
              <span className="item-label">Camera analysis</span>
            </div>
            <span className="item-value">{videoEnabled ? 'Active' : 'Off'}</span>
          </div>

          <div className="session-item-row">
            <div className="item-row-left">
              <span className={`status-indicator-dot ${isMicActive ? 'dot-green' : 'dot-amber'}`} />
              <span className="item-label">Voice transcription</span>
            </div>
            <span className="item-value">
              {isMicActive
                ? speechStatus === 'recording'
                  ? 'Live'
                  : 'Ready'
                : 'Muted'}
            </span>
          </div>

          <div className="session-item-row">
            <div className="item-row-left">
              <span className="status-indicator-dot dot-green" />
              <span className="item-label">Adaptive sequence</span>
            </div>
            <span className="item-value" title={targetSkill || 'Active'}>
              {targetSkill ? targetSkill : 'Active'}
            </span>
          </div>
        </div>
      </div>

      <div className="session-divider-rule" />

      {/* Guidelines */}
      <div className="session-section-block">
        <div className="session-section-title">GUIDELINES</div>
        <ul className="guidelines-compact-list">
          <li>Keep camera eye-level for best visual analysis</li>
          <li>Speak naturally or type directly in the editor</li>
          <li>Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to submit your answer</li>
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
    <aside className="enterprise-video-panel" aria-label="Candidate Video & Session Monitoring">
      <InterviewCameraCard {...props} />
      <InterviewSignalsCard {...props} />
    </aside>
  )
}

export default memo(InterviewVideoPanel)
