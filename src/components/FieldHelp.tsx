'use client'

import { useId, useState, type ReactNode } from 'react'

type FieldHelpProps = {
  fieldName: string
  children: ReactNode
}

export default function FieldHelp({ fieldName, children }: FieldHelpProps) {
  const [isOpen, setIsOpen] = useState(false)
  const helpId = useId()

  return (
    <span style={{ position: 'relative', display: 'inline-flex', marginLeft: '6px', verticalAlign: 'middle' }}>
      <button
        type="button"
        aria-label={`Help for ${fieldName}`}
        aria-expanded={isOpen}
        aria-controls={helpId}
        onClick={() => setIsOpen(!isOpen)}
        style={{ width: '16px', height: '16px', padding: 0, borderRadius: '50%', border: '1px solid #777', background: 'transparent', color: '#aaa', fontSize: '11px', fontWeight: '700', lineHeight: '14px', cursor: 'pointer' }}
      >
        ?
      </button>
      {isOpen && (
        <span
          id={helpId}
          role="tooltip"
          style={{ position: 'absolute', zIndex: 20, top: '22px', left: 0, width: 'min(18rem, calc(100vw - 3rem))', padding: '10px 12px', border: '0.5px solid #555', borderRadius: '8px', background: '#111', color: '#ccc', fontSize: '12px', fontWeight: '400', lineHeight: '1.45', letterSpacing: 0, textTransform: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}
        >
          {children}
        </span>
      )}
    </span>
  )
}
