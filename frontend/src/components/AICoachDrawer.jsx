import { useState, useEffect, useRef } from 'react'
import {
  MessageSquare, Send, Sparkles, X, ChevronDown, RotateCcw,
  Lightbulb, Zap, HelpCircle, ArrowUpRight, Copy, Check
} from 'lucide-react'
import { useAuthApi } from '../services/api'

export default function AICoachDrawer({ activeInterviewId = null, currentQuestion = null }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState(null)
  const { authApi, isLoaded, isSignedIn } = useAuthApi()
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  // Load conversation state on open or mount
  useEffect(() => {
    if (!isSignedIn || !isLoaded) return
    const fetchState = async () => {
      try {
        const res = await authApi.get('/api/coach/state')
        if (res.data?.conversation?.messages) {
          setMessages(res.data.conversation.messages)
        }
      } catch (err) {
        console.warn('Could not load coach state:', err.message)
      }
    }
    fetchState()
  }, [isSignedIn, isLoaded])

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  // Auto-resize composer textarea (1-2 lines default, max-height 120px)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(120, textareaRef.current.scrollHeight)}px`
    }
  }, [input])

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || input).trim()
    if (!query || sending) return

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = '40px'

    // Optimistically append user message
    const userMsg = { role: 'user', content: query, timestamp: new Date() }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)

    try {
      const res = await authApi.post('/api/coach/chat', {
        message: query,
        activeInterviewId,
        activeQuestionId: currentQuestion?.id,
      })

      if (res.data?.message) {
        const botMsg = {
          role: 'assistant',
          content: res.data.message,
          action: res.data.action,
          metadata: res.data.metadata,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, botMsg])
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an issue connecting to the coach service. Please try again.',
          timestamp: new Date(),
        },
      ])
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleReset = async () => {
    if (!window.confirm('Reset coach chat conversation?')) return
    try {
      await authApi.post('/api/coach/reset')
      setMessages([
        {
          role: 'assistant',
          content: 'Chat history cleared. How can I help you prepare today?',
          timestamp: new Date(),
        },
      ])
    } catch (err) {
      console.warn('Error resetting conversation:', err.message)
    }
  }

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 999,
          backgroundColor: '#6366f1',
          color: '#ffffff',
          border: 'none',
          borderRadius: '50%',
          width: '56px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(99, 102, 241, 0.45)',
          cursor: 'pointer',
          transition: 'transform 0.2s ease',
        }}
        title="Open AI Coach"
      >
        <Sparkles size={24} />
      </button>

      {/* Slide-over Drawer */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '24px',
          width: '420px',
          maxWidth: 'calc(100vw - 32px)',
          height: '620px',
          maxHeight: 'calc(100vh - 120px)',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.7)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backdropFilter: 'blur(12px)',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.1))',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}>
                <Sparkles size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  AI Coach
                </h3>
                <span style={{ fontSize: '11px', color: '#10b981' }}>● Active Context</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleReset}
                title="Reset Conversation"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                }}
              >
                <RotateCcw size={16} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Quick Context Action Shortcuts */}
          <div style={{
            padding: '8px 12px',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
          }}>
            <button
              onClick={() => handleSendMessage('Give me a hint')}
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: '#c7d2fe',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Lightbulb size={12} /> Give me a hint
            </button>
            <button
              onClick={() => handleSendMessage('Make it harder')}
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#fca5a5',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Zap size={12} /> Make it harder
            </button>
            <button
              onClick={() => handleSendMessage('Run mock on Python')}
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#6ee7b7',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              🚀 Mock on Python
            </button>
          </div>

          {/* Messages Feed */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  backgroundColor: m.role === 'user' ? '#4f46e5' : 'rgba(30, 41, 59, 0.7)',
                  color: '#f8fafc',
                  padding: '10px 14px',
                  borderRadius: m.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  border: m.role === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  position: 'relative',
                }}
              >
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {m.content}
                </div>
                {m.role === 'assistant' && (
                  <button
                    onClick={() => handleCopy(m.content, idx)}
                    title="Copy message"
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                  >
                    {copiedIndex === idx ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  </button>
                )}
              </div>
            ))}
            {sending && (
              <div style={{
                alignSelf: 'flex-start',
                backgroundColor: 'rgba(30, 41, 59, 0.7)',
                color: '#94a3b8',
                padding: '8px 12px',
                borderRadius: '12px',
                fontSize: '12px',
              }}>
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Compact Expanding Composer */}
          <div style={{
            padding: '12px 14px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: '#090d16',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
          }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything, request hints, change tracks... (Enter to send)"
              rows={1}
              style={{
                flex: 1,
                minHeight: '38px',
                maxHeight: '120px',
                backgroundColor: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.4,
              }}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || sending}
              style={{
                backgroundColor: input.trim() && !sending ? '#6366f1' : 'rgba(99, 102, 241, 0.3)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() && !sending ? 'pointer' : 'default',
                flexShrink: 0,
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
