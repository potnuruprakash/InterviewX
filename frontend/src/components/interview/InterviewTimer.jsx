import { useState, useEffect, useRef, memo } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'
import './InterviewTimer.css'

/**
 * Isolated Countdown Timer for the interview.
 * Reads startedAt and durationMinutes as source of truth.
 * Updates internal state every second to prevent re-rendering InterviewPage.
 */
function InterviewTimer({
  startedAt,
  durationMinutes = 30,
  onExpire,
  isComplete = false,
  showLabel = true,
}) {
  const calculateRemaining = () => {
    if (!startedAt) return durationMinutes * 60
    const startMs = new Date(startedAt).getTime()
    const endMs = startMs + durationMinutes * 60 * 1000
    const diffSecs = Math.floor((endMs - Date.now()) / 1000)
    return Math.max(0, diffSecs)
  }

  const [remainingSeconds, setRemainingSeconds] = useState(calculateRemaining)
  const hasExpiredRef = useRef(false)
  const onExpireRef = useRef(onExpire)

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    if (isComplete || !startedAt) return

    // Immediately sync with clock
    const initialRem = calculateRemaining()
    setRemainingSeconds(initialRem)

    if (initialRem <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true
      onExpireRef.current?.()
      return
    }

    const interval = setInterval(() => {
      const rem = calculateRemaining()
      setRemainingSeconds(rem)

      if (rem <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true
        clearInterval(interval)
        onExpireRef.current?.()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [startedAt, durationMinutes, isComplete])

  const formatCountdown = (secs) => {
    if (secs <= 0) return '00:00'
    const mins = Math.floor(secs / 60)
    const s = secs % 60
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const isUrgent = remainingSeconds <= 60 && remainingSeconds > 0
  const isWarning = remainingSeconds <= 300 && remainingSeconds > 60
  const isExpired = remainingSeconds === 0

  const statusClass = isExpired
    ? 'timer-status-expired'
    : isUrgent
    ? 'timer-status-urgent'
    : isWarning
    ? 'timer-status-warning'
    : 'timer-status-normal'

  return (
    <div
      className={`interview-timer-badge ${statusClass}`}
      role="timer"
      aria-live="polite"
      aria-label={`Time remaining: ${formatCountdown(remainingSeconds)}`}
      title={
        isExpired
          ? 'Interview time expired'
          : `Interview countdown: ${formatCountdown(remainingSeconds)} remaining`
      }
    >
      <Clock size={15} className="timer-badge-icon" aria-hidden="true" />
      <div className="timer-badge-text">
        <span className="timer-badge-digits">
          {isExpired ? "00:00" : formatCountdown(remainingSeconds)}
        </span>
        {showLabel && (
          <span className="timer-badge-remaining">
            {isExpired ? "Time's up" : "remaining"}
          </span>
        )}
      </div>
      {isUrgent && (
        <span className="timer-badge-urgent-dot" title="Less than 1 minute remaining" />
      )}
    </div>
  )
}

export default memo(InterviewTimer)
