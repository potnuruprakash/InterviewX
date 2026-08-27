/**
 * AudioRecorder Component
 *
 * Uses browser MediaRecorder API to record audio.
 * Handles permission denial gracefully — text interview continues without audio.
 *
 * Props:
 *   onRecordingComplete(blob, url) — called when user finalizes a recording
 *   disabled — prevent recording (e.g., while submitting)
 */

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Square, Play, Pause, Trash2, CheckCircle, AlertCircle } from 'lucide-react'
import './AudioRecorder.css'

const RECORDING_STATES = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  READY: 'ready',
  RECORDING: 'recording',
  RECORDED: 'recorded',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
}

export default function AudioRecorder({ onRecordingComplete, disabled = false }) {
  const [state, setState] = useState(RECORDING_STATES.IDLE)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const audioRef = useRef(new Audio())
  const streamRef = useRef(null)

  useEffect(() => {
    // Check if MediaRecorder is available
    if (!window.MediaRecorder) {
      setState(RECORDING_STATES.UNAVAILABLE)
    }
    return () => {
      cleanup()
    }
  }, [])

  const cleanup = () => {
    clearInterval(timerRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }

  const requestMic = async () => {
    setState(RECORDING_STATES.REQUESTING)
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      setState(RECORDING_STATES.READY)
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setState(RECORDING_STATES.DENIED)
        setError('Microphone permission denied. Audio recording is unavailable.')
      } else {
        setState(RECORDING_STATES.UNAVAILABLE)
        setError(`Microphone unavailable: ${err.message}`)
      }
    }
  }

  const startRecording = () => {
    if (!streamRef.current) return
    chunksRef.current = []
    const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? { mimeType: 'audio/webm;codecs=opus' }
      : {}

    const mr = new MediaRecorder(streamRef.current, options)
    mediaRecorderRef.current = mr

    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      audioRef.current.src = url
      setState(RECORDING_STATES.RECORDED)
      onRecordingComplete?.(blob, url)
    }

    mr.start(250) // collect data every 250ms
    setState(RECORDING_STATES.RECORDING)
    setRecordingTime(0)
    timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000)
  }

  const stopRecording = () => {
    clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
  }

  const discardRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    audioRef.current.pause()
    setIsPlaying(false)
    setState(RECORDING_STATES.READY)
    setRecordingTime(0)
    onRecordingComplete?.(null, null)
  }

  const togglePlayback = () => {
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
      audioRef.current.onended = () => setIsPlaying(false)
    }
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  if (state === RECORDING_STATES.UNAVAILABLE) {
    return (
      <div className="audio-recorder unavailable">
        <MicOff size={16} />
        <span>Audio recording unavailable in this browser.</span>
      </div>
    )
  }

  if (state === RECORDING_STATES.DENIED) {
    return (
      <div className="audio-recorder denied">
        <AlertCircle size={16} />
        <span>Microphone access denied. Interview continues with text only.</span>
      </div>
    )
  }

  return (
    <div className={`audio-recorder ${state} ${disabled ? 'disabled' : ''}`}>
      {/* Status indicator */}
      <div className="recorder-header">
        <Mic size={14} />
        <span className="recorder-label">Audio Recording</span>
        {state === RECORDING_STATES.RECORDING && (
          <span className="recording-badge">
            <span className="rec-dot" /> REC {formatTime(recordingTime)}
          </span>
        )}
      </div>

      {error && <div className="recorder-error"><AlertCircle size={12} /> {error}</div>}

      <div className="recorder-controls">
        {state === RECORDING_STATES.IDLE && (
          <button className="rec-btn btn-enable" onClick={requestMic} disabled={disabled}>
            <Mic size={14} /> Enable Mic
          </button>
        )}

        {state === RECORDING_STATES.REQUESTING && (
          <span className="rec-status">Requesting microphone...</span>
        )}

        {state === RECORDING_STATES.READY && (
          <button className="rec-btn btn-record" onClick={startRecording} disabled={disabled}>
            <span className="rec-dot" /> Start Recording
          </button>
        )}

        {state === RECORDING_STATES.RECORDING && (
          <button className="rec-btn btn-stop" onClick={stopRecording}>
            <Square size={14} /> Stop
          </button>
        )}

        {state === RECORDING_STATES.RECORDED && (
          <div className="playback-controls">
            <button className="rec-btn btn-play" onClick={togglePlayback}>
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button className="rec-btn btn-discard" onClick={discardRecording}>
              <Trash2 size={14} /> Discard
            </button>
            <span className="rec-success"><CheckCircle size={12} /> Recorded ({formatTime(recordingTime)})</span>
          </div>
        )}
      </div>
    </div>
  )
}
