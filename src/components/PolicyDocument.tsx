import fs from 'node:fs'
import path from 'node:path'
import ReactMarkdown from 'react-markdown'

type PolicyDocumentProps = {
  fileName: string
}

export default function PolicyDocument({ fileName }: PolicyDocumentProps) {
  const filePath = path.join(process.cwd(), 'docs', fileName)
  const content = fs.readFileSync(filePath, 'utf8')

  return (
    <main
      style={{
        maxWidth: '52rem',
        margin: '0 auto',
        padding: '2rem 1.25rem 4rem',
        fontFamily: 'inherit',
        color: 'inherit',
        fontSize: '1rem',
        lineHeight: '1.6rem',
      }}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                lineHeight: '2rem',
                margin: '0 0 2rem',
              }}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <section style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid currentColor' }}>
              <h2
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  lineHeight: '2rem',
                  margin: '0 0 1rem',
                }}
              >
                {children}
              </h2>
            </section>
          ),
          h3: ({ children }) => (
            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                lineHeight: '1.6rem',
                margin: '1.5rem 0 0.75rem',
              }}
            >
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p style={{ margin: '0 0 1rem' }}>{children}</p>
          ),
          ul: ({ children }) => (
            <ul style={{ margin: '0 0 1rem', paddingLeft: '1.5rem' }}>
              {children}
            </ul>
          ),
          li: ({ children }) => (
            <li style={{ marginBottom: '0.5rem' }}>{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote
              style={{
                margin: '1rem 0',
                padding: '0.75rem 1rem',
                borderLeft: '0.25rem solid currentColor',
              }}
            >
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </main>
  )
}