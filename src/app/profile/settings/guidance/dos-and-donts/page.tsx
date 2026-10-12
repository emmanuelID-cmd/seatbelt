import AccountPage, { SettingsLink } from '@/components/AccountPage'

export default function DosAndDontsPage() {
  return <AccountPage title="DOs and DON&apos;Ts" back="/profile/settings/guidance">
    <section className="panel"><h2>For every ride</h2><ul><li>Do confirm the pickup, destination, time and agreed amount before accepting.</li><li>Do keep account details current and communicate respectfully through the platform.</li><li>Do use Ride History and Support to report problems with the relevant references.</li><li>Do contact local emergency services first in an emergency.</li><li>Do not send passwords, card numbers or identity-document images in messages or support requests.</li><li>Do not change accepted trip terms through an ordinary post edit.</li></ul></section>
    <section className="panel"><h2>For Drivers</h2><ul><li>Do complete identity and vehicle eligibility review before using Driver availability.</li><li>Do renew required documents before their recorded expiration dates.</li><li>Do consider the Rider&apos;s full estimated price range when preparing your offer; the Rider chooses whether to accept.</li><li>Do not treat identity verification alone as confirmation of vehicle registration or insurance approval.</li><li>Do not claim a camera or background check is verified when the service is not active.</li></ul></section>
    <section className="panel"><h2>For Riders</h2><ul><li>Do check the Driver offer and ride details before accepting.</li><li>Do keep pickup instructions clear and share only information needed for the ride.</li><li>Do not assume a ride agreement is a payment receipt; check payment status separately.</li></ul></section>
    <SettingsLink href="/profile/settings/support" title="Report an issue" />
  </AccountPage>
}
