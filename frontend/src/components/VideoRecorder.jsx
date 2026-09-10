/**
 * VideoRecorder Component
 *
 * Professional candidate camera panel with live preview and background recording for YOLO video analysis.
 * Handles permission denial gracefully: "Camera access is unavailable. You can continue with audio or text."
 */

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Video, VideoOff, Camera, AlertCircle } from 'lucide-react'
import './VideoRecorder.css'

const VideoRecorder = forwardRef(function VideoRecorder(
  {
    onRecordingComplete,
    onStreamReady,
    isRecording = false,
    disabled = false,
    autoStartStream = true,
  },
  ref
) {
  const [streamActive, setStreamActive] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const liveVideoRef = useRef(null)
  const streamRef = useRef(null)
  const isRecordingRef = useRef(isRecording)

  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setStreamActive(false)
  }

  const requestCamera = async () => {
    setRequesting(true)
    setError(null)
    setPermissionDenied(false)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true,
      })

      streamRef.current = stream
      setStreamActive(true)
      setRequesting(false)
      onStreamReady?.(stream)

      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream
        liveVideoRef.current.play().catch(() => {})
      }
    } catch (err) {
      setRequesting(false)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true)
        setError('Camera access is unavailable. You can continue with audio or text.')
      } else {
        setError(`Camera unavailable: ${err.message}. You can continue with audio or text.`)
      }
    }
  }

  // Auto request camera stream when component mounts if requested
  useEffect(() => {
    if (autoStartStream && !streamRef.current && !permissionDenied) {
      requestCamera()
    }
    return () => {
      cleanup()
    }
  }, [autoStartStream])

  // Attach stream when video element becomes available
  useEffect(() => {
    if (streamActive && streamRef.current && liveVideoRef.current) {
      liveVideoRef.current.srcObject = streamRef.current
      liveVideoRef.current.play().catch(() => {})
    }
  }, [streamActive])

  // Start / Stop MediaRecorder when isRecording changes
  useEffect(() => {
    if (isRecording) {
      startMediaRecording()
    } else if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      stopMediaRecording()
    }
  }, [isRecording])

  const startMediaRecording = () => {
    if (!streamRef.current) return
    chunksRef.current = []

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm'

      const mr = new MediaRecorder(streamRef.current, { mimeType })
      mediaRecorderRef.current = mr

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mr.onstop = () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeType })
          onRecordingComplete?.(blob)
        }
      }

      mr.start(500)
    } catch (err) {
      console.warn('[VideoRecorder] Failed to start media recorder:', err.message)
    }
  }

  const stopMediaRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    } catch (err) {
      console.warn('[VideoRecorder] Error stopping media recorder:', err.message)
    }
  }

  const stopAndGetBlob = () => {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current
      if (!mr || mr.state === 'inactive') {
        if (chunksRef.current.length > 0) {
          const mimeType = mr?.mimeType || 'video/webm'
          const blob = new Blob(chunksRef.current, { type: mimeType })
          resolve(blob.size > 0 ? blob : null)
        } else {
          resolve(null)
        }
        return
      }

      const mimeType = mr.mimeType || 'video/webm'
      const prevOnStop = mr.onstop

      mr.onstop = (e) => {
        try {
          if (prevOnStop) prevOnStop(e)
        } catch (err) {
          console.warn('[VideoRecorder] onstop handler err:', err)
        }
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeType })
          resolve(blob.size > 0 ? blob : null)
        } else {
          resolve(null)
        }
      }

      try {
        mr.stop()
      } catch (err) {
        console.warn('[VideoRecorder] Error in stop():', err)
        resolve(null)
      }
    })
  }

  useImperativeHandle(ref, () => ({
    getStream: () => streamRef.current,
    stopRecording: stopMediaRecording,
    stopAndGetBlob,
    startRecording: startMediaRecording,
    stopCamera: cleanup,
    startCamera: requestCamera,
  }))

  return (
    <div className="camera-embed-wrapper">
      <div className="camera-viewport">
        {streamActive ? (
          <video
            ref={liveVideoRef}
            className="camera-video"
            playsInline
            muted
            autoPlay
          />
        ) : requesting ? (
          <div className="camera-placeholder">
            <div className="camera-loader" />
            <p>Initializing camera...</p>
          </div>
        ) : permissionDenied ? (
          <div className="camera-denied-state">
            <VideoOff size={24} className="camera-off-icon" />
            <p className="camera-denied-msg">
              Camera access unavailable.
              <br />
              Continue with audio or text.
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={requestCamera}
              disabled={disabled}
            >
              Retry Camera
            </button>
          </div>
        ) : (
          <div className="camera-placeholder">
            <Camera size={28} className="camera-off-icon" />
            <p>Starting camera...</p>
          </div>
        )}

        {/* Live Recording Badge Overlay */}
        {streamActive && isRecording && (
          <div className="camera-rec-overlay">
            <span className="camera-rec-dot" />
            <span>REC</span>
          </div>
        )}
      </div>

      {error && !permissionDenied && (
        <div className="camera-error-banner">
          <AlertCircle size={13} />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
})

export default VideoRecorder
