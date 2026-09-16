import React from 'react'
import { Sparkles, Bot, X } from 'lucide-react'
import './FloatingCoachButton.css'

export default function FloatingCoachButton({ isOpen, onClick, hasUnread = false }) {
  return (
    <div className="floating-coach-container">
      <button
        type="button"
        className={`floating-coach-btn ${isOpen ? 'is-active' : ''}`}
        onClick={onClick}
        aria-label={isOpen ? 'Close AI Training Coach' : 'Open AI Training Coach'}
        title="AI Training Coach (Resume & Interview Drills)"
      >
        <span className="coach-btn-glow" />
        <div className="coach-btn-icon-wrap">
          {isOpen ? (
            <X size={22} className="icon-close animate-spin-once" />
          ) : (
            <>
              <Bot size={22} className="icon-bot" />
              <Sparkles size={12} className="icon-sparkle" />
            </>
          )}
        </div>
        {!isOpen && <span className="coach-btn-label">AI Coach</span>}
        {hasUnread && !isOpen && <span className="coach-unread-dot" />}
      </button>
    </div>
  )
}
