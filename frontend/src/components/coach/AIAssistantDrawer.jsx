import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bot,
  X,
  Send,
  ArrowUp,
  Sparkles,
  RotateCcw,
  Paperclip,
  Mic,
  MicOff,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Compass,
  Target,
  ArrowRight,
  Code2,
  Lightbulb,
  BookOpen,
  Calendar,
  AlertCircle,
} from 'lucide-react'
import { useAuthApi } from '../../services/api'
import useSpeechRecognition, { normalizeTranscriptJoin } from '../../hooks/useSpeechRecognition'
import './AIAssistantDrawer.css'

// Clean raw artifacts like svgsvg, svgjavascript, or escaped markdown
const sanitizeMessageText = (raw) => {
  if (!raw || typeof raw !== 'string') return ''
  return raw
    .replace(/\\+(\*|_|`|#|\[|\])/g, '$1') // unescape markdown backslashes like \*\*text\*\* or \\\*\\\*text\\\*\\\*
    .replace(/svg(?:svg)+[a-z0-9_-]*/gi, '') // clean stray svgsvg... placeholder strings
    .replace(/\bsvg(javascript|typescript|python|jsx|tsx|css|html|bash|json|sql|java|go|rust|cpp|c)\b/gi, '$1') // strip svg<lang> leaks
    .replace(/<svg[\s\S]*?<\/svg>/gi, '') // strip raw inline SVG tags
}

// Inline formatting parser for bold, italic, code
const renderFormattedLine = (line) => {
  if (!line) return null
  const cleanLine = line.replace(/\\+(\*|_|`|#|\[|\])/g, '$1')

  // Split by inline code first (`code`)
  const codeParts = cleanLine.split(/(`[^`]+`)/g)
  return codeParts.map((cPart, cIdx) => {
    if (cPart.startsWith('`') && cPart.endsWith('`') && cPart.length >= 2) {
      return (
        <code key={cIdx} className="md-inline-code">
          {cPart.slice(1, -1)}
        </code>
      )
    }

    // Split by bold (**text**)
    const boldParts = cPart.split(/(\*\*[^*]+\*\*)/g)
    return boldParts.map((bPart, bIdx) => {
      if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length >= 4) {
        return <strong key={`${cIdx}-${bIdx}`}>{bPart.slice(2, -2)}</strong>
      }

      // Split by italic (*text*)
      const italicParts = bPart.split(/(\*[^*]+\*)/g)
      return italicParts.map((iPart, iIdx) => {
        if (iPart.startsWith('*') && iPart.endsWith('*') && iPart.length >= 2) {
          return <em key={`${cIdx}-${bIdx}-${iIdx}`}>{iPart.slice(1, -1)}</em>
        }
        return iPart
      })
    })
  })
}

export default function AIAssistantDrawer({
  isOpen,
  onClose,
  initialSourceInterviewId = null,
  initialTopic = null,
}) {
  const {
    getConversations,
    getConversation,
    createConversation,
    deleteConversation,
    sendConversationMessage,
    uploadChatAttachment,
    rateMessageFeedback,
    getCoachProfile,
  } = useAuthApi()

  // Main chat state
  const [conversations, setConversations] = useState([])
  const [activeConversation, setActiveConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [attachedFiles, setAttachedFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('idle') // 'idle' | 'uploading' | 'success' | 'failed'
  const [uploadError, setUploadError] = useState(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [error, setError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [copiedCodeId, setCopiedCodeId] = useState(null)
  const [copiedMsgId, setCopiedMsgId] = useState(null)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const activeInterviewRef = useRef(null)

  // ── Speech Recognition Integration ─────────────────────────────────────────
  const handleFinalSpeech = useCallback((phrase) => {
    if (phrase) {
      setInputValue((prev) => normalizeTranscriptJoin(prev, phrase))
    }
  }, [])

  const {
    isListening,
    interimTranscript,
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

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen, messages, sending])

  // Auto-grow textarea dynamically based on content (1 line default ~24px, max 120px)
  useEffect(() => {
    if (!inputRef.current) return
    inputRef.current.style.height = 'auto'
    if (!inputValue) {
      inputRef.current.style.height = '24px'
      inputRef.current.style.overflowY = 'hidden'
    } else {
      const scrollH = inputRef.current.scrollHeight
      const nextHeight = Math.min(Math.max(scrollH, 24), 120)
      inputRef.current.style.height = `${nextHeight}px`
      inputRef.current.style.overflowY = scrollH > 120 ? 'auto' : 'hidden'
    }
  }, [inputValue])

  // ── Load Conversation List & Active Conversation ───────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res = await getConversations()
      const list = res.data?.conversations || []
      setConversations(list)
      return list
    } catch (err) {
      console.warn('[AIAssistantDrawer] Could not load conversation list:', err.message)
      return []
    }
  }, [getConversations])

  const selectConversation = useCallback(
    async (id) => {
      setLoading(true)
      setError(null)
      try {
        const res = await getConversation(id)
        if (res.data?.conversation) {
          setActiveConversation(res.data.conversation)
          setMessages(res.data.messages || [])
          localStorage.setItem('interviewx_ai_active_conv', id)
        }
      } catch (err) {
        console.error('[AIAssistantDrawer] Failed to load conversation:', err)
        setError('Could not retrieve conversation.')
      } finally {
        setLoading(false)
        setSidebarOpen(false)
      }
    },
    [getConversation]
  )

  const startNewConversation = useCallback(
    async (forceInterviewId = null) => {
      setLoading(true)
      setError(null)
      try {
        const payload = {
          contextType: forceInterviewId ? 'results' : 'dashboard',
          sourceInterviewId: forceInterviewId || null,
          topic: initialTopic || null,
        }
        const res = await createConversation(payload)
        const created = res.data?.conversation
        const initialMsgs = res.data?.messages || []

        setActiveConversation(created)
        setMessages(initialMsgs)
        if (created?.id) {
          localStorage.setItem('interviewx_ai_active_conv', created.id)
        }
        loadConversations()
      } catch (err) {
        console.error('[AIAssistantDrawer] New conversation error:', err)
        setError('Could not initialize conversation. Please retry.')
      } finally {
        setLoading(false)
        setSidebarOpen(false)
      }
    },
    [createConversation, initialTopic, loadConversations]
  )

  // Initialization when drawer is opened
  useEffect(() => {
    if (!isOpen) return

    const init = async () => {
      const list = await loadConversations()

      // If opened from Results page with an interview context
      if (initialSourceInterviewId && activeInterviewRef.current !== initialSourceInterviewId) {
        activeInterviewRef.current = initialSourceInterviewId
        startNewConversation(initialSourceInterviewId)
        return
      }

      // If active conversation already loaded, keep it
      if (activeConversation) return

      // Otherwise resume last cached conversation or start fresh
      const cachedId = localStorage.getItem('interviewx_ai_active_conv')
      const existsInList = list.find((c) => c.id === cachedId)

      if (existsInList) {
        selectConversation(cachedId)
      } else if (list.length > 0) {
        selectConversation(list[0].id)
      } else {
        startNewConversation()
      }
    }

    init()
  }, [isOpen, initialSourceInterviewId, activeConversation, loadConversations, selectConversation, startNewConversation])

  // Delete conversation
  const handleDeleteConversation = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Delete this conversation?')) return

    try {
      await deleteConversation(id)
      const updated = conversations.filter((c) => c.id !== id)
      setConversations(updated)

      if (activeConversation?.id === id) {
        if (updated.length > 0) {
          selectConversation(updated[0].id)
        } else {
          startNewConversation()
        }
      }
    } catch (err) {
      console.error('[AIAssistantDrawer] Delete error:', err)
    }
  }

  // ── Send Message ───────────────────────────────────────────────────────────
  const handleSend = async (customText = null) => {
    const textToSend = (customText || inputValue || '').trim()
    if ((!textToSend && attachedFiles.length === 0) || sending || !activeConversation?.id) return

    setSending(true)
    setError(null)
    setInputValue('')
    const currentAttachments = [...attachedFiles]
    setAttachedFiles([])

    // Optimistic user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: textToSend || `Attached: ${currentAttachments[0]?.name || 'File'}`,
      attachments: currentAttachments,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      const res = await sendConversationMessage(activeConversation.id, {
        content: textToSend,
        attachments: currentAttachments,
      })

      const { assistantMessage, conversation: updatedConv } = res.data

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        tempUserMsg,
        assistantMessage,
      ])

      if (updatedConv) {
        setActiveConversation((prev) => ({ ...prev, ...updatedConv }))
        setConversations((prev) =>
          prev.map((c) => (c.id === updatedConv.id ? { ...c, title: updatedConv.title } : c))
        )
      }
    } catch (err) {
      console.error('[AIAssistantDrawer] Send error:', err)
      setError(err.message || 'Failed to send message.')
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  // ── File Attachment Upload ─────────────────────────────────────────────────
  const handleFileAttach = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadStatus('uploading')
    setUploadError(null)
    setError(null)
    try {
      const res = await uploadChatAttachment(file)
      if (res.data?.attachment) {
        setAttachedFiles((prev) => [...prev, res.data.attachment])
        setUploadStatus('success')
      }
    } catch (err) {
      console.error('[AIAssistantDrawer] Attachment upload error:', err)
      setUploadStatus('failed')
      setUploadError(err.response?.data?.message || 'Could not analyze this file. Please upload PDF, DOCX, or text files.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (idx) => {
    setAttachedFiles((prev) => {
      const remaining = prev.filter((_, i) => i !== idx)
      if (remaining.length === 0 && uploadStatus === 'success') {
        setUploadStatus('idle')
      }
      return remaining
    })
  }

  // ── Feedback & Copy Actions ────────────────────────────────────────────────
  const handleRateFeedback = async (msgId, rating) => {
    try {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, feedback: m.feedback === rating ? null : rating } : m))
      )
      await rateMessageFeedback(msgId, rating)
    } catch (err) {
      console.warn('[AIAssistantDrawer] Feedback error:', err)
    }
  }

  const handleCopyText = (text, msgId) => {
    navigator.clipboard?.writeText(text)
    setCopiedMsgId(msgId)
    setTimeout(() => setCopiedMsgId(null), 2000)
  }

  const handleCopyCode = (codeText, blockId) => {
    navigator.clipboard?.writeText(codeText)
    setCopiedCodeId(blockId)
    setTimeout(() => setCopiedCodeId(null), 2000)
  }

  if (!isOpen) return null

  // Suggestions row adapts dynamically based on context
  const hasUploadedResume =
    attachedFiles.some((a) => a.isResume) ||
    messages.some(
      (m) =>
        m.attachments?.some((a) => a.isResume) ||
        m.metadata?.intent?.includes('RESUME') ||
        m.content?.toLowerCase().includes('resume')
    )

  const currentSuggestions =
    messages[messages.length - 1]?.metadata?.suggestions ||
    (hasUploadedResume
      ? ['Create My Plan', 'Start Practice', 'Analyze My Weaknesses', 'What should I prepare?']
      : [
          'Prepare for my interview',
          'Analyze my resume',
          'Create a study plan',
          'Practice my weak areas',
        ])

  return (
    <div className="assistant-overlay" onClick={onClose}>
      <div
        className="assistant-panel glass-card animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="InterviewX AI Assistant"
      >
        {/* ── 1. TOP NAV / HEADER BAR ─────────────────────────────────── */}
        <header className="assistant-header">
          <div className="header-left-cluster">
            <button
              type="button"
              className={`btn-history-toggle ${sidebarOpen ? 'is-active' : ''}`}
              onClick={() => setSidebarOpen((prev) => !prev)}
              title="Toggle Conversation History"
              aria-label="Toggle Conversation History"
            >
              <Clock size={16} />
              <span className="history-badge-count">{conversations.length}</span>
            </button>

            <div className="header-title-box">
              <div className="header-title-row">
                <Bot size={18} className="header-bot-icon" />
                <h3 className="header-conv-title" title={activeConversation?.title || 'InterviewX AI'}>
                  {activeConversation?.title || 'InterviewX AI'}
                </h3>
              </div>
              <span className="header-context-tag">
                {activeConversation?.contextType === 'results' ? (
                  <>
                    <Target size={11} /> Interview Targeted Practice
                  </>
                ) : (
                  <>
                    <Compass size={11} /> Career & Interview Preparation
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="header-right-cluster">
            <button
              type="button"
              className="btn-header-action"
              onClick={() => startNewConversation()}
              title="New Chat"
              aria-label="New Chat"
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              className="btn-header-action"
              onClick={onClose}
              title="Close Assistant"
              aria-label="Close Assistant"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ── 2. SIDEBAR: RECENT CONVERSATIONS DRAWER ─────────────────── */}
        <aside className={`assistant-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
          <div className="sidebar-top">
            <span className="sidebar-heading">
              <Clock size={14} /> Recent Conversations
            </span>
            <button
              type="button"
              className="btn-new-chat-sidebar"
              onClick={() => startNewConversation()}
            >
              <Plus size={14} /> New Chat
            </button>
          </div>

          <div className="sidebar-list">
            {conversations.length === 0 ? (
              <p className="sidebar-empty">No conversation history yet.</p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`sidebar-item ${activeConversation?.id === conv.id ? 'is-active' : ''}`}
                  onClick={() => selectConversation(conv.id)}
                >
                  <div className="sidebar-item-title">{conv.title}</div>
                  <div className="sidebar-item-footer">
                    <span className="sidebar-item-date">
                      {conv.updatedAt ? new Date(conv.updatedAt).toLocaleDateString() : ''}
                    </span>
                    <button
                      type="button"
                      className="btn-del-conv"
                      title="Delete chat"
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* ── 3. MAIN MESSAGE STREAM ──────────────────────────────────── */}
        <main className="assistant-stream">
          {loading ? (
            <div className="stream-loading-wrap">
              <div className="loading-spinner-sm" />
              <p>Loading your AI session...</p>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => {
                const isAssistant = msg.role === 'assistant'
                const rawContent = sanitizeMessageText(msg.content || '')

                // Parse code blocks vs regular markdown
                const parts = rawContent.split(/(```[\s\S]*?```)/g)

                return (
                  <div
                    key={msg.id || index}
                    className={`stream-msg-row ${isAssistant ? 'from-assistant' : 'from-user'}`}
                  >
                    {isAssistant && (
                      <div className="msg-bot-avatar">
                        <Bot size={15} />
                      </div>
                    )}

                    <div className="msg-bubble-container">
                      <div className={`msg-bubble ${isAssistant ? 'bubble-assistant' : 'bubble-user'}`}>
                        {/* Attachments preview if user attached files */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="msg-attachment-pills">
                            {msg.attachments.map((att, aIdx) => (
                              <div key={aIdx} className="msg-attachment-pill">
                                <FileText size={13} />
                                <span className="att-name">{att.name}</span>
                                {att.size > 0 && (
                                  <span className="att-size">
                                    ({Math.round(att.size / 1024)} KB)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Text and formatted code blocks */}
                        <div className="msg-body-markdown">
                          {parts.map((part, pIdx) => {
                            if (part.startsWith('```') && part.endsWith('```')) {
                              const match = part.match(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/)
                              const rawLang = match?.[1] || 'code'
                              const lang = rawLang.replace(/^svg/i, '').trim() || 'code'
                              const code = match?.[2] || ''
                              const blockId = `${msg.id || index}-${pIdx}`

                              return (
                                <div key={pIdx} className="code-block-card">
                                  <div className="code-block-header">
                                    <span className="code-lang-label">
                                      <Code2 size={12} aria-hidden="true" /> {lang}
                                    </span>
                                    <button
                                      type="button"
                                      className="btn-copy-code"
                                      onClick={() => handleCopyCode(code, blockId)}
                                    >
                                      {copiedCodeId === blockId ? (
                                        <>
                                          <Check size={12} className="text-success" aria-hidden="true" /> Copied
                                        </>
                                      ) : (
                                        <>
                                          <Copy size={12} aria-hidden="true" /> Copy Code
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <pre className="code-pre">
                                    <code>{code}</code>
                                  </pre>
                                </div>
                              )
                            }

                            // Regular text rendering with headings, bullet lists, and inline markdown
                            return (
                              <div key={pIdx} className="text-paragraphs">
                                {part.split('\n').map((line, lIdx) => {
                                  if (!line.trim()) return <div key={lIdx} className="line-spacer" />
                                  if (line.startsWith('### ')) {
                                    return (
                                      <h4 key={lIdx} className="md-h3">
                                        {renderFormattedLine(line.replace('### ', ''))}
                                      </h4>
                                    )
                                  }
                                  if (line.startsWith('#### ')) {
                                    return (
                                      <h5 key={lIdx} className="md-h4">
                                        {renderFormattedLine(line.replace('#### ', ''))}
                                      </h5>
                                    )
                                  }
                                  if (line.startsWith('• ') || line.startsWith('- ')) {
                                    return (
                                      <div key={lIdx} className="md-bullet">
                                        <span className="bullet-sym">•</span>
                                        <span>{renderFormattedLine(line.slice(2))}</span>
                                      </div>
                                    )
                                  }
                                  const numMatch = line.match(/^(\d+\.)\s+(.*)$/)
                                  if (numMatch) {
                                    return (
                                      <div key={lIdx} className="md-bullet">
                                        <span className="bullet-sym font-mono">{numMatch[1]}</span>
                                        <span>{renderFormattedLine(numMatch[2])}</span>
                                      </div>
                                    )
                                  }
                                  return <p key={lIdx}>{renderFormattedLine(line)}</p>
                                })}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Assistant Actions Bar (Copy, Like, Dislike, Retry) */}
                      {isAssistant && (
                        <div className="msg-actions-bar">
                          <button
                            type="button"
                            className="btn-msg-action"
                            onClick={() => handleCopyText(msg.content, msg.id || index)}
                            title="Copy response"
                          >
                            {copiedMsgId === (msg.id || index) ? (
                              <Check size={13} className="text-success" aria-hidden="true" />
                            ) : (
                              <Copy size={13} aria-hidden="true" />
                            )}
                          </button>
                          <button
                            type="button"
                            className={`btn-msg-action ${msg.feedback === 'like' ? 'feedback-active' : ''}`}
                            onClick={() => handleRateFeedback(msg.id, 'like')}
                            title="Good response"
                          >
                            <ThumbsUp size={13} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className={`btn-msg-action ${msg.feedback === 'dislike' ? 'feedback-active' : ''}`}
                            onClick={() => handleRateFeedback(msg.id, 'dislike')}
                            title="Needs improvement"
                          >
                            <ThumbsDown size={13} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="btn-msg-action"
                            onClick={() => handleSend('Explain that again with more concrete examples.')}
                            title="Retry / Regenerate"
                          >
                            <RotateCcw size={13} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Typing indicator */}
              {sending && (
                <div className="stream-msg-row from-assistant">
                  <div className="msg-bot-avatar">
                    <Bot size={15} />
                  </div>
                  <div className="msg-bubble bubble-assistant typing-bubble">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                </div>
              )}

              {/* Error banner */}
              {error && (
                <div className="stream-error-banner">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </main>

        {/* ── 4. QUICK SUGGESTIONS FLOATING BAR ───────────────────────── */}
        {!sending && (
          <div className="suggestions-scroll-wrap" aria-label="Suggested Prompts">
            <div className="suggestions-track">
              {currentSuggestions.slice(0, 5).map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => handleSend(sug)}
                >
                  <Sparkles size={11} className="sug-icon" />
                  <span>{sug}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 5. COMPOSER / INPUT SECTION ─────────────────────────────── */}
        {/* ── 5. COMPOSER / INPUT SECTION (COMPACT INTEGRATED CHATGPT-STYLE) ── */}
        <footer className="assistant-composer">
          {/* File Attachment Status Preview */}
          {(attachedFiles.length > 0 || uploadStatus === 'uploading' || uploadStatus === 'failed') && (
            <div className="composer-attachments-preview">
              {uploadStatus === 'uploading' && (
                <div className="preview-chip chip-uploading">
                  <div className="loading-spinner-xs" />
                  <span>Uploading & analyzing file...</span>
                </div>
              )}
              {uploadStatus === 'failed' && (
                <div className="preview-chip chip-failed">
                  <AlertCircle size={13} />
                  <span>{uploadError || '⚠ Could not analyze this file'}</span>
                  <button
                    type="button"
                    className="btn-retry-upload"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    className="btn-remove-att"
                    onClick={() => setUploadStatus('idle')}
                    title="Dismiss"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              {attachedFiles.map((file, fIdx) => (
                <div key={fIdx} className="preview-chip chip-processed">
                  <Check size={12} className="text-success" />
                  <FileText size={12} />
                  <span className="preview-name">
                    {file.isResume ? `✓ Resume processed: ${file.name}` : file.name}
                  </span>
                  <button
                    type="button"
                    className="btn-remove-att"
                    onClick={() => removeAttachment(fIdx)}
                    title="Remove attachment"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Voice Input Listening Banner */}
          {isListening && (
            <div className="composer-voice-indicator">
              <span className="voice-pulse-dot" />
              <span>Listening... Speak your interview question or response</span>
              {interimTranscript && <span className="voice-interim">"{interimTranscript}"</span>}
            </div>
          )}

          <form
            className="composer-form"
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
          >
            <div className="ai-composer-box">
              {/* + Action Menu Trigger */}
              <div className="attach-menu-anchor">
                <button
                  type="button"
                  className={`btn-composer-icon ${showAttachMenu ? 'is-active' : ''}`}
                  onClick={() => setShowAttachMenu((prev) => !prev)}
                  title="Upload Resume or Document"
                  disabled={sending || uploadStatus === 'uploading'}
                  aria-label="Attach file or upload resume"
                >
                  <Plus size={18} />
                </button>

                {showAttachMenu && (
                  <div className="attach-dropdown-menu glass-card">
                    <button
                      type="button"
                      className="dropdown-menu-item"
                      onClick={() => {
                        setShowAttachMenu(false)
                        fileInputRef.current?.click()
                      }}
                    >
                      <FileText size={15} className="menu-icon-accent" />
                      <div className="menu-text-col">
                        <span className="menu-title">Upload Resume</span>
                        <span className="menu-sub">PDF, DOCX, TXT for skill analysis</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="dropdown-menu-item"
                      onClick={() => {
                        setShowAttachMenu(false)
                        fileInputRef.current?.click()
                      }}
                    >
                      <Compass size={15} className="menu-icon-accent" />
                      <div className="menu-text-col">
                        <span className="menu-title">Upload Job Description</span>
                        <span className="menu-sub">Target interview practice</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="dropdown-menu-item"
                      onClick={() => {
                        setShowAttachMenu(false)
                        fileInputRef.current?.click()
                      }}
                    >
                      <Paperclip size={15} className="menu-icon-accent" />
                      <div className="menu-text-col">
                        <span className="menu-title">Upload Study Notes</span>
                        <span className="menu-sub">Code snippets or notes</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                style={{ display: 'none' }}
                onChange={handleFileAttach}
              />

              {/* Sleek Auto-Growing Textarea */}
              <textarea
                ref={inputRef}
                className="ai-composer-textarea"
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={
                  isListening
                    ? 'Listening... Speak now'
                    : 'Ask anything... (e.g. "What skills are on my resume?", "Quiz me")'
                }
                disabled={sending}
              />

              {/* Right Side Actions: Voice + Send */}
              <div className="composer-actions-right">
                {isSpeechSupported && (
                  <button
                    type="button"
                    className={`btn-composer-icon ${isListening ? 'tool-recording' : ''}`}
                    onClick={toggleVoiceInput}
                    title={isListening ? 'Stop voice recording' : 'Voice dictation'}
                    disabled={sending}
                    aria-label="Voice dictation"
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                )}

                <button
                  type="submit"
                  className={`btn-composer-send ${Boolean(inputValue.trim() || attachedFiles.length > 0) ? 'is-ready' : ''}`}
                  disabled={(!inputValue.trim() && attachedFiles.length === 0) || sending}
                  aria-label="Send message"
                >
                  <ArrowUp size={16} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </form>

          <div className="composer-disclaimer">
            InterviewX AI can make mistakes. Verify technical details.
          </div>
        </footer>
      </div>
    </div>
  )
}
