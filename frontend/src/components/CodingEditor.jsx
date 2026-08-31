import { useState, useEffect, useRef } from 'react'
import { Code2, RotateCcw, Copy, Check, MessageSquareCode, Sparkles } from 'lucide-react'
import './CodingEditor.css'

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'sql', label: 'SQL' },
]

export default function CodingEditor({
  starterCode = '',
  defaultLanguage = 'javascript',
  onCodeChange,
  onLanguageChange,
  onExplanationChange,
  codeValue = '',
  explanationValue = '',
  disabled = false,
}) {
  const [language, setLanguage] = useState(defaultLanguage || 'javascript')
  const [activeTab, setActiveTab] = useState('code') // 'code' | 'explanation'
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (defaultLanguage) {
      setLanguage(defaultLanguage)
    }
  }, [defaultLanguage])

  const handleLanguageSelect = (e) => {
    const newLang = e.target.value
    setLanguage(newLang)
    if (onLanguageChange) onLanguageChange(newLang)
  }

  const handleKeyDown = (e) => {
    if (disabled) return
    // Handle Tab key for proper indentation
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const spaces = '  '
      const newValue = (codeValue || '').substring(0, start) + spaces + (codeValue || '').substring(end)
      if (onCodeChange) onCodeChange(newValue)
      // Set cursor position after inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + spaces.length
      }, 0)
    }
  }

  const handleReset = () => {
    if (disabled) return
    if (window.confirm('Reset code to starter template?')) {
      if (onCodeChange) onCodeChange(starterCode || '')
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeValue || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  // Calculate line numbers
  const lines = (codeValue || '').split('\n')
  const lineNumbers = lines.map((_, i) => i + 1)

  return (
    <div className="coding-editor-container">
      {/* Editor Header */}
      <div className="coding-editor-header">
        <div className="ce-left">
          <div className="ce-badge">
            <Code2 size={15} />
            <span>Code Editor</span>
          </div>
          {/* Tab Switcher: Code vs Solution Explanation */}
          <div className="ce-tabs">
            <button
              type="button"
              className={`ce-tab-btn ${activeTab === 'code' ? 'active' : ''}`}
              onClick={() => setActiveTab('code')}
            >
              Solution Code
            </button>
            <button
              type="button"
              className={`ce-tab-btn ${activeTab === 'explanation' ? 'active' : ''}`}
              onClick={() => setActiveTab('explanation')}
            >
              <MessageSquareCode size={13} />
              <span>Explanation & Trade-offs</span>
            </button>
          </div>
        </div>

        <div className="ce-right">
          {/* Language Selector */}
          <div className="ce-lang-select-wrapper">
            <select
              value={language}
              onChange={handleLanguageSelect}
              disabled={disabled}
              className="ce-lang-select"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {activeTab === 'code' && (
            <>
              <button
                type="button"
                className="ce-action-btn"
                onClick={handleCopy}
                title="Copy code"
              >
                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                className="ce-action-btn"
                onClick={handleReset}
                disabled={disabled}
                title="Reset to template"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Editor Body */}
      {activeTab === 'code' ? (
        <div className="ce-editor-wrapper">
          {/* Line Numbers Gutter */}
          <div className="ce-gutter" aria-hidden="true">
            {lineNumbers.map((n) => (
              <div key={n} className="ce-line-num">{n}</div>
            ))}
          </div>

          {/* Textarea Code Canvas */}
          <textarea
            ref={textareaRef}
            className="ce-textarea"
            value={codeValue}
            onChange={(e) => onCodeChange && onCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`// Write your ${language} solution here...\n// Tab inserts 2 spaces`}
            disabled={disabled}
            spellCheck="false"
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
          />
        </div>
      ) : (
        <div className="ce-explanation-wrapper">
          <div className="ce-explanation-hint">
            <Sparkles size={14} />
            <span>Explain your architectural approach, algorithm complexity (Big O), or edge cases. You can type here or speak in Voice/Video mode.</span>
          </div>
          <textarea
            className="ce-explanation-textarea"
            value={explanationValue}
            onChange={(e) => onExplanationChange && onExplanationChange(e.target.value)}
            placeholder="Explain your approach, time/space complexity (e.g. O(n) time, O(1) space), and trade-offs considered..."
            disabled={disabled}
            rows={7}
          />
        </div>
      )}

      {/* Footer info */}
      <div className="ce-footer">
        <span className="ce-info-chip">{lines.length} lines</span>
        <span className="ce-info-chip">{(codeValue || '').length} chars</span>
        <span className="ce-info-chip">Indentation: 2 spaces</span>
      </div>
    </div>
  )
}
