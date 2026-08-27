/**
 * VideoRecorder Component
 *
 * Records video using MediaRecorder with camera stream.
 * Handles permission denial gracefully.
 *
 * Props:
 *   onRecordingComplete(blob, url)
 *   disabled
 */

import { useState, useRef, useEffect } from 'react'
import { Video, VideoOff, Square, Play, Pause, Trash2, CheckCircle, AlertCircle, Camera } from 'lucide-react'
import './VideoRecorder.css'

const STATES = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  PREVIEW: 'preview',
  RECORDING: 'recording',
  RECORDED: 'recorded',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
}

export default function VideoRecorder({ onRecordingComplete, disabled = false }) {
  const [state, setState] = useState(STATES.IDLE)
  const [recordingTime, setRecordingTime] = useState(0)
  const [videoUrl, setVideoUrl] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const liveVideoRef = useRef(null)
  const playbackVideoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    if (!window.MediaRecorder) setState(STATES.UNAVAILABLE)
    return cleanup
  }, [])

  const cleanup = () => {
    clearInterval(timerRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    if (videoUrl) URL.revokeObjectURL(videoUrl)
  }

  const requestCamera = async () => {
    setState(STATES.REQUESTING)
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true,
      })
      streamRef.current = stream
      setState(STATES.PREVIEW)
      // Attach to live preview
      setTimeout(() => {
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream
          liveVideoRef.current.play().catch(() => {})
        }
      }, 100)
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setState(STATES.DENIED)
        setError('Camera permission denied.')
      } else {
        setState(STATES.UNAVAILABLE)
        setError(`Camera unavailable: ${err.message}`)
      }
    }
  }

  const startRecording = () => {
    if (!streamRef.current) return
    chunksRef.current = []
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm'

    const mr = new MediaRecorder(streamRef.current, { mimeType })
    mediaRecorderRef.current = mr

    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const url = URL.createObjectURL(blob)
      setVideoUrl(url)
      setState(STATES.RECORDED)
      onRecordingComplete?.(blob, url)
      // Stop live stream
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    }

    mr.start(500)
    setState(STATES.RECORDING)
    setRecordingTime(0)
    timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000)
  }

  const stopRecording = () => {
    clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
  }

  const discardRecording = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)
    setState(STATES.IDLE)
    setRecordingTime(0)
    onRecordingComplete?.(null, null)
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  if (state === STATES.UNAVAILABLE) {
    return (
      <div className="video-recorder unavailable">
        <VideoOff size={16} />
        <span>Video recording unavailable in this browser.</span>
      </div>
    )
  }

  if (state === STATES.DENIED) {
    return (
      <div className="video-recorder denied">
        <AlertCircle size={16} />
        <span>Camera access denied. Interview continues with text{error?.includes('audio') ? '' : '/audio'} only.</span>
      </div>
    )
  }

  return (
    <div className={`video-recorder ${state} ${disabled ? 'disabled' : ''}`}>
      <div className="video-recorder-header">
        <Video size={14} />
        <span className="video-label">Video Recording</span>
        {state === STATES.RECORDING && (
          <span className="recording-badge">
            <span className="rec-dot" /> REC {formatTime(recordingTime)}
          </span>
        )}
      </div>

      {/* Live preview */}
      {(state === STATES.PREVIEW || state === STATES.RECORDING) && (
        <div className="video-preview-wrap">
          <video ref={liveVideoRef} className="video-preview" muted playsInline autoPlay />
          {state === STATES.RECORDING && <div className="recording-overlay">● REC {formatTime(recordingTime)}</div>}
        </div>
      )}

      {/* Playback */}
      {state === STATES.RECORDED && videoUrl && (
        <div className="video-preview-wrap">
          <video ref={playbackVideoRef} className="video-preview" src={videoUrl} controls />
          <div className="recorded-badge"><CheckCircle size={12} /> Recorded ({formatTime(recordingTime)})</div>
        </div>
      )}

      {error && <div className="video-error"><AlertCircle size={12} /> {error}</div>}

      <div className="video-controls">
        {state === STATES.IDLE && (
          <button className="vid-btn btn-enable" onClick={requestCamera} disabled={disabled}>
            <Camera size={14} /> Enable Camera
          </button>
        )}

        {state === STATES.REQUESTING && (
          <span className="vid-status">Requesting camera...</span>
        )}

        {state === STATES.PREVIEW && (
          <button className="vid-btn btn-record" onClick={startRecording} disabled={disabled}>
            <span className="rec-dot" /> Start Recording
          </button>
        )}

        {state === STATES.RECORDING && (
          <button className="vid-btn btn-stop" onClick={stopRecording}>
            <Square size={14} /> Stop Recording
          </button>
        )}

        {state === STATES.RECORDED && (
          <button className="vid-btn btn-discard" onClick={discardRecording}>
            <Trash2 size={14} /> Discard & Re-record
          </button>
        )}
      </div>
    </div>
  )
}
