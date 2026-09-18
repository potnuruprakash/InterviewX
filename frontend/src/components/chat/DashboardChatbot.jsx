import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Send,
  Plus,
  Clock,
  Trash2,
  Mic,
  MicOff,
  Copy,
  Check,
  Bot,
  Sparkles,
  Square,
  RotateCw,
  RefreshCw,
  ArrowDown,
  AlertCircle,
  Menu,
} from 'lucide-react'
import { useAuthApi } from '../../services/api'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import {
  renderMessageContent,
  groupSessionsByDate,
  sanitizeMessageText,
} from './ChatUtils'
import './DashboardChatbot.css'

export default function DashboardChatbot({ isOpen, onClose }) {
  const {
    getDashboardChatSessions,
    createDashboardChatSession,
    getDashboardChatSession,
    deleteDashboardChatSession,
    sendDashboardChatMessage,
    regenerateDashboardChatResponse,
  } = useAuthApi()

  // Chatbot state
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  // chatStatus: 'IDLE' | 'SENDING' | 'THINKING' | 'STREAMING'
  const [chatStatus, setChatStatus] = useState('IDLE')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [copiedCodeId, setCopiedCodeId] = useState(null)
  const [copiedMsgId, setCopiedMsgId] = useState(null)
  const [error, setError] = useState(null)
  const [userScrolledUp, setUserScrolledUp] = useState(false)

  const messagesEndRef = useRef(null)
  const streamContainerRef = useRef(null)
  const inputRef = useRef(null)
  const streamingIntervalRef = useRef(null)
  const abortControllerRef = useRef(null)

  // ── Speech Recognition Integration ─────────────────────────────────────────
  const handleFinalSpeech = useCallback((phrase) => {
    if (phrase) {
      setInputValue((prev) => (prev ? `${prev.trim()} ${phrase}` : phrase))
    }
  }, [])

  const {
    isListening,
    startListening,
    stopListening,
    isSupported: isSpeechSupported,
  } = useSpeechRecognition({ onFinalTranscript: handleFinalSpeech })

  const toggleVoiceInput = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  // ── Auto-scroll logic ───────────────────────────────────────────────────────
  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  const handleScroll = () => {
    if (!streamContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = streamContainerRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 75
    setUserScrolledUp(!isNearBottom)
  }

  useEffect(() => {
    if (!userScrolledUp) {
      scrollToBottom('smooth')
    }
  }, [messages, chatStatus, userScrolledUp])

  // Focus input on open & setup Escape key close
  useEffect(() => {
    if (isOpen) {
      setUserScrolledUp(false)
      scrollToBottom('auto')
      setTimeout(() => inputRef.current?.focus(), 150)

      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      window.addEventListener('keydown', handleEscape)
      return () => window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Clean up streaming on unmount
  useEffect(() => {
    return () => {
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Auto-grow textarea dynamically
  useEffect(() => {
    if (!inputRef.current) return
    inputRef.current.style.height = 'auto'
    if (!inputValue) {
      inputRef.current.style.height = '24px'
      inputRef.current.style.overflowY = 'hidden'
    } else {
      const scrollH = inputRef.current.scrollHeight
      const nextHeight = Math.min(Math.max(scrollH, 24), 130)
      inputRef.current.style.height = `${nextHeight}px`
      inputRef.current.style.overflowY = scrollH > 130 ? 'auto' : 'hidden'
    }
  }, [inputValue])

  // ── Load Sessions List (History) ──────────────────────────────────────────
  const loadSessionsList = useCallback(async () => {
    try {
      const res = await getDashboardChatSessions()
      const list = res.data?.sessions || []
      setSessions(list)
      return list
    } catch (err) {
      console.warn('[DashboardChatbot] Could not load sessions:', err.message)
      return []
    }
  }, [getDashboardChatSessions])

  // ── Start Brand New Session ────────────────────────────────────────────────
  const startNewSession = useCallback(async () => {
    // Stop any active generation
    handleStopGenerating()
    setLoading(true)
    setError(null)
    try {
      const res = await createDashboardChatSession()
      const created = res.data?.session
      const initialMsgs = res.data?.messages || []

      setActiveSession(created)
      setMessages(initialMsgs)
      loadSessionsList()
    } catch (err) {
      console.error('[DashboardChatbot] Error creating session:', err)
      setError('Could not start new chat session. Please retry.')
    } finally {
      setLoading(false)
      setSidebarOpen(false)
    }
  }, [createDashboardChatSession, loadSessionsList])

  // ── Select Past Session from History ───────────────────────────────────────
  const selectSession = useCallback(
    async (sessionId) => {
      handleStopGenerating()
      setLoading(true)
      setError(null)
      try {
        const res = await getDashboardChatSession(sessionId)
        if (res.data?.session) {
          setActiveSession(res.data.session)
          setMessages(res.data.messages || [])
        }
      } catch (err) {
        console.error('[DashboardChatbot] Error loading session:', err)
        setError('Could not retrieve conversation.')
      } finally {
        setLoading(false)
        setSidebarOpen(false)
      }
    },
    [getDashboardChatSession]
  )

  // ── Delete Past Session ───────────────────────────────────────────────────
  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation()
    try {
      await deleteDashboardChatSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      if (activeSession?.id === sessionId) {
        startNewSession()
      }
    } catch (err) {
      console.error('[DashboardChatbot] Delete error:', err)
    }
  }

  // ── Progressive Text Streaming Engine ──────────────────────────────────────
  const streamResponseProgressively = (fullText, suggestions = [], finalMsgMeta = {}) => {
    setChatStatus('STREAMING')
    const tokens = fullText.match(/\s+|\S+/g) || [fullText]
    let currentText = ''
    let tokenIndex = 0

    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current)
    }

    streamingIntervalRef.current = setInterval(() => {
      // Stream 2 tokens per tick for a smooth natural reading cadence
      const chunk = tokens.slice(tokenIndex, tokenIndex + 2).join('')
      tokenIndex += 2
      currentText += chunk

      setMessages((prev) => {
        const lastIdx = prev.length - 1
        if (lastIdx >= 0 && prev[lastIdx].role === 'assistant' && prev[lastIdx].isStreaming) {
          const updated = [...prev]
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: currentText,
            isThinking: false,
          }
          return updated
        }
        return prev
      })

      if (tokenIndex >= tokens.length) {
        clearInterval(streamingIntervalRef.current)
        streamingIntervalRef.current = null
        setMessages((prev) => {
          const lastIdx = prev.length - 1
          if (lastIdx >= 0 && prev[lastIdx].role === 'assistant') {
            const updated = [...prev]
            updated[lastIdx] = {
              ...updated[lastIdx],
              ...finalMsgMeta,
              content: fullText,
              isStreaming: false,
              isThinking: false,
              metadata: {
                ...updated[lastIdx].metadata,
                suggestions: suggestions || [],
              },
            }
            return updated
          }
          return prev
        })
        setChatStatus('IDLE')
      }
    }, 20)
  }

  // ── Stop Generating ────────────────────────────────────────────────────────
  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current)
      streamingIntervalRef.current = null
    }
    setMessages((prev) => {
      const lastIdx = prev.length - 1
      if (lastIdx >= 0 && prev[lastIdx].role === 'assistant' && prev[lastIdx].isStreaming) {
        const updated = [...prev]
        const partialContent = updated[lastIdx].content || '*(Response stopped)*'
        updated[lastIdx] = {
          ...updated[lastIdx],
          content: partialContent,
          isStreaming: false,
          isThinking: false,
        }
        return updated
      }
      return prev
    })
    setChatStatus('IDLE')
  }

  // ── Send Message ──────────────────────────────────────────────────────────
  const handleSendMessage = async (textToSend = null) => {
    const text = (textToSend !== null ? textToSend : inputValue).trim()
    if (!text || chatStatus !== 'IDLE' || !activeSession?.id) return

    setInputValue('')
    setError(null)
    setUserScrolledUp(false)

    // User message
    const tempUserMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }

    // Thinking placeholder assistant message
    const placeholderAssistantMsg = {
      id: `assistant-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      isThinking: true,
      isStreaming: true,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, tempUserMsg, placeholderAssistantMsg])
    setChatStatus('THINKING')

    abortControllerRef.current = new AbortController()

    try {
      const res = await sendDashboardChatMessage(activeSession.id, { content: text })
      const serverUserMsg = res.data?.userMessage
      const serverAssistantMsg = res.data?.assistantMessage
      const updatedSession = res.data?.session

      if (updatedSession) {
        setActiveSession((prev) => ({
          ...prev,
          title: updatedSession.title,
          updatedAt: updatedSession.updatedAt,
        }))
      }

      // Replace user temp message with server version
      setMessages((prev) => {
        const list = [...prev]
        const uIdx = list.findIndex((m) => m.id === tempUserMsg.id)
        if (uIdx !== -1 && serverUserMsg) {
          list[uIdx] = serverUserMsg
        }
        return list
      })

      const fullReply = serverAssistantMsg?.content || ''
      const followUps = serverAssistantMsg?.metadata?.suggestions || []

      streamResponseProgressively(fullReply, followUps, {
        id: serverAssistantMsg?.id || placeholderAssistantMsg.id,
        createdAt: serverAssistantMsg?.createdAt,
      })

      loadSessionsList()
    } catch (err) {
      if (err.name === 'CanceledError' || err.message === 'canceled') {
        return
      }
      console.error('[DashboardChatbot] Send error:', err)
      // Remove placeholder
      setMessages((prev) => prev.filter((m) => m.id !== placeholderAssistantMsg.id))
      setError('I could not generate a response right now.')
      setChatStatus('IDLE')
    }
  }

  // ── Regenerate Response ────────────────────────────────────────────────────
  const handleRegenerate = async () => {
    if (chatStatus !== 'IDLE' || !activeSession?.id) return

    // Find last assistant message index
    const lastAssistantIdx = [...messages].reverse().findIndex((m) => m.role === 'assistant')
    if (lastAssistantIdx === -1) return

    const actualIdx = messages.length - 1 - lastAssistantIdx
    setError(null)
    setUserScrolledUp(false)

    // Mark that message as thinking/streaming
    setMessages((prev) => {
      const updated = [...prev]
      updated[actualIdx] = {
        ...updated[actualIdx],
        content: '',
        isThinking: true,
        isStreaming: true,
      }
      return updated
    })

    setChatStatus('THINKING')
    abortControllerRef.current = new AbortController()

    try {
      const res = await regenerateDashboardChatResponse(activeSession.id)
      const serverAssistantMsg = res.data?.assistantMessage

      const fullReply = serverAssistantMsg?.content || ''
      const followUps = serverAssistantMsg?.metadata?.suggestions || []

      streamResponseProgressively(fullReply, followUps, {
        id: serverAssistantMsg?.id || messages[actualIdx].id,
        createdAt: serverAssistantMsg?.createdAt,
      })
    } catch (err) {
      if (err.name === 'CanceledError' || err.message === 'canceled') return
      console.error('[DashboardChatbot] Regenerate error:', err)
      setError('Could not regenerate response. Please retry.')
      setChatStatus('IDLE')
      setMessages((prev) => {
        const updated = [...prev]
        if (updated[actualIdx]) {
          updated[actualIdx] = {
            ...updated[actualIdx],
            isThinking: false,
            isStreaming: false,
          }
        }
        return updated
      })
    }
  }

  // ── Retry Last User Message on Error ──────────────────────────────────────
  const handleRetry = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUserMsg?.content) {
      handleSendMessage(lastUserMsg.content)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (chatStatus === 'IDLE') {
        handleSendMessage()
      }
    }
  }

  // ── NEW CHAT EVERY TIME CHATBOT OPENS ──────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      startNewSession()
      loadSessionsList()
    } else {
      setSidebarOpen(false)
      handleStopGenerating()
    }
  }, [isOpen])

  // Copy code block
  const handleCopyCode = (codeText, blockId) => {
    navigator.clipboard?.writeText(codeText)
    setCopiedCodeId(blockId)
    setTimeout(() => setCopiedCodeId(null), 2000)
  }

  // Copy whole assistant message
  const handleCopyMessage = (msgContent, msgId) => {
    const cleanText = sanitizeMessageText(msgContent)
    navigator.clipboard?.writeText(cleanText)
    setCopiedMsgId(msgId)
    setTimeout(() => setCopiedMsgId(null), 2000)
  }

  if (!isOpen) return null

  // Grouped history for sidebar
  const historyGroups = groupSessionsByDate(sessions)

  // Default suggestions when chat is empty
  const defaultSuggestions = [
    'Explain Django MVT',
    'What are MongoDB indexes?',
    'Explain REST APIs',
    'Help me with Python',
    'How should I prepare for backend development?',
  ]

  // Contextual follow-up suggestions from last assistant response
  const lastMsg = messages[messages.length - 1]
  const isGenerating = chatStatus !== 'IDLE'
  const showInitialSuggestions = messages.length <= 1 && !isGenerating
  const contextualFollowUps =
    !showInitialSuggestions &&
    lastMsg?.role === 'assistant' &&
    !lastMsg.isStreaming &&
    lastMsg.metadata?.suggestions?.length > 0
      ? lastMsg.metadata.suggestions
      : []

  return (
    <div className="dashboard-chatbot-overlay" onClick={onClose} id="dashboard-chatbot-overlay">
      <div
        className="dashboard-chatbot-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Dashboard AI Assistant"
        id="dashboard-chatbot-panel"
      >
        {/* ── HEADER ────────────────────────────────────────────────────── */}
        <header className="dashboard-chatbot-header" id="dashboard-chatbot-header">
          <div className="header-left-cluster">
            <button
              type="button"
              className={`btn-history-toggle ${sidebarOpen ? 'is-active' : ''}`}
              onClick={() => setSidebarOpen((prev) => !prev)}
              title="Dashboard Chat History"
              aria-label="Toggle chat history"
              id="dashboard-btn-toggle-history"
            >
              <Menu size={16} className="history-menu-icon" />
              <Clock size={15} className="history-clock-icon" />
              <span className="history-btn-text">History</span>
              {sessions.length > 0 && (
                <span className="history-badge-count">{sessions.length}</span>
              )}
            </button>

            <div className="header-title-box">
              <div className="header-title-row">
                <Bot size={18} color="#818cf8" />
                <h3 className="header-title">Dashboard AI</h3>
              </div>
              <span className="header-badge">
                <span className="badge-dot" />
                Learning & Career Assistant
              </span>
            </div>
          </div>

          <div className="header-actions-right">
            <button
              type="button"
              className="btn-header-new-chat"
              onClick={startNewSession}
              title="Start a new chat session"
              aria-label="Start new chat"
              id="dashboard-btn-new-chat"
            >
              <Plus size={14} />
              <span>New Chat</span>
            </button>
            <button
              type="button"
              className="btn-header-close"
              onClick={onClose}
              title="Close Chatbot (Esc)"
              aria-label="Close Chatbot"
              id="dashboard-btn-close"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ── SIDEBAR (HISTORY) ─────────────────────────────────────────── */}
        <aside
          className={`dashboard-chatbot-sidebar ${sidebarOpen ? 'is-open' : ''}`}
          id="dashboard-chatbot-sidebar"
        >
          <div className="sidebar-top">
            <span className="sidebar-heading">
              <Clock size={14} /> Recent Chats
            </span>
            <div className="sidebar-top-actions">
              <button
                type="button"
                className="btn-new-chat-sidebar"
                onClick={startNewSession}
                id="dashboard-sidebar-new-chat-btn"
                aria-label="Start new chat"
              >
                <Plus size={13} />
                <span>New</span>
              </button>
              <button
                type="button"
                className="btn-close-sidebar-mobile"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close history sidebar"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="sidebar-list">
            {historyGroups.length === 0 ? (
              <p className="sidebar-empty">No Dashboard chats yet.</p>
            ) : (
              historyGroups.map((group) => (
                <div key={group.label} className="history-group">
                  <div className="history-group-header">{group.label}</div>
                  <div className="history-group-items">
                    {group.items.map((conv) => (
                      <div
                        key={conv.id}
                        className={`sidebar-item ${activeSession?.id === conv.id ? 'is-active' : ''}`}
                        onClick={() => selectSession(conv.id)}
                        id={`dashboard-chat-item-${conv.id}`}
                      >
                        <div className="sidebar-item-info">
                          <div className="sidebar-item-title">{conv.title}</div>
                          <div className="sidebar-item-footer">
                            {conv.updatedAt
                              ? new Date(conv.updatedAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-del-conv"
                          title="Delete chat"
                          aria-label="Delete chat"
                          onClick={(e) => handleDeleteSession(e, conv.id)}
                          id={`dashboard-delete-chat-${conv.id}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* ── MAIN CHAT STREAM ─────────────────────────────────────────── */}
        <main
          className="dashboard-chatbot-stream"
          id="dashboard-chatbot-stream"
          ref={streamContainerRef}
          onScroll={handleScroll}
        >
          {loading ? (
            <div className="stream-loading-wrap">
              <div className="typing-dots">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
              <p>Preparing fresh session...</p>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => {
                const isAssistant = msg.role === 'assistant'
                const isLatestAssistant =
                  isAssistant &&
                  index ===
                    messages.length -
                      1 -
                      [...messages].reverse().findIndex((m) => m.role === 'assistant')

                return (
                  <div
                    key={msg.id || index}
                    className={`stream-msg-row ${isAssistant ? 'from-assistant' : 'from-user'}`}
                  >
                    {isAssistant && (
                      <div className="msg-avatar assistant-avatar" title="Dashboard AI">
                        <Sparkles size={16} />
                      </div>
                    )}
                    <div className="msg-bubble-container">
                      <div className="msg-bubble">
                        {msg.isThinking ? (
                          <div className="stream-thinking-indicator">
                            <Bot size={15} className="thinking-bot-icon" />
                            <span>AI is thinking...</span>
                            <div className="typing-dots">
                              <span className="typing-dot" />
                              <span className="typing-dot" />
                              <span className="typing-dot" />
                            </div>
                          </div>
                        ) : (
                          renderMessageContent(msg.content, copiedCodeId, handleCopyCode)
                        )}
                      </div>

                      {/* Assistant message action bar (Copy, Regenerate) */}
                      {isAssistant && !msg.isThinking && !msg.isStreaming && (
                        <div className="msg-action-bar">
                          <button
                            type="button"
                            className="btn-msg-action"
                            onClick={() => handleCopyMessage(msg.content, msg.id || index)}
                            title="Copy response"
                            aria-label="Copy response"
                          >
                            {copiedMsgId === (msg.id || index) ? (
                              <>
                                <Check size={12} className="text-success" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          {isLatestAssistant && (
                            <button
                              type="button"
                              className="btn-msg-action"
                              onClick={handleRegenerate}
                              disabled={isGenerating}
                              title="Regenerate response"
                              aria-label="Regenerate response"
                            >
                              <RotateCw size={12} className={isGenerating ? 'spin' : ''} />
                              <span>Regenerate</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Error Notice with Retry */}
              {error && (
                <div className="stream-error-card">
                  <AlertCircle size={18} color="#f87171" className="error-icon" />
                  <div className="stream-error-content">
                    <strong>Something went wrong.</strong>
                    <p>{error}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-retry-error"
                    onClick={handleRetry}
                    aria-label="Retry last request"
                  >
                    <RefreshCw size={13} />
                    <span>Retry</span>
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}

          {/* Floating scroll to bottom button */}
          {userScrolledUp && (
            <button
              type="button"
              className="btn-scroll-bottom"
              onClick={() => {
                setUserScrolledUp(false)
                scrollToBottom('smooth')
              }}
              aria-label="Scroll to latest response"
            >
              <ArrowDown size={14} />
              <span>New response</span>
            </button>
          )}
        </main>

        {/* ── QUICK SUGGESTIONS (INITIAL OPEN) ───────────────────────────── */}
        {showInitialSuggestions && (
          <div className="dashboard-suggestions-bar" id="dashboard-suggestions-bar">
            <div className="suggestions-prompt-label">Try asking:</div>
            <div className="suggestions-chips-row">
              {defaultSuggestions.map((sug, sIdx) => (
                <button
                  key={sIdx}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => handleSendMessage(sug)}
                  disabled={isGenerating}
                  id={`dashboard-sug-${sIdx}`}
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── CONTEXTUAL FOLLOW-UP SUGGESTIONS ───────────────────────────── */}
        {contextualFollowUps.length > 0 && !isGenerating && (
          <div className="dashboard-followups-bar" id="dashboard-followups-bar">
            <div className="followups-label">Related:</div>
            <div className="followups-chips-row">
              {contextualFollowUps.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="followup-chip"
                  onClick={() => handleSendMessage(item)}
                  id={`dashboard-followup-${idx}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── FOOTER INPUT BAR ─────────────────────────────────────────── */}
        <footer className="dashboard-chatbot-footer" id="dashboard-chatbot-footer">
          <div className="input-bar-container">
            <textarea
              ref={inputRef}
              className="chatbot-textarea"
              placeholder="Ask anything about technical concepts, code, or preparation..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isGenerating}
              aria-label="Message composer input"
              id="dashboard-chatbot-input"
            />

            {isSpeechSupported && (
              <button
                type="button"
                className={`btn-voice-input ${isListening ? 'is-listening' : ''}`}
                onClick={toggleVoiceInput}
                disabled={isGenerating}
                title={isListening ? 'Stop listening' : 'Dictate with voice'}
                aria-label="Voice input"
                id="dashboard-chatbot-mic-btn"
              >
                {isListening ? <MicOff size={15} /> : <Mic size={15} />}
              </button>
            )}

            {isGenerating ? (
              <button
                type="button"
                className="btn-stop-generating"
                onClick={handleStopGenerating}
                title="Stop generating"
                aria-label="Stop generating response"
                id="dashboard-chatbot-stop-btn"
              >
                <Square size={13} fill="currentColor" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn-send-message"
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim()}
                title="Send message (Enter)"
                aria-label="Send message"
                id="dashboard-chatbot-send-btn"
              >
                <Send size={15} />
              </button>
            )}
          </div>

          <div className="input-footer-note">
            <span>InterviewX Assistant • Strictly non-interviewer AI tutor</span>
            <span>Shift + Enter for new line</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
