/**
 * FloatingCamera Component
 *
 * Requirements 9, 10, 11:
 * - Small, compact floating candidate camera window.
 * - Positioned initially in bottom-right area of the interview workspace.
 * - Freely draggable across the entire workspace with mouse and touch (Pointer Events).
 * - Clamped within interview workspace boundaries (cannot be dragged outside viewport/container).
 * - Position persisted across question transitions via sessionStorage.
 * - Minimal controls: Mic status, Camera toggle, Minimize/Restore, Resize.
 * - Aspect-ratio preserved (object-fit: cover).
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Video, VideoOff, Mic, MicOff, Minimize2, Maximize2,
  Move, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react'
import VideoRecorder from './VideoRecorder'
import './FloatingCamera.css'

export default function FloatingCamera({
  interviewId,
  videoEnabled = true,
  onToggleVideo,
  isRecording = false,
  onRecordingComplete,
  isListening = false,
  speechError = null,
  isSpeechSupported = true,
  videoRecorderRef,
  containerRef,
  disabled = false,
}) {
  // Dimensions for compact vs normal modes
  const [sizeMode, setSizeMode] = useState('compact') // 'compact' | 'normal'
  const [isMinimized, setIsMinimized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const cameraDimensions = {
    compact: { width: 240, height: 150 },
    normal: { width: 320, height: 200 },
  }[sizeMode] || { width: 240, height: 150 }

  const storageKey = `interviewx_cam_pos_${interviewId || 'default'}`

  // Coordinates { x, y } in pixels relative to viewport or interview workspace
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
    // Default initial bottom-right position
    const initialWidth = 240
    const initialHeight = 150
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1280
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800
    return {
      x: Math.max(16, winW - initialWidth - 32),
      y: Math.max(16, winH - initialHeight - 32),
    }
  })

  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const elementRef = useRef(null)

  // Clamp helper to ensure the box stays strictly within viewport/container boundaries
  const clampPosition = useCallback((x, y, elemW, elemH) => {
    let boundWidth = window.innerWidth
    let boundHeight = window.innerHeight

    if (containerRef?.current) {
      const rect = containerRef.current.getBoundingClientRect()
      boundWidth = rect.width
      boundHeight = rect.height
    }

    const margin = 12
    const minX = margin
    const maxX = Math.max(margin, boundWidth - elemW - margin)
    const minY = margin
    const maxY = Math.max(margin, boundHeight - elemH - margin)

    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    }
  }, [containerRef])

  // Reposition / clamp on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => clampPosition(prev.x, prev.y, cameraDimensions.width, cameraDimensions.height))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [clampPosition, cameraDimensions])

  // Save coordinates to sessionStorage whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(position))
    } catch (e) {
      /* ignore storage quota error */
    }
  }, [position, storageKey])

  // Pointer down — start drag
  const handlePointerDown = (e) => {
    // Don't drag if clicking buttons or interactive elements
    if (e.target.closest('button') || e.target.closest('.floating-cam-ctrl-btn')) {
      return
    }

    e.preventDefault()
    e.stopPropagation()

    const clientX = e.clientX
    const clientY = e.clientY

    dragOffsetRef.current = {
      x: clientX - position.x,
      y: clientY - position.y,
    }

    setIsDragging(true)
    if (elementRef.current?.setPointerCapture) {
      elementRef.current.setPointerCapture(e.pointerId)
    }
  }

  // Pointer move — update dragged position
  const handlePointerMove = (e) => {
    if (!isDragging) return
    e.preventDefault()
    e.stopPropagation()

    const rawX = e.clientX - dragOffsetRef.current.x
    const rawY = e.clientY - dragOffsetRef.current.y

    const curW = isMinimized ? 160 : cameraDimensions.width
    const curH = isMinimized ? 44 : cameraDimensions.height

    const clamped = clampPosition(rawX, rawY, curW, curH)
    setPosition(clamped)
  }

  // Pointer up — end drag
  const handlePointerUp = (e) => {
    if (!isDragging) return
    setIsDragging(false)
    if (elementRef.current?.releasePointerCapture) {
      try {
        elementRef.current.releasePointerCapture(e.pointerId)
      } catch (err) {
        /* already released */
      }
    }
  }

  // Toggle size mode between compact and normal
  const toggleSizeMode = (e) => {
    e.stopPropagation()
    const nextMode = sizeMode === 'compact' ? 'normal' : 'compact'
    setSizeMode(nextMode)
    const nextDims = nextMode === 'normal' ? { width: 320, height: 200 } : { width: 240, height: 150 }
    setPosition((prev) => clampPosition(prev.x, prev.y, nextDims.width, nextDims.height))
  }

  // Toggle minimized pill state
  const toggleMinimize = (e) => {
    e.stopPropagation()
    setIsMinimized((prev) => !prev)
  }

  return (
    <div
      ref={elementRef}
      className={`floating-camera-window ${isDragging ? 'is-dragging' : ''} ${isMinimized ? 'is-minimized' : ''} size-${sizeMode}`}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        width: isMinimized ? 'auto' : `${cameraDimensions.width}px`,
        height: isMinimized ? 'auto' : `${cameraDimensions.height}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      id="floating-candidate-camera"
      title="Click and drag to move camera preview"
    >
      {/* ── Top Header / Drag Handle & Controls ───────────────────────── */}
      <div className="floating-cam-header" onPointerDown={handlePointerDown}>
        <div className="floating-cam-header-left">
          <span className="drag-grip-icon" title="Drag to move">
            <Move size={12} />
          </span>
          <span className="floating-cam-label">
            {videoEnabled ? 'Camera Active' : 'Camera Off'}
          </span>
        </div>

        {/* Minimal Window Controls */}
        <div className="floating-cam-controls" onPointerDown={(e) => e.stopPropagation()}>
          {/* Camera On / Off Toggle */}
          <button
            type="button"
            className={`floating-cam-ctrl-btn ${videoEnabled ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleVideo?.()
            }}
            title={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
            disabled={disabled}
          >
            {videoEnabled ? <Video size={12} /> : <VideoOff size={12} />}
          </button>

          {/* Size Toggle (Compact vs Normal) */}
          {!isMinimized && (
            <button
              type="button"
              className="floating-cam-ctrl-btn"
              onClick={toggleSizeMode}
              title={sizeMode === 'compact' ? 'Expand size' : 'Compact size'}
            >
              {sizeMode === 'compact' ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
            </button>
          )}

          {/* Minimize / Restore Window */}
          <button
            type="button"
            className="floating-cam-ctrl-btn"
            onClick={toggleMinimize}
            title={isMinimized ? 'Restore camera window' : 'Minimize camera window'}
          >
            {isMinimized ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* ── Video Viewport (Hidden when minimized) ───────────────────── */}
      {!isMinimized && (
        <div className="floating-cam-viewport">
          {videoEnabled ? (
            <VideoRecorder
              ref={videoRecorderRef}
              isRecording={isRecording && videoEnabled}
              onRecordingComplete={onRecordingComplete}
              disabled={disabled}
              autoStartStream={true}
            />
          ) : (
            <div className="floating-cam-off-placeholder">
              <VideoOff size={22} className="cam-off-icon" />
              <span>Camera Paused</span>
            </div>
          )}
        </div>
      )}

      {/* ── Status Bar (Bottom indicators) ───────────────────────────── */}
      <div className="floating-cam-footer" onPointerDown={handlePointerDown}>
        {/* Audio Mic Status */}
        <div className="floating-status-pill">
          <span className={`status-dot ${isListening ? 'live pulse' : speechError ? 'error' : ''}`} />
          <span className="status-text">
            {isListening ? (
              <>
                <Mic size={11} className="mic-live-icon" /> Mic
              </>
            ) : speechError ? (
              <>
                <MicOff size={11} /> Mic error
              </>
            ) : (
              'Mic standby'
            )}
          </span>
        </div>

        {/* Video Frame Indicator */}
        {videoEnabled && !isMinimized && (
          <div className="floating-cam-frame-indicator">
            <span className="status-dot live" />
            <span>Framed</span>
          </div>
        )}
      </div>
    </div>
  )
}
