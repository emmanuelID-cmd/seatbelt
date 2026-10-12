import AccountPage, { SettingsLink } from '@/components/AccountPage'

export default function GuidancePage() {
  return <AccountPage title="Guidance">
    <nav className="panel" aria-label="Guidance topics"><SettingsLink href="/profile/settings/guidance/faqs" title="FAQs" /><SettingsLink href="/profile/settings/guidance/dos-and-donts" title="DOs and DON'Ts" /><SettingsLink href="/profile/settings/guidance/general" title="General Information" /><SettingsLink href="/profile/settings/data-usage" title="Data Usage" /><SettingsLink href="/profile/settings/support" title="Support, disputes & appeals" /></nav>
  </AccountPage>
}
