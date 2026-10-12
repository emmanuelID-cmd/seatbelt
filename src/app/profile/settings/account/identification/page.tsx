'use client'

import AccountPage, { SettingsLink } from '@/components/AccountPage'
import { DocumentNotices, ResourceState, useAccount } from '../../_components'

export default function IdentificationPage() {
  const account = useAccount()
  const data = account.data
  return <AccountPage title="Identity verification" back="/profile/settings/account">
    <ResourceState loading={account.loading} error={account.error} retry={account.refresh}>
      {data && <>
        <DocumentNotices account={data} />
        <section className="panel"><h2>Identity verification</h2><p>Status: {(data.identity?.status || 'not_started').replaceAll('_', ' ')}</p>
          {data.identity?.verified_at && <p>Verified {new Date(data.identity.verified_at).toLocaleDateString()}.</p>}
          <p>Riders and Drivers use Stripe-hosted verification. Available government ID documents can include a Driver License, state ID card, or passport. Seatbelt stores the verification status, not the document image or ID number.</p>
          <SettingsLink href="/verify-identity" title="Verify or review identity" />
        </section>
        {data.profile.is_driver && <section className="panel"><h2>Driver License and eligibility</h2><p>Driver License check: {(data.driverLicense?.status || 'not_started').replaceAll('_', ' ')}</p>
          <p>License expiration: {data.driverLicense?.license_expires_on || 'Unavailable until Stripe result access is configured.'}</p>
          <SettingsLink href="/verify-identity?purpose=driver_license" title="Verify Driver License" />
          <p>Additional U.S. ID-number check: {(data.driverIdentityCheck?.status || 'not_started').replaceAll('_', ' ')}</p>
          <SettingsLink href="/verify-identity?context=driver-eligibility" title="Start or review Driver Eligibility identity check" />
          <p>Overall eligibility: {(data.eligibility?.overall_status || 'not_started').replaceAll('_', ' ')}</p>
          <dl className="data-list"><dt>Registration review</dt><dd>{data.eligibility?.registration_status?.replaceAll('_', ' ') || 'Not submitted'}</dd><dt>Registration expiration</dt><dd>{data.eligibility?.registration_expires_on || 'Not recorded'}</dd><dt>Insurance review</dt><dd>{data.eligibility?.insurance_status?.replaceAll('_', ' ') || 'Not submitted'}</dd><dt>Insurance expiration</dt><dd>{data.eligibility?.insurance_expires_on || 'Not recorded'}</dd></dl>
          <p>Manage vehicle documents in Driver Eligibility. This page reuses that record and does not collect duplicate documents. Any SSN is entered only in Stripe&apos;s secure flow.</p><SettingsLink href="/driver-eligibility" title="Manage Driver Eligibility" />
          <p><a href="https://www.usa.gov/state-motor-vehicle-services" target="_blank" rel="noopener noreferrer">Official state motor vehicle services (opens a new tab)</a></p>
        </section>}
        <section className="panel"><h2>Additional checks</h2><p>Camera registration: not configured. An authenticated camera integration is planned; no camera has been verified by this page.</p><p>Background checks: not configured. A provider integration is required before background-check status can be displayed.</p></section>
        <SettingsLink href="/profile/settings/support" title="Get help with verification" />
      </>}
    </ResourceState>
  </AccountPage>
}
