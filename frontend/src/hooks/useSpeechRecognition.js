import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * useSpeechRecognition Hook
 *
 * Provides resilient, continuous speech-to-text using native browser Web Speech API.
 * Handles interim vs final transcripts, automatic restart on browser silence,
 * permission denials, and unsupported browser states.
 *
 * @param {Function} onFinalTranscript - Callback triggered whenever a final speech segment is confirmed
 */
export function useSpeechRecognition({ onFinalTranscript } = {}) {
  const [isListening, setIsListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [status, setStatus] = useState('idle') // 'idle' | 'listening' | 'processing' | 'ready' | 'error' | 'unsupported'
  const [error, setError] = useState(null)

  const recognitionRef = useRef(null)
  const shouldListenRef = useRef(false)
  const onFinalTranscriptRef = useRef(onFinalTranscript)
  const restartTimeoutRef = useRef(null)

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript
  }, [onFinalTranscript])

  const SpeechRecognitionClass =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null

  const isSupported = Boolean(SpeechRecognitionClass)

  // Initialize SpeechRecognition instance
  useEffect(() => {
    if (!isSupported) {
      setStatus('unsupported')
      return
    }

    const recognition = new SpeechRecognitionClass()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setError(null)
      setIsListening(true)
      setStatus('listening')
    }

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i]
        const text = result[0]?.transcript || ''

        if (result.isFinal) {
          const trimmed = text.trim()
          if (trimmed) {
            onFinalTranscriptRef.current?.(trimmed)
          }
        } else {
          interim += text
        }
      }
      setInterimTranscript(interim)
    }

    recognition.onerror = (event) => {
      console.warn('[SpeechRecognition] error:', event.error)

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldListenRef.current = false
        setIsListening(false)
        setStatus('error')
        setError('Microphone access is required for voice answers. You can switch to typing.')
      } else if (event.error === 'audio-capture') {
        shouldListenRef.current = false
        setIsListening(false)
        setStatus('error')
        setError('No microphone was detected. You can type your answer instead.')
      } else if (event.error === 'network') {
        setStatus('error')
        setError('Speech recognition encountered a network issue. You can continue typing.')
      } else if (event.error === 'no-speech') {
        // Not fatal; user just paused
      }
    }

    recognition.onend = () => {
      setInterimTranscript('')
      // If candidate is still in listening mode, smoothly restart (browser silence cutoff)
      if (shouldListenRef.current) {
        clearTimeout(restartTimeoutRef.current)
        restartTimeoutRef.current = setTimeout(() => {
          if (shouldListenRef.current) {
            try {
              recognition.start()
            } catch (err) {
              console.warn('[SpeechRecognition] restart attempt notice:', err.message)
            }
          }
        }, 80)
      } else {
        setIsListening(false)
        setStatus((prev) => (prev === 'listening' ? 'ready' : prev))
      }
    }

    recognitionRef.current = recognition

    return () => {
      shouldListenRef.current = false
      clearTimeout(restartTimeoutRef.current)
      try {
        recognition.stop()
      } catch (_) {}
    }
  }, [isSupported])

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech-to-text is not supported in this browser. You can type your answer instead.')
      setStatus('unsupported')
      return
    }

    setError(null)
    setInterimTranscript('')
    shouldListenRef.current = true
    setStatus('listening')

    try {
      recognitionRef.current?.start()
    } catch (err) {
      // If already started or pending, restart cleanly
      if (err.name === 'InvalidStateError') {
        try {
          recognitionRef.current?.stop()
          setTimeout(() => {
            if (shouldListenRef.current) recognitionRef.current?.start()
          }, 100)
        } catch (_) {}
      } else {
        setError('Could not start speech recognition. You can type your answer.')
      }
    }
  }, [isSupported])

  const stopListening = useCallback(() => {
    shouldListenRef.current = false
    clearTimeout(restartTimeoutRef.current)
    setInterimTranscript('')

    try {
      recognitionRef.current?.stop()
    } catch (_) {}

    setIsListening(false)
    setStatus('ready')
  }, [])

  const reset = useCallback(() => {
    shouldListenRef.current = false
    clearTimeout(restartTimeoutRef.current)
    setInterimTranscript('')
    setError(null)
    try {
      recognitionRef.current?.stop()
    } catch (_) {}
    setIsListening(false)
    setStatus('idle')
  }, [])

  return {
    isSupported,
    isListening,
    interimTranscript,
    status,
    error,
    startListening,
    stopListening,
    reset,
  }
}

export default useSpeechRecognition
