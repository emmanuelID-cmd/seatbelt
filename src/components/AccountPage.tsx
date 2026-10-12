'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import {useBackNavigation} from '@/components/AppChrome'

export default function AccountPage({ title, children, back = '/profile/settings', showBack = true, action }: { title: string; children: ReactNode; back?: string; showBack?: boolean; action?: ReactNode }) {
  const goBack=useBackNavigation(back)
  return <main className="account-page"><header className="account-heading">{showBack && <button type="button" className="back-button" aria-label="Go back" onClick={goBack}>←</button>}<h1>{title}</h1>{action && <div className="account-heading-action">{action}</div>}</header>{children}</main>
}

export function SettingsLink({ href, title, description }: { href: string; title: string; description?: string }) {
  return <Link href={href} className="settings-link"><span><strong>{title}</strong>{description && <small>{description}</small>}</span><span aria-hidden="true">›</span></Link>
}

export function Feedback({ error, success }: { error?: string; success?: string }) {
  return <>{error && <div className="form-error-summary" role="alert" tabIndex={-1}>{error}</div>}{success && <p className="success-message" role="status">{success}</p>}</>
}
