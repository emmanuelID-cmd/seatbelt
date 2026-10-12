import AccountPage, { SettingsLink } from '@/components/AccountPage'

export default function FaqPage() {
  return <AccountPage title="FAQs" back="/profile/settings/guidance"><section className="panel">
    <details><summary>How do I switch between Rider and Driver?</summary><p>Open Settings and choose your session mode. Driver mode requires a Driver-enabled account and approved identity and vehicle eligibility. Required setup remains available while approval is pending.</p></details>
    <details><summary>When is a ride confirmed?</summary><p>A Driver submits an offer and the Rider accepts it. Check your Ride History for the recorded agreement and status. Accepted trip details cannot be edited as an ordinary post.</p></details>
    <details><summary>Does an accepted ride mean payment succeeded?</summary><p>No. Check the payment status separately. Only payment-provider confirmation establishes a recorded successful payment.</p></details>
    <details><summary>Who can read my reviews and travel history?</summary><p>Your received reviews and ride history are available in your own signed-in account. A review submitted anonymously does not show the reviewer name in the received-review screen.</p></details>
    <details><summary>How do I dispute a payment or appeal a decision?</summary><p>Open Support and select the payment or appeal category. Include the reference, dates and relevant facts. Submission saves a request; it does not automatically approve a refund or overturn a decision.</p></details>
    <details><summary>What happens when I freeze or delete my account?</summary><p>Review the account controls for the current freeze and billing outcome. Deletion begins a review request and retention checks, and billing cancellation is managed separately under Subscription.</p></details>
    <details><summary>Why are some features unavailable?</summary><p>Some services require provider setup before activation. Seatbelt shows unavailable states for features such as SMS, browser push alerts, authenticated cameras and background checks when those integrations are not configured.</p></details>
  </section><SettingsLink href="/profile/settings/support" title="Ask another question" /></AccountPage>
}
