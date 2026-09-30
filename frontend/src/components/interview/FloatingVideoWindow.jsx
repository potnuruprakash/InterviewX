import { useState, memo } from 'react'
import {
  Video, VideoOff, Mic, MicOff, Minus, Maximize2,
  Minimize2
} from 'lucide-react'
import VideoRecorder from '../VideoRecorder'
import './FloatingVideoWindow.css'

/**
 * Enterprise Floating Video Window Component
 *
 * Anchored in the upper-right of the Question Card workspace.
 * - 16:9 aspect ratio
 * - Fixed/compact width (approx 320–360px on desktop)
 * - Minimizable into a floating compact pill
 * - Fullscreen preview expansion modal
 * - Continuous VideoRecorder mounting (never loses ref or media stream)
 * - Camera & Mic toggle controls with REC indicator
 */
function FloatingVideoWindow({
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
  const [isMinimized, setIsMinimized] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const userInitials = (userName || 'Candidate')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'C'

  return (
    <>
      {/* ── Minimized Floating Pill View ────────────────────────────── */}
      {isMinimized && (
        <div
          className="floating-cam-pill animate-fade-in"
          onClick={() => setIsMinimized(false)}
          role="button"
          tabIndex={0}
          title="Candidate camera minimized — click to restore"
          aria-label="Restore camera preview"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setIsMinimized(false)
          }}
        >
          <div className="pill-dot-status">
            {videoEnabled && isRecording ? (
              <span className="pill-rec-pulse" />
            ) : (
              <span className={`pill-dot ${videoEnabled ? 'is-live' : 'is-off'}`} />
            )}
          </div>
          <span className="pill-user-name">{userName}</span>
          <Maximize2 size={12} className="pill-restore-icon" />
        </div>
      )}

      {/* ── Standard Floating Video Window ─────────────────────────── */}
      <div
        className={`floating-video-card glass-card ${isFullscreen ? 'is-fullscreen-modal' : ''}`}
        style={{ display: isMinimized ? 'none' : 'flex' }}
        role="region"
        aria-label="Candidate camera view"
      >
        {/* Header: Candidate Info, REC status, Window Controls */}
        <div className="fvw-header-bar">
          <div className="fvw-info-left">
            {videoEnabled && isRecording ? (
              <span className="fvw-rec-badge" title="Recording active for analysis">
                <span className="fvw-rec-dot" />
                <span>REC</span>
              </span>
            ) : videoEnabled ? (
              <span className="fvw-live-badge" title="Live camera feed">
                <span className="fvw-live-dot" />
                <span>Live</span>
              </span>
            ) : (
              <span className="fvw-off-badge" title="Camera disabled">
                <span className="fvw-off-dot" />
                <span>Off</span>
              </span>
            )}
            <span className="fvw-user-tag" title={userName}>
              {userName}
            </span>
          </div>

          <div className="fvw-window-actions">
            {/* Fullscreen Preview Toggle */}
            <button
              type="button"
              className="fvw-action-icon-btn"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit full camera preview' : 'Expand camera preview'}
              aria-label={isFullscreen ? 'Exit full camera preview' : 'Expand camera preview'}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>

            {/* Minimize Window */}
            {!isFullscreen && (
              <button
                type="button"
                className="fvw-action-icon-btn"
                onClick={() => setIsMinimized(true)}
                title="Minimize camera view"
                aria-label="Minimize camera view"
              >
                <Minus size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 16:9 Aspect Ratio Video Viewport */}
        <div className="fvw-viewport-box">
          <div className="fvw-aspect-16-9">
            {/* Always keep VideoRecorder mounted so ref and streams are NEVER lost */}
            <div
              className="fvw-recorder-mount"
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

            {/* Offline Avatar Viewport when video is turned off */}
            {!videoEnabled && (
              <div className="fvw-avatar-fallback animate-fade-in">
                <div className="fallback-avatar-circle">
                  <span>{userInitials}</span>
                </div>
                <span className="fallback-note">Camera turned off</span>
                <button
                  type="button"
                  className="btn-enable-cam-inline"
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

        {/* Footer: Hardware Controls & Resolution */}
        <div className="fvw-footer-bar">
          <div className="fvw-hw-buttons">
            {/* Camera Toggle */}
            <button
              type="button"
              className={`fvw-btn-toggle ${videoEnabled ? 'is-on' : 'is-muted'}`}
              onClick={onToggleVideo}
              disabled={disabled}
              title={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
              aria-label={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
            >
              {videoEnabled ? <Video size={12} /> : <VideoOff size={12} />}
              <span>{videoEnabled ? 'Camera' : 'Cam Off'}</span>
            </button>

            {/* Mic Toggle */}
            <button
              type="button"
              className={`fvw-btn-toggle ${isMicActive ? 'is-on' : 'is-muted'}`}
              onClick={onToggleMic}
              disabled={disabled}
              title={isMicActive ? 'Mute microphone' : 'Unmute microphone'}
              aria-label={isMicActive ? 'Mute microphone' : 'Unmute microphone'}
            >
              {isMicActive ? <Mic size={12} /> : <MicOff size={12} />}
              <span>{isMicActive ? 'Mic' : 'Muted'}</span>
            </button>
          </div>

          <span className="fvw-aspect-spec">16:9 HD</span>
        </div>
      </div>

      {/* Fullscreen Backdrop when in modal mode */}
      {isFullscreen && (
        <div
          className="fvw-modal-backdrop animate-fade-in"
          onClick={() => setIsFullscreen(false)}
        />
      )}
    </>
  )
}

export default memo(FloatingVideoWindow)
