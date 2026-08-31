/**
 * AudioRecorder Component
 *
 * Captures supporting multimodal audio stream via browser MediaRecorder.
 * Coordinates with speech recognition in Voice Mode.
 * Handles permission denial gracefully.
 */

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Mic, AlertCircle } from 'lucide-react'
import './AudioRecorder.css'

const AudioRecorder = forwardRef(function AudioRecorder(
  {
    onRecordingComplete,
    isRecording = false,
    disabled = false,
  },
  ref
) {
  const [streamActive, setStreamActive] = useState(false)
  const [error, setError] = useState(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setStreamActive(false)
  }

  const requestMic = async () => {
    setError(null)
    setPermissionDenied(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setStreamActive(true)
      return stream
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true)
        setError('Microphone access is required for voice answers. You can switch to typing.')
      } else {
        setError(`Microphone unavailable: ${err.message}. You can continue with text.`)
      }
      return null
    }
  }

  const startRecording = async () => {
    chunksRef.current = []
    let stream = streamRef.current
    if (!stream) {
      stream = await requestMic()
      if (!stream) return
    }

    try {
      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : {}

      const mr = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mr

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mr.onstop = () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
          onRecordingComplete?.(blob)
        }
      }

      mr.start(250)
    } catch (err) {
      console.warn('[AudioRecorder] Could not start recording:', err.message)
    }
  }

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    } catch (err) {
      console.warn('[AudioRecorder] Stop error:', err.message)
    }
  }

  useEffect(() => {
    if (isRecording) {
      startRecording()
    } else if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      stopRecording()
    }
  }, [isRecording])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [])

  useImperativeHandle(ref, () => ({
    startRecording,
    stopRecording,
    cleanup,
  }))

  if (permissionDenied) {
    return (
      <div className="audio-permission-denied animate-fade-in">
        <AlertCircle size={14} className="denied-icon" />
        <span>Microphone access is required for voice answers. You can switch to typing.</span>
      </div>
    )
  }

  return (
    <div className="audio-support-indicator">
      {error && (
        <div className="audio-error-msg">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
})

export default AudioRecorder
