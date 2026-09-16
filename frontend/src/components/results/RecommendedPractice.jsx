import React from 'react'
import { Link } from 'react-router-dom'
import { Target, BookOpen, ArrowRight, Compass } from 'lucide-react'

export default function RecommendedPractice({ recommendedPractice = [], interviewId }) {
  if (!recommendedPractice || recommendedPractice.length === 0) return null

  const practiceBaseUrl = interviewId ? `/create-interview?practiceFrom=${interviewId}` : '/create-interview'

  return (
    <section className="recommended-practice-section" aria-label="Targeted Practice Recommendations">
      <div className="section-header-compact">
        <div className="section-title-wrap">
          <Compass size={18} className="icon-glow-cyan" />
          <div>
            <h2 className="section-title-sm">Recommended Next Steps</h2>
            <p className="section-desc-xs">Roadmap-driven study modules tailored to observed skill gaps</p>
          </div>
        </div>
      </div>

      <div className="practice-cards-grid">
        {recommendedPractice.map((rec, idx) => {
          const priorityClass = rec.priority === 'High' ? 'prio-high' : rec.priority === 'Medium' ? 'prio-med' : 'prio-normal'

          return (
            <div key={idx} className="practice-card glass-card">
              <div className="practice-card-top">
                <span className={`priority-tag ${priorityClass}`}>{rec.priority} Priority</span>
                <h3 className="practice-topic-name">{rec.topic}</h3>
              </div>

              <div className="practice-card-body">
                <div className="practice-detail-block">
                  <span className="block-label">Why it matters:</span>
                  <p className="block-text">{rec.whyItMatters}</p>
                </div>

                <div className="practice-detail-block">
                  <span className="block-label">Suggested action:</span>
                  <p className="block-text">{rec.suggestedAction}</p>
                </div>
              </div>

              <div className="practice-card-footer">
                <Link
                  to={rec.practiceUrl || practiceBaseUrl}
                  className="btn-practice-cta"
                  title={`Start targeted practice for ${rec.topic}`}
                >
                  <span>Practice Questions</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
