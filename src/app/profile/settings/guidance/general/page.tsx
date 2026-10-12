import AccountPage, { SettingsLink } from '@/components/AccountPage'

export default function GeneralInformationPage() {
  return <AccountPage title="General Information" back="/profile/settings/guidance">
    <section className="panel"><h2>Using Seatbelt</h2><p>Seatbelt connects Riders and Drivers through trip posts, offers and accepted ride agreements. Your chosen session mode controls the relevant feed and posting options.</p><p>Keep required account information up to date. Driver availability requires identity and vehicle eligibility approval; expired required documents restrict Driver access.</p></section>
    <section className="panel"><h2>Payments and service availability</h2><p>Review the amount, currency and current payment or subscription status in the relevant screen. A pending request is not a completed payment, refund or cancellation.</p><p>International settlement, authenticated cameras, background checks, passkeys and SMS require configured services before use. These capabilities must not be inferred from an account badge or saved preference.</p></section>
    <section className="panel"><h2>Help and policy information</h2><p>Use Support for questions, disputes, appeals and privacy requests. For an emergency, contact local emergency services first.</p><SettingsLink href="/privacy-policy" title="Privacy Policy" /><SettingsLink href="/terms-of-service" title="Terms of Service" /><SettingsLink href="/profile/settings/support" title="Contact support" /></section>
  </AccountPage>
}
