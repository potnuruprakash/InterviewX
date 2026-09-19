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

  // If the new phrase is already present at the end of cleanExisting, avoid duplicating it
  if (cleanNew.length > 5 && cleanExisting.endsWith(cleanNew)) {
    return cleanExisting
  }

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
export function useSpeechRecognition({ onFinalTranscript, lang = 'en-US' } = {}) {
  const [isListening, setIsListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [status, setStatus] = useState('idle') // 'idle' | 'listening' | 'restarting' | 'ready' | 'error' | 'unsupported'
  const [error, setError] = useState(null)

  const recognitionRef = useRef(null)
  const shouldListenRef = useRef(false)
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

  // Log browser capabilities on mount
  useEffect(() => {
    console.log('[STT] Browser:', {
      speechRecognition: typeof window !== 'undefined' && !!window.SpeechRecognition,
      webkitSpeechRecognition: typeof window !== 'undefined' && !!window.webkitSpeechRecognition,
      isSecureContext: typeof window !== 'undefined' && !!window.isSecureContext,
    })
  }, [])

  // Clean up recognition instance safely
  const cleanupRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null
        recognitionRef.current.onaudiostart = null
        recognitionRef.current.onspeechstart = null
        recognitionRef.current.onspeechend = null
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onend = null
        recognitionRef.current.abort()
      } catch (_) {}
      recognitionRef.current = null
    }
  }, [])

  // Create clean SpeechRecognition instance
  const createRecognition = useCallback(() => {
    if (!isSupported) {
      return null
    }

    cleanupRecognition()

    const recognition = new SpeechRecognitionClass()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang || 'en-US'
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      console.log('[STT] recognition started')
      isStartingRef.current = false
      setError(null)
      setIsListening(true)
      setStatus('listening')
      lastProcessedIndexRef.current = -1
    }

    recognition.onaudiostart = () => {
      console.log('[STT] audio capture started')
    }

    recognition.onspeechstart = () => {
      console.log('[STT] speech detected')
    }

    recognition.onspeechend = () => {
      console.log('[STT] speech ended')
    }

    recognition.onresult = (event) => {
      console.log('[STT] result received', event)
      let finalTranscript = ''
      let currentInterim = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i]
        const transcript = item[0]?.transcript || ''
        if (item.isFinal) {
          if (i > lastProcessedIndexRef.current) {
            lastProcessedIndexRef.current = i
            finalTranscript += transcript
          }
        } else {
          currentInterim += transcript
        }
      }

      if (finalTranscript.trim()) {
        console.log('[STT] Final:', finalTranscript.trim())
        onFinalTranscriptRef.current?.(finalTranscript.trim())
      }

      const trimmedInterim = currentInterim.trim()
      if (trimmedInterim) {
        console.log('[STT] Interim:', trimmedInterim)
      }
      interimTranscriptRef.current = trimmedInterim
      setInterimTranscript(trimmedInterim)
    }

    recognition.onerror = (event) => {
      console.error('[STT] error:', event.error, event)

      if (event.error === 'no-speech') {
        // Non-fatal pause in speech; onend will automatically keep listening if shouldListenRef.current is true
        return
      }

      if (event.error === 'aborted') {
        // Normal during intentional stop/restart
        return
      }

      if (
        event.error === 'not-allowed' ||
        event.error === 'service-not-allowed' ||
        event.error === 'permission-denied'
      ) {
        shouldListenRef.current = false
        setIsListening(false)
        setStatus('error')
        setError('Microphone access is required for voice answers. Please allow microphone permissions in your browser, or type your answer.')
      } else if (event.error === 'audio-capture') {
        shouldListenRef.current = false
        setIsListening(false)
        setStatus('error')
        setError('Could not capture audio from microphone. Please check your mic connection or continue with typing.')
      } else if (event.error === 'network') {
        if (shouldListenRef.current) {
          setStatus('restarting')
        } else {
          setStatus('error')
          setError('Speech recognition network interruption. You can continue typing.')
        }
      }
    }

    recognition.onend = () => {
      console.log('[STT] recognition ended')
      isStartingRef.current = false
      isStoppingRef.current = false

      // Commit any lingering interim speech before restarting so spoken words are never lost
      const lingering = (interimTranscriptRef.current || '').trim()
      if (lingering) {
        onFinalTranscriptRef.current?.(lingering)
        interimTranscriptRef.current = ''
      }
      setInterimTranscript('')
      lastProcessedIndexRef.current = -1

      // If active listening is desired, restart cleanly with a fresh instance
      if (shouldListenRef.current && !isStoppingRef.current) {
        setStatus('restarting')
        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = setTimeout(() => {
          if (shouldListenRef.current && !isStartingRef.current) {
            try {
              const freshRec = createRecognition()
              if (freshRec) {
                isStartingRef.current = true
                freshRec.start()
              }
            } catch (err) {
              isStartingRef.current = false
              console.warn('[STT] restart notice:', err.message)
            }
          }
        }, 150)
      } else {
        setIsListening(false)
        setStatus('ready')
      }
    }

    recognitionRef.current = recognition
    return recognition
  }, [isSupported, lang, cleanupRecognition])

  // Cleanup on unmount
  useEffect(() => {
    if (!isSupported) {
      setStatus('unsupported')
      return
    }

    return () => {
      shouldListenRef.current = false
      clearTimeout(restartTimerRef.current)
      cleanupRecognition()
    }
  }, [isSupported, cleanupRecognition])

  const startListening = useCallback(() => {
    console.log('[STT] Starting recognition')
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser. You can type your answer.')
      setStatus('unsupported')
      return
    }

    setError(null)
    setInterimTranscript('')
    interimTranscriptRef.current = ''
    shouldListenRef.current = true
    isStoppingRef.current = false
    lastProcessedIndexRef.current = -1

    try {
      const recognition = createRecognition()
      if (recognition) {
        isStartingRef.current = true
        recognition.start()
      }
    } catch (err) {
      isStartingRef.current = false
      console.error('[STT] start error:', err)
      setError('Microphone could not be started. You can type your answer.')
    }
  }, [isSupported, createRecognition])

  const stopListening = useCallback(() => {
    shouldListenRef.current = false
    clearTimeout(restartTimerRef.current)
    isStoppingRef.current = true

    // Commit any lingering interim speech before stopping so spoken words are never lost
    const lingering = (interimTranscriptRef.current || '').trim()
    if (lingering) {
      onFinalTranscriptRef.current?.(lingering)
      interimTranscriptRef.current = ''
    }
    setInterimTranscript('')

    cleanupRecognition()
    setIsListening(false)
    setStatus('ready')
  }, [cleanupRecognition])

  /**
   * Commits any pending final recognition segment, stops recognition,
   * and ensures no residual speech leaks into the next question.
   */
  const flushAndStop = useCallback(() => {
    const flushedText = (interimTranscriptRef.current || '').trim()
    shouldListenRef.current = false
    clearTimeout(restartTimerRef.current)
    isStoppingRef.current = true
    lastProcessedIndexRef.current = -1
    interimTranscriptRef.current = ''
    setInterimTranscript('')

    if (flushedText) {
      onFinalTranscriptRef.current?.(flushedText)
    }

    cleanupRecognition()
    setIsListening(false)
    setStatus('ready')

    return { flushedText }
  }, [cleanupRecognition])

  const clearInterim = useCallback(() => {
    interimTranscriptRef.current = ''
    setInterimTranscript('')
  }, [])

  const reset = useCallback(() => {
    shouldListenRef.current = false
    clearTimeout(restartTimerRef.current)
    isStartingRef.current = false
    isStoppingRef.current = false
    lastProcessedIndexRef.current = -1
    interimTranscriptRef.current = ''
    setInterimTranscript('')
    setError(null)

    cleanupRecognition()
    setIsListening(false)
    setStatus('idle')
  }, [cleanupRecognition])

  return {
    isSupported,
    isListening,
    interimTranscript,
    status,
    error,
    startListening,
    stopListening,
    flushAndStop,
    clearInterim,
    reset,
  }
}

export default useSpeechRecognition
