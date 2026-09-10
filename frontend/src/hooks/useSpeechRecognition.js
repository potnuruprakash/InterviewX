import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Normalizes speech text when appending to an existing transcript.
 * Avoids word concatenation artifacts (e.g., "REST APIsbecause"),
 * normalizes whitespace, and preserves punctuation boundaries.
 */
export function normalizeTranscriptJoin(existingText, newPhrase) {
  const cleanExisting = (existingText || '').trimEnd()
  const cleanNew = (newPhrase || '').trim()

  if (!cleanExisting) return cleanNew
  if (!cleanNew) return cleanExisting

  // Check if existing text ends with punctuation or closing quote/parenthesis
  const endsWithPunctuation = /[.?!,;:\-"')]$/.test(cleanExisting)

  // Capitalize first letter if following terminal punctuation (. ? !)
  let formattedNew = cleanNew
  if (/[.?!]$/.test(cleanExisting)) {
    formattedNew = cleanNew.charAt(0).toUpperCase() + cleanNew.slice(1)
  }

  return `${cleanExisting} ${formattedNew}`
}

/**
 * useSpeechRecognition Hook
 *
 * High-accuracy, continuous speech-to-text pipeline using Web Speech API:
 * 1. Single continuous answer model per question.
 * 2. Strict separation of interim vs final transcripts.
 * 3. Correct handling of resultIndex and multiple result segments.
 * 4. Robust Finite State Machine (IDLE | LISTENING | RESTARTING | STOPPING | ERROR).
 * 5. Automatic silence recovery without losing accumulated speech.
 * 6. Protection against duplicate recognition instances and InvalidStateErrors.
 * 7. flushAndStop() to commit any pending final speech before submit/skip/timer.
 */
export function useSpeechRecognition({ onFinalTranscript } = {}) {
  const [isListening, setIsListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [status, setStatus] = useState('idle') // 'idle' | 'listening' | 'restarting' | 'ready' | 'error' | 'unsupported'
  const [error, setError] = useState(null)

  const recognitionRef = useRef(null)
  const shouldListenRef = useRef(false)
  const fsmStateRef = useRef('IDLE') // 'IDLE' | 'LISTENING' | 'RESTARTING' | 'STOPPING' | 'ERROR'
  const isStartingRef = useRef(false)
  const isStoppingRef = useRef(false)
  const onFinalTranscriptRef = useRef(onFinalTranscript)
  const restartTimerRef = useRef(null)
  const lastProcessedIndexRef = useRef(-1)
  const interimTranscriptRef = useRef('')

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript
  }, [onFinalTranscript])

  const SpeechRecognitionClass =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null

  const isSupported = Boolean(SpeechRecognitionClass)

  // Initialize SpeechRecognition instance once
  useEffect(() => {
    if (!isSupported) {
      setStatus('unsupported')
      fsmStateRef.current = 'ERROR'
      return
    }

    const recognition = new SpeechRecognitionClass()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      isStartingRef.current = false
      fsmStateRef.current = 'LISTENING'
      setError(null)
      setIsListening(true)
      setStatus('listening')
    }

    recognition.onresult = (event) => {
      let currentInterim = ''

      // Process results starting strictly from event.resultIndex
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i]
        const transcript = result[0]?.transcript || ''

        if (result.isFinal) {
          // Prevent processing the exact same final result index multiple times
          if (i > lastProcessedIndexRef.current) {
            lastProcessedIndexRef.current = i
            const trimmedFinal = transcript.trim()
            if (trimmedFinal) {
              onFinalTranscriptRef.current?.(trimmedFinal)
            }
          }
        } else {
          currentInterim += transcript
        }
      }

      const trimmedInterim = currentInterim.trim()
      interimTranscriptRef.current = trimmedInterim
      setInterimTranscript(trimmedInterim)
    }

    recognition.onerror = (event) => {
      // Non-fatal pauses
      if (event.error === 'no-speech') {
        return
      }

      console.warn('[SpeechRecognition] notice:', event.error)

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldListenRef.current = false
        fsmStateRef.current = 'ERROR'
        setIsListening(false)
        setStatus('error')
        setError('Microphone access is required for voice answers. You can type your answer instead.')
      } else if (event.error === 'audio-capture') {
        shouldListenRef.current = false
        fsmStateRef.current = 'ERROR'
        setIsListening(false)
        setStatus('error')
        setError('No microphone detected. You can type your answer instead.')
      } else if (event.error === 'network') {
        // Network errors in Web Speech API are often transient; trigger restart if active
        if (shouldListenRef.current) {
          setStatus('restarting')
        } else {
          setStatus('error')
          setError('Speech recognition network interruption. You can continue typing.')
        }
      } else if (event.error === 'aborted') {
        // Normal during stop/restart lifecycle
      }
    }

    recognition.onend = () => {
      isStartingRef.current = false
      isStoppingRef.current = false
      setInterimTranscript('')

      // If active listening is desired, restart smoothly without creating duplicate instances
      if (shouldListenRef.current && fsmStateRef.current !== 'STOPPING') {
        fsmStateRef.current = 'RESTARTING'
        setStatus('restarting')

        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = setTimeout(() => {
          if (shouldListenRef.current && !isStartingRef.current) {
            isStartingRef.current = true
            try {
              recognition.start()
            } catch (err) {
              isStartingRef.current = false
              // InvalidStateError means already started; ignore
              if (err.name !== 'InvalidStateError') {
                console.warn('[SpeechRecognition] restart recovery:', err.message)
              }
            }
          }
        }, 120)
      } else {
        fsmStateRef.current = 'IDLE'
        setIsListening(false)
        setStatus('ready')
      }
    }

    recognitionRef.current = recognition

    return () => {
      shouldListenRef.current = false
      fsmStateRef.current = 'STOPPING'
      clearTimeout(restartTimerRef.current)
      try {
        recognition.abort()
      } catch (_) {}
    }
  }, [isSupported])

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser. You can type your answer.')
      setStatus('unsupported')
      return
    }

    setError(null)
    setInterimTranscript('')
    shouldListenRef.current = true
    lastProcessedIndexRef.current = -1

    if (fsmStateRef.current === 'LISTENING') {
      return
    }

    fsmStateRef.current = 'LISTENING'
    setStatus('listening')

    if (!isStartingRef.current) {
      isStartingRef.current = true
      try {
        recognitionRef.current?.start()
      } catch (err) {
        isStartingRef.current = false
        if (err.name === 'InvalidStateError') {
          // Already running or pending; abort and cleanly restart
          try {
            recognitionRef.current?.abort()
            setTimeout(() => {
              if (shouldListenRef.current) {
                try {
                  recognitionRef.current?.start()
                } catch (_) {}
              }
            }, 100)
          } catch (_) {}
        } else {
          setError('Microphone could not be initialized. You can type your answer.')
        }
      }
    }
  }, [isSupported])

  const stopListening = useCallback(() => {
    shouldListenRef.current = false
    clearTimeout(restartTimerRef.current)
    fsmStateRef.current = 'STOPPING'
    isStoppingRef.current = true
    setInterimTranscript('')

    try {
      recognitionRef.current?.stop()
    } catch (_) {}

    setIsListening(false)
    setStatus('ready')
  }, [])

  /**
   * Commits any pending final recognition segment, stops recognition,
   * and ensures no residual speech leaks into the next question.
   */
  const flushAndStop = useCallback(() => {
    const flushedText = interimTranscriptRef.current || ''
    shouldListenRef.current = false
    clearTimeout(restartTimerRef.current)
    fsmStateRef.current = 'STOPPING'
    isStoppingRef.current = true
    lastProcessedIndexRef.current = -1
    interimTranscriptRef.current = ''
    setInterimTranscript('')

    try {
      recognitionRef.current?.stop()
    } catch (_) {}

    setIsListening(false)
    setStatus('ready')

    return { flushedText }
  }, [])

  const reset = useCallback(() => {
    shouldListenRef.current = false
    clearTimeout(restartTimerRef.current)
    fsmStateRef.current = 'IDLE'
    isStartingRef.current = false
    isStoppingRef.current = false
    lastProcessedIndexRef.current = -1
    interimTranscriptRef.current = ''
    setInterimTranscript('')
    setError(null)

    try {
      recognitionRef.current?.abort()
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
    flushAndStop,
    reset,
  }
}

export default useSpeechRecognition
