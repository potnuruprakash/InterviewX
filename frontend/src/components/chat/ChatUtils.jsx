import React from 'react'
import { Copy, Check } from 'lucide-react'

// Clean raw artifacts like svgsvg, svgjavascript, or escaped markdown
export const sanitizeMessageText = (raw) => {
  if (!raw || typeof raw !== 'string') return ''
  return raw
    .replace(/\\+(\*|_|`|#|\[|\])/g, '$1')
    .replace(/svg(?:svg)+[a-z0-9_-]*/gi, '')
    .replace(/\bsvg(javascript|typescript|python|jsx|tsx|css|html|bash|json|sql|java|go|rust|cpp|c|dart)\b/gi, '$1')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
}

// Inline formatting parser for links, bold, italic, and inline code
export const renderFormattedLine = (line) => {
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

    // Split by links: [text](url)
    const linkParts = cPart.split(/(\[[^\]]+\]\([^)\s]+\))/g)
    return linkParts.map((lPart, lIdx) => {
      const linkMatch = lPart.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
      if (linkMatch) {
        const [, linkText, linkUrl] = linkMatch
        return (
          <a
            key={`${cIdx}-${lIdx}`}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="md-link"
          >
            {linkText}
          </a>
        )
      }

      // Split by bold (**text**)
      const boldParts = lPart.split(/(\*\*[^*]+\*\*)/g)
      return boldParts.map((bPart, bIdx) => {
        if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length >= 4) {
          return <strong key={`${cIdx}-${lIdx}-${bIdx}`}>{bPart.slice(2, -2)}</strong>
        }

        // Split by italic (*text*)
        const italicParts = bPart.split(/(\*[^*]+\*)/g)
        return italicParts.map((iPart, iIdx) => {
          if (iPart.startsWith('*') && iPart.endsWith('*') && iPart.length >= 2) {
            return <em key={`${cIdx}-${lIdx}-${bIdx}-${iIdx}`}>{iPart.slice(1, -1)}</em>
          }
          return iPart
        })
      })
    })
  })
}

// Helper to normalize language names
const normalizeLanguage = (lang = '') => {
  const map = {
    js: 'JavaScript',
    javascript: 'JavaScript',
    py: 'Python',
    python: 'Python',
    java: 'Java',
    sql: 'SQL',
    html: 'HTML',
    css: 'CSS',
    dart: 'Dart',
    bash: 'Bash',
    sh: 'Bash',
    shell: 'Bash',
    json: 'JSON',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    cpp: 'C++',
    c: 'C',
    go: 'Go',
  }
  return map[lang.toLowerCase()] || lang || 'Code'
}

// Parses raw markdown table lines into table headers and rows
const renderTableBlock = (tableLines, key) => {
  if (!tableLines || tableLines.length < 2) return null

  const parseRow = (line) => {
    return line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim())
  }

  const headers = parseRow(tableLines[0])
  // Line 1 is the separator: |---|---|
  const bodyRows = tableLines.slice(2).map(parseRow)

  return (
    <div key={key} className="md-table-wrapper">
      <table className="md-table">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{renderFormattedLine(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => (
                <td key={cIdx}>{renderFormattedLine(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Full message content renderer: renders code blocks with copy buttons, tables, blockquotes, lists, headings
export const renderMessageContent = (content, copiedCodeId, onCopyCode) => {
  const clean = sanitizeMessageText(content || '')
  const parts = clean.split(/(```[\s\S]*?```)/g)

  return parts.map((part, pIdx) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const match = part.match(/^```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```$/)
      const rawLang = (match ? match[1] : '') || 'code'
      const lang = normalizeLanguage(rawLang)
      const codeText = match ? match[2] : part.slice(3, -3)
      const blockId = `code-block-${pIdx}`
      const isCopied = copiedCodeId === blockId

      return (
        <div key={pIdx} className="assistant-code-wrapper">
          <div className="assistant-code-header">
            <span className="code-lang-tag">{lang}</span>
            <button
              type="button"
              className="btn-copy-code"
              onClick={() => onCopyCode && onCopyCode(codeText, blockId)}
              title="Copy code snippet"
              aria-label={`Copy ${lang} code`}
            >
              {isCopied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
              <span>{isCopied ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>
          <pre className="assistant-code-block">
            <code>{codeText.trim()}</code>
          </pre>
        </div>
      )
    }

    // Markdown text chunk: handle tables, blockquotes, headings, lists, paragraphs
    const lines = part.split('\n')
    const elements = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]
      const trimmed = line.trim()

      if (!trimmed) {
        elements.push(<div key={`spacer-${i}`} className="md-spacer" />)
        i++
        continue
      }

      // Detect Table: line starts and ends with '|' and next line is a divider '| --- |'
      if (
        trimmed.startsWith('|') &&
        trimmed.endsWith('|') &&
        i + 1 < lines.length &&
        /^\|?(\s*:?-+:?\s*\|)+\s*$/.test(lines[i + 1].trim())
      ) {
        const tableLines = [trimmed, lines[i + 1].trim()]
        i += 2
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim())
          i++
        }
        elements.push(renderTableBlock(tableLines, `table-${i}`))
        continue
      }

      // Blockquotes (> Quote text)
      if (trimmed.startsWith('>')) {
        const quoteText = trimmed.replace(/^>\s?/, '')
        elements.push(
          <blockquote key={`quote-${i}`} className="md-blockquote">
            {renderFormattedLine(quoteText)}
          </blockquote>
        )
        i++
        continue
      }

      // Headings
      if (trimmed.startsWith('#### ')) {
        elements.push(
          <h5 key={`h4-${i}`} className="md-heading-4">
            {renderFormattedLine(trimmed.slice(5))}
          </h5>
        )
        i++
        continue
      }
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4 key={`h3-${i}`} className="md-heading-3">
            {renderFormattedLine(trimmed.slice(4))}
          </h4>
        )
        i++
        continue
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h3 key={`h2-${i}`} className="md-heading-2">
            {renderFormattedLine(trimmed.slice(3))}
          </h3>
        )
        i++
        continue
      }
      if (trimmed.startsWith('# ')) {
        elements.push(
          <h2 key={`h1-${i}`} className="md-heading-1">
            {renderFormattedLine(trimmed.slice(2))}
          </h2>
        )
        i++
        continue
      }

      // Bullet lists
      if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <div key={`bullet-${i}`} className="md-bullet-item">
            <span className="md-bullet-dot">•</span>
            <div className="md-bullet-text">{renderFormattedLine(trimmed.slice(2))}</div>
          </div>
        )
        i++
        continue
      }

      // Numbered lists
      if (/^\d+\.\s/.test(trimmed)) {
        const numMatch = trimmed.match(/^(\d+)\.\s(.*)$/)
        elements.push(
          <div key={`num-${i}`} className="md-number-item">
            <span className="md-number-tag">{numMatch[1]}.</span>
            <div className="md-number-text">{renderFormattedLine(numMatch[2])}</div>
          </div>
        )
        i++
        continue
      }

      // Horizontal rule
      if (trimmed === '---' || trimmed === '***') {
        elements.push(<hr key={`hr-${i}`} className="md-divider" />)
        i++
        continue
      }

      // Regular paragraph
      elements.push(
        <p key={`p-${i}`} className="md-paragraph">
          {renderFormattedLine(trimmed)}
        </p>
      )
      i++
    }

    return (
      <div key={pIdx} className="assistant-text-chunk">
        {elements}
      </div>
    )
  })
}

// Date grouping utility for sidebar conversations
export const groupSessionsByDate = (sessions = []) => {
  const groups = {
    today: [],
    yesterday: [],
    previous7Days: [],
    older: [],
  }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
  const startOf7DaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000

  for (const s of sessions) {
    const timestamp = new Date(s.updatedAt || s.createdAt).getTime()
    if (isNaN(timestamp)) {
      groups.older.push(s)
    } else if (timestamp >= startOfToday) {
      groups.today.push(s)
    } else if (timestamp >= startOfYesterday) {
      groups.yesterday.push(s)
    } else if (timestamp >= startOf7DaysAgo) {
      groups.previous7Days.push(s)
    } else {
      groups.older.push(s)
    }
  }

  return [
    { label: 'Today', items: groups.today },
    { label: 'Yesterday', items: groups.yesterday },
    { label: 'Previous 7 Days', items: groups.previous7Days },
    { label: 'Older', items: groups.older },
  ].filter((g) => g.items.length > 0)
}
