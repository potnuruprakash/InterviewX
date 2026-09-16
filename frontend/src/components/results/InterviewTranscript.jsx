import React from 'react'
import { FileText, Code, CheckCircle, SkipForward, Clock } from 'lucide-react'

export default function InterviewTranscript({ transcript = [] }) {
  if (!transcript || transcript.length === 0) {
    return (
      <div className="section-unavailable-card">
        <FileText size={20} className="icon-muted" />
        <div>
          <h3 className="unavail-title">Transcript Not Recorded</h3>
          <p className="unavail-sub">No candidate transcript was recorded for this session.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="transcript-body">
      <p className="transcript-intro">
        Chronological record of interview questions and candidate responses submitted during this practice session.
      </p>

      <div className="transcript-items-list">
        {transcript.map((item, idx) => {
          const isSkipped = item.status === 'SKIPPED'
          const isTimeout = item.status === 'TIMEOUT'

          return (
            <div key={item.id || idx} className="transcript-entry">
              <div className="transcript-entry-header">
                <span className="t-question-pill">Question {item.number}</span>
                {isSkipped && <span className="t-status-tag tag-skipped">Skipped</span>}
                {isTimeout && <span className="t-status-tag tag-timeout">Timed Out</span>}
                {!isSkipped && !isTimeout && <span className="t-status-tag tag-answered">Answered</span>}
              </div>

              <div className="t-question-prompt">
                <strong>Q:</strong> {item.question}
              </div>

              <div className="t-candidate-answer">
                <strong>Candidate:</strong>
                {isSkipped ? (
                  <span className="t-muted-text">Question skipped by candidate.</span>
                ) : isTimeout ? (
                  <span className="t-muted-text">Question timed out before submission.</span>
                ) : item.code ? (
                  <pre className="t-code-block"><code>{item.code}</code></pre>
                ) : item.answer ? (
                  <p className="t-text-block">{item.answer}</p>
                ) : (
                  <span className="t-muted-text">No answer text recorded.</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
