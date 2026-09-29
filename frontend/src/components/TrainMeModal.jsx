import { useState } from 'react'
import {
  Sparkles, BookOpen, CheckCircle, Code, ChevronRight,
  Layers, ArrowLeft, RefreshCw, X, Play
} from 'lucide-react'

export default function TrainMeModal({ trainingSession, onClose }) {
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0)
  const [showSolution, setShowSolution] = useState({})

  if (!trainingSession || !trainingSession.topics || trainingSession.topics.length === 0) {
    return null
  }

  const currentTopic = trainingSession.topics[selectedTopicIndex] || trainingSession.topics[0]

  const toggleSolution = (idx) => {
    setShowSolution((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  return (
    <div className="train-me-overlay" style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(5, 7, 15, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px',
    }}>
      <div className="train-me-container" style={{
        backgroundColor: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1000px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.1))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(99, 102, 241, 0.2)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                Train Me: Personalized Weakness Masterclass
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '2px 0 0 0' }}>
                Curated modules based on your exact interview weaknesses and skill gaps
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body with Left Sidebar (Topics) and Right Main Area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Sidebar */}
          <div style={{
            width: '280px',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 600, paddingLeft: '8px' }}>
              Target Topics ({trainingSession.topics.length})
            </span>
            {trainingSession.topics.map((t, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedTopicIndex(idx)}
                style={{
                  textAlign: 'left',
                  padding: '12px',
                  borderRadius: '10px',
                  border: idx === selectedTopicIndex ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid transparent',
                  backgroundColor: idx === selectedTopicIndex ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  color: idx === selectedTopicIndex ? '#f8fafc' : '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: '14px' }}>{t.topic}</div>
                  <span style={{
                    fontSize: '11px',
                    color: t.priority === 'high' ? '#ef4444' : '#f59e0b',
                  }}>
                    {t.priority} priority
                  </span>
                </div>
                <ChevronRight size={16} opacity={idx === selectedTopicIndex ? 1 : 0.4} />
              </button>
            ))}
          </div>

          {/* Right Main Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {currentTopic ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Topic Overview */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{
                      backgroundColor: 'rgba(99, 102, 241, 0.2)',
                      color: '#a5b4fc',
                      fontSize: '12px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontWeight: 600,
                    }}>
                      TARGET SKILL
                    </span>
                    <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                      {currentTopic.topic}
                    </h3>
                  </div>
                  <p style={{ color: '#cbd5e1', fontSize: '15px', lineHeight: 1.6, marginTop: '8px' }}>
                    {currentTopic.explanation}
                  </p>
                </div>

                {/* Practical Examples */}
                {currentTopic.examples?.length > 0 && (
                  <div style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                  }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#93c5fd', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <BookOpen size={16} /> Architectural Examples & Patterns
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#e2e8f0', fontSize: '14px', lineHeight: 1.6 }}>
                      {currentTopic.examples.map((ex, i) => (
                        <li key={i} style={{ marginBottom: '6px' }}>{ex}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Practice Questions */}
                {currentTopic.practiceQuestions?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle size={16} color="#10b981" /> Practice Drill Questions
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {currentTopic.practiceQuestions.map((pq, i) => (
                        <div key={i} style={{
                          backgroundColor: 'rgba(30, 41, 59, 0.4)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '10px',
                          padding: '14px 18px',
                        }}>
                          <p style={{ fontWeight: 500, color: '#f1f5f9', margin: '0 0 8px 0', fontSize: '14px' }}>
                            {i + 1}. {pq.question}
                          </p>
                          {pq.answerGuidance && (
                            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 8px 0' }}>
                              <strong style={{ color: '#cbd5e1' }}>Guidance:</strong> {pq.answerGuidance}
                            </p>
                          )}
                          {pq.keyPoints?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {pq.keyPoints.map((kp, k) => (
                                <span key={k} style={{
                                  fontSize: '11px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                  color: '#cbd5e1',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                }}>
                                  #{kp}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Coding Exercises */}
                {currentTopic.codingExercises?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Code size={16} color="#818cf8" /> Hands-on Coding Exercises
                    </h4>
                    {currentTopic.codingExercises.map((ce, i) => (
                      <div key={i} style={{
                        backgroundColor: '#090d16',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '10px',
                        padding: '16px',
                        marginBottom: '12px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '14px' }}>{ce.title}</span>
                          <span style={{ fontSize: '11px', color: '#818cf8', textTransform: 'uppercase' }}>{ce.language}</span>
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '12px' }}>{ce.description}</p>

                        {ce.starterCode && (
                          <pre style={{
                            backgroundColor: '#030712',
                            padding: '12px',
                            borderRadius: '8px',
                            color: '#a5f3fc',
                            fontSize: '12px',
                            overflowX: 'auto',
                            fontFamily: 'monospace',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                          }}>
                            {ce.starterCode}
                          </pre>
                        )}

                        <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                          <button
                            onClick={() => toggleSolution(i)}
                            style={{
                              backgroundColor: 'rgba(99, 102, 241, 0.2)',
                              border: '1px solid rgba(99, 102, 241, 0.4)',
                              color: '#c7d2fe',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            {showSolution[i] ? 'Hide Solution' : 'Reveal Solution'}
                          </button>
                        </div>

                        {showSolution[i] && ce.solution && (
                          <pre style={{
                            marginTop: '12px',
                            backgroundColor: '#022c22',
                            padding: '12px',
                            borderRadius: '8px',
                            color: '#6ee7b7',
                            fontSize: '12px',
                            overflowX: 'auto',
                            fontFamily: 'monospace',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                          }}>
                            {ce.solution}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              backgroundColor: '#6366f1',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Close Masterclass
          </button>
        </div>
      </div>
    </div>
  )
}
