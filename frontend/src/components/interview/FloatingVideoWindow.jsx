import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { Video, VideoOff, Mic, MicOff, Minus, Maximize2, Minimize2, ExternalLink } from 'lucide-react'
import VideoRecorder from '../VideoRecorder'
import './FloatingVideoWindow.css'

/**
 * Enterprise Candidate Camera Window
 *
 * - Dedicated docked mode (default) in the right sidebar — non-overlapping, content-aligned
 * - Optional pop-out floating mode with pointer-event dragging and strict viewport clamping
 * - 16:9 aspect ratio HD viewport
 * - Camera and Mic toggle controls
 * - Continuous VideoRecorder mounting (never unmounted, preserving media stream & recorder ref)
 * - Minimizable into a sleek status pill/strip
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
  const [isFloating, setIsFloating] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPosition] = useState({ x: 800, y: 76 })
  const [isDragging, setIsDragging] = useState(false)

  const cardRef = useRef(null)
  const pillRef = useRef(null)
  const dragStartRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 })
  const isDraggingRef = useRef(false)

  const userInitials = (userName || 'Candidate')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'C'

  // Initialize floating position near top right of workspace when switching to float
  const handleToggleFloat = useCallback(() => {
    setIsFloating((prev) => {
      const next = !prev
      if (next && typeof window !== 'undefined') {
        const winW = window.innerWidth
        const cardW = 320
        setPosition({
          x: Math.max(16, winW - cardW - 24),
          y: 76,
        })
      }
      return next
    })
  }, [])

  // Clamp position on window resize when in floating mode
  useEffect(() => {
    if (!isFloating) return

    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return prev
        const winW = window.innerWidth
        const winH = window.innerHeight
        const elem = isMinimized ? pillRef.current : cardRef.current
        const w = elem?.offsetWidth || 320
        const h = elem?.offsetHeight || 220
        const minTop = 64
        const minLeft = 8
        const maxLeft = Math.max(minLeft, winW - w - 8)
        const maxTop = Math.max(minTop, winH - h - 8)

        return {
          x: Math.max(minLeft, Math.min(prev.x, maxLeft)),
          y: Math.max(minTop, Math.min(prev.y, maxTop)),
        }
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isFloating, isMinimized])

  // ── Drag Handlers (Header bar only in floating mode) ──────────────────────
  const handlePointerDown = (e) => {
    if (!isFloating) return
    if (e.button !== undefined && e.button !== 0) return

    e.preventDefault()
    const currentPos = position || { x: 800, y: 76 }
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: currentPos.x,
      origY: currentPos.y,
    }
    isDraggingRef.current = true
    setIsDragging(true)

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
  }

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current || !isFloating) return

    const deltaX = e.clientX - dragStartRef.current.startX
    const deltaY = e.clientY - dragStartRef.current.startY

    const winW = window.innerWidth
    const winH = window.innerHeight
    const elem = cardRef.current
    const cardW = elem?.offsetWidth || 320
    const cardH = elem?.offsetHeight || 220

    const minTop = 64
    const minLeft = 8
    const maxLeft = Math.max(minLeft, winW - cardW - 8)
    const maxTop = Math.max(minTop, winH - cardH - 8)

    const rawX = dragStartRef.current.origX + deltaX
    const rawY = dragStartRef.current.origY + deltaY

    const clampedX = Math.max(minLeft, Math.min(rawX, maxLeft))
    const clampedY = Math.max(minTop, Math.min(rawY, maxTop))

    setPosition({ x: Math.round(clampedX), y: Math.round(clampedY) })
  }

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    setIsDragging(false)

    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
  }

  return (
    <>
      {/* ── Minimized Pill View ────────────────────────────────────────── */}
      {isMinimized && (
        <div
          ref={pillRef}
          className={`floating-cam-pill animate-fade-in ${isFloating ? 'is-floating' : 'is-docked'}`}
          style={isFloating && position ? { left: `${position.x}px`, top: `${position.y}px` } : undefined}
          onClick={() => setIsMinimized(false)}
          role="button"
          tabIndex={0}
          title="Candidate camera minimized — click to restore preview"
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
          <span className="pill-cam-status">{videoEnabled ? 'Live' : 'Muted'}</span>
          <Maximize2 size={13} className="pill-restore-icon" />
        </div>
      )}

      {/* ── Primary Video Card (Docked in right sidebar or Floating) ────── */}
      <div
        ref={cardRef}
        className={`floating-video-card glass-card ${isFloating ? 'is-floating' : 'is-docked'} ${
          isDragging ? 'is-dragging' : ''
        }`}
        style={
          isFloating
            ? {
                display: isMinimized ? 'none' : 'flex',
                left: position ? `${position.x}px` : undefined,
                top: position ? `${position.y}px` : undefined,
              }
            : {
                display: isMinimized ? 'none' : 'flex',
              }
        }
        role="region"
        aria-label="Candidate camera view"
      >
        {/* Header Bar */}
        <div
          className={`fvw-header-bar ${isFloating ? 'is-draggable' : ''} ${isDragging ? 'is-dragging' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          title={isFloating ? 'Drag to reposition camera' : undefined}
        >
          <div className="fvw-info-left">
            {videoEnabled && isRecording ? (
              <span className="fvw-rec-badge" title="Recording active for AI multimodal analysis">
                <span className="fvw-rec-dot" />
                <span>REC</span>
              </span>
            ) : videoEnabled ? (
              <span className="fvw-live-badge" title="Live camera feed active">
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
            {/* Pop-Out Float / Dock Back Toggle */}
            <button
              type="button"
              className="fvw-action-icon-btn"
              onClick={handleToggleFloat}
              onPointerDown={(e) => e.stopPropagation()}
              title={isFloating ? 'Dock back to sidebar' : 'Pop out floating window'}
              aria-label={isFloating ? 'Dock back to sidebar' : 'Pop out floating window'}
            >
              {isFloating ? <Minimize2 size={13} /> : <ExternalLink size={13} />}
            </button>

            {/* Minimize Window */}
            <button
              type="button"
              className="fvw-action-icon-btn"
              onClick={() => setIsMinimized(true)}
              onPointerDown={(e) => e.stopPropagation()}
              title="Minimize camera view"
              aria-label="Minimize camera view"
            >
              <Minus size={14} />
            </button>
          </div>
        </div>

        {/* 16:9 Aspect Ratio Video Viewport */}
        <div className="fvw-viewport-box">
          <div className="fvw-aspect-16-9">
            {/* Continuously mounted VideoRecorder so ref and stream are never interrupted */}
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

            {/* Offline Fallback when camera is disabled */}
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
    </>
  )
}

export default memo(FloatingVideoWindow)
