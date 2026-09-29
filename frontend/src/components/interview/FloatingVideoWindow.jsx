import { useState, useEffect, useRef, useCallback, memo } from 'react'
import {
  Video, VideoOff, Mic, MicOff, Minus, Maximize2,
  Move, AlertCircle, CornerDownRight, User
} from 'lucide-react'
import VideoRecorder from '../VideoRecorder'
import './FloatingVideoWindow.css'

/**
 * FloatingVideoWindow Component
 *
 * Professional candidate self-view window:
 * - Default position: bottom-right
 * - Smoothly draggable & snappable to corners (bottom-right, bottom-left, top-right, top-left)
 * - 16:9 aspect ratio, 220–280px width
 * - Minimizable into a floating compact bubble
 * - Professional avatar placeholder when camera is off
 * - Non-blocking camera permission handling
 * - Audio & video state synchronization for multimodal evaluation
 */
function FloatingVideoWindow({
  interviewId,
  userName = 'Candidate',
  videoEnabled = true,
  onToggleVideo,
  isMicActive = true,
  onToggleMic,
  isRecording = false,
  onVideoBlob,
  videoRecorderRef,
  speechError = null,
  disabled = false,
}) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [cameraPermissionError, setCameraPermissionError] = useState(false)

  // Standard 16:9 dimensions (260px wide, ~146px high + header/footer bar)
  const windowWidth = 260
  const windowHeight = 180

  const storageKey = `interviewx_cam_pos_${interviewId || 'session'}`

  // Corner anchor positions calculation
  const getCornerPosition = useCallback((corner) => {
    const margin = 20
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1280
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800

    switch (corner) {
      case 'top-left':
        return { x: margin, y: 75 } // Below topbar
      case 'top-right':
        return { x: Math.max(margin, winW - windowWidth - margin), y: 75 }
      case 'bottom-left':
        return { x: margin, y: Math.max(margin, winH - windowHeight - margin) }
      case 'bottom-right':
      default:
        return {
          x: Math.max(margin, winW - windowWidth - margin),
          y: Math.max(margin, winH - windowHeight - margin),
        }
    }
  }, [windowWidth, windowHeight])

  // Initial position from sessionStorage or default bottom-right
  const [position, setPosition] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed
        }
      }
    } catch (e) {
      /* ignore storage read error */
    }
    return getCornerPosition('bottom-right')
  })

  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const windowRef = useRef(null)

  // Clamp within viewport
  const clampPosition = useCallback((x, y, w, h) => {
    const margin = 12
    const minTop = 64 // keep below interview topbar
    const maxX = Math.max(margin, window.innerWidth - w - margin)
    const maxY = Math.max(minTop, window.innerHeight - h - margin)

    return {
      x: Math.min(Math.max(x, margin), maxX),
      y: Math.min(Math.max(y, minTop), maxY),
    }
  }, [])

  // Keep inside viewport on window resize
  useEffect(() => {
    const handleResize = () => {
      const curW = isMinimized ? 56 : windowWidth
      const curH = isMinimized ? 56 : windowHeight
      setPosition((prev) => clampPosition(prev.x, prev.y, curW, curH))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [clampPosition, isMinimized, windowWidth, windowHeight])

  // Save coordinates to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(position))
    } catch (e) {
      /* ignore */
    }
  }, [position, storageKey])

  // Pointer drag events
  const handlePointerDown = (e) => {
    if (e.target.closest('button') || e.target.closest('.fvw-control-btn')) {
      return
    }

    e.preventDefault()
    const clientX = e.clientX
    const clientY = e.clientY

    dragOffsetRef.current = {
      x: clientX - position.x,
      y: clientY - position.y,
    }

    setIsDragging(true)
    if (windowRef.current?.setPointerCapture) {
      try {
        windowRef.current.setPointerCapture(e.pointerId)
      } catch (err) {}
    }
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return
    e.preventDefault()

    const rawX = e.clientX - dragOffsetRef.current.x
    const rawY = e.clientY - dragOffsetRef.current.y
    const curW = isMinimized ? 56 : windowWidth
    const curH = isMinimized ? 56 : windowHeight

    setPosition(clampPosition(rawX, rawY, curW, curH))
  }

  const handlePointerUp = (e) => {
    if (!isDragging) return
    setIsDragging(false)
    if (windowRef.current?.releasePointerCapture) {
      try {
        windowRef.current.releasePointerCapture(e.pointerId)
      } catch (err) {}
    }
  }

  // Quick snap to predefined corner
  const snapToCorner = (corner, e) => {
    e?.stopPropagation()
    const nextPos = getCornerPosition(corner)
    setPosition(nextPos)
  }

  const userInitials = (userName || 'You')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'U'

  // Minimized Compact Bubble View
  if (isMinimized) {
    return (
      <div
        ref={windowRef}
        className={`floating-video-bubble ${isDragging ? 'is-dragging' : ''}`}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={() => !isDragging && setIsMinimized(false)}
        role="button"
        tabIndex={0}
        aria-label="Restore candidate video window"
        title="Candidate camera minimized — click to restore"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsMinimized(false)
          }
        }}
      >
        <div className="bubble-avatar">
          {videoEnabled && !cameraPermissionError ? (
            <Video size={16} className="bubble-cam-icon live" />
          ) : (
            <span className="bubble-initials">{userInitials}</span>
          )}
        </div>
        <div className="bubble-status-dots">
          <span className={`status-pip ${videoEnabled ? 'active' : 'off'}`} title={videoEnabled ? 'Camera on' : 'Camera off'} />
          <span className={`status-pip ${isMicActive ? 'active' : 'muted'}`} title={isMicActive ? 'Mic on' : 'Mic muted'} />
        </div>
      </div>
    )
  }

  // Full Floating Video Window
  return (
    <div
      ref={windowRef}
      className={`floating-video-window ${isDragging ? 'is-dragging' : ''}`}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        width: `${windowWidth}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="region"
      aria-label="Candidate floating camera view"
      id="floating-candidate-video-window"
    >
      {/* ── Window Top Bar ────────────────────────────────────────────── */}
      <div className="fvw-header">
        <div className="fvw-title-group">
          <span className="fvw-drag-handle" title="Drag to reposition window">
            <Move size={12} />
          </span>
          <span className="fvw-title">You</span>
        </div>

        {/* Window Controls */}
        <div className="fvw-actions">
          {/* Quick Corner Snap Dropdown/Cycle */}
          <button
            type="button"
            className="fvw-control-btn"
            onClick={(e) => {
              // Cycle to next corner: bottom-right -> bottom-left -> top-left -> top-right -> bottom-right
              const winW = window.innerWidth
              const isRight = position.x > winW / 2
              const isBottom = position.y > window.innerHeight / 2
              if (isRight && isBottom) snapToCorner('bottom-left', e)
              else if (!isRight && isBottom) snapToCorner('top-left', e)
              else if (!isRight && !isBottom) snapToCorner('top-right', e)
              else snapToCorner('bottom-right', e)
            }}
            title="Snap to next corner"
            aria-label="Snap to next corner"
          >
            <CornerDownRight size={12} />
          </button>

          {/* Minimize Window */}
          <button
            type="button"
            className="fvw-control-btn"
            onClick={(e) => {
              e.stopPropagation()
              setIsMinimized(true)
            }}
            title="Minimize to floating bubble"
            aria-label="Minimize candidate camera"
          >
            <Minus size={13} />
          </button>
        </div>
      </div>

      {/* ── 16:9 Video Viewport ────────────────────────────────────────── */}
      <div className="fvw-viewport">
        {videoEnabled && !cameraPermissionError ? (
          <VideoRecorder
            ref={videoRecorderRef}
            isRecording={isRecording}
            onRecordingComplete={onVideoBlob}
            disabled={disabled}
            autoStartStream={true}
          />
        ) : (
          <div className="fvw-placeholder-avatar">
            <div className="avatar-circle">
              {userInitials ? (
                <span className="avatar-text">{userInitials}</span>
              ) : (
                <User size={32} />
              )}
            </div>
            <span className="avatar-label">
              {cameraPermissionError ? 'Camera unavailable' : 'Camera disabled'}
            </span>
          </div>
        )}

        {/* Non-blocking permission notice */}
        {cameraPermissionError && (
          <div className="fvw-permission-notice">
            <AlertCircle size={12} />
            <span>Camera unavailable. You can continue without video.</span>
          </div>
        )}
      </div>

      {/* ── Footer Controls & Status Indicators ────────────────────────── */}
      <div className="fvw-footer">
        {/* Left: Device Toggles */}
        <div className="fvw-device-buttons">
          {/* Camera Toggle */}
          <button
            type="button"
            className={`fvw-media-btn ${videoEnabled ? 'is-active' : 'is-off'}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleVideo?.()
            }}
            title={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
            aria-label={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
            disabled={disabled}
          >
            {videoEnabled ? <Video size={13} /> : <VideoOff size={13} />}
            <span>Camera</span>
          </button>

          {/* Mic Toggle */}
          <button
            type="button"
            className={`fvw-media-btn ${isMicActive ? 'is-active' : 'is-muted'}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleMic?.()
            }}
            title={isMicActive ? 'Mute microphone' : 'Unmute microphone'}
            aria-label={isMicActive ? 'Mute microphone' : 'Unmute microphone'}
            disabled={disabled}
          >
            {isMicActive ? <Mic size={13} /> : <MicOff size={13} />}
            <span>Mic</span>
          </button>
        </div>

        {/* Right: Live recording / stream status */}
        <div className="fvw-stream-status">
          <span
            className={`fvw-dot ${
              isRecording ? 'dot-recording' : videoEnabled ? 'dot-live' : 'dot-standby'
            }`}
          />
          <span className="fvw-status-text">
            {isRecording ? 'REC' : videoEnabled ? 'Live' : 'Audio Only'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default memo(FloatingVideoWindow)
