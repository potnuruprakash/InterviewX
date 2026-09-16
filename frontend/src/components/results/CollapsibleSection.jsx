import React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function CollapsibleSection({
  id,
  title,
  subtitle,
  icon: Icon,
  badgeText,
  badgeType = 'default',
  isOpen,
  onToggle,
  children,
}) {
  return (
    <section className={`collapsible-section-card glass-card ${isOpen ? 'is-open' : 'is-closed'}`} id={`section-wrap-${id}`}>
      <button
        type="button"
        className="collapsible-section-header"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`section-content-${id}`}
      >
        <div className="collapsible-header-left">
          {Icon && (
            <div className="collapsible-icon-box">
              <Icon size={18} />
            </div>
          )}
          <div className="collapsible-titles">
            <h2 className="collapsible-title-text">{title}</h2>
            {subtitle && <span className="collapsible-subtitle-text">{subtitle}</span>}
          </div>
        </div>

        <div className="collapsible-header-right">
          {badgeText && (
            <span className={`collapsible-status-badge badge-${badgeType}`}>
              {badgeText}
            </span>
          )}
          <span className="collapsible-chevron">
            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </div>
      </button>

      {isOpen && (
        <div id={`section-content-${id}`} className="collapsible-section-content animate-fade-in">
          {children}
        </div>
      )}
    </section>
  )
}
