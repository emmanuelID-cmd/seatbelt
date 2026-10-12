'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import AccountPage,{Feedback} from '@/components/AccountPage'
import {apiRequest} from '@/lib/apiClient'

type FinanceCurrency={currency:string;grossRidePaymentsCents:number;rideRefundsCents:number;recordedUserExpensesCents:number;recordedFeesCents:number;platformRevenueCents:number|null;subscriptionRevenueCents:number|null}
type Analytics={since:string;until:string;operations:Record<string,number|string|null>;trust:Record<string,number|string|null>;finance:{coverageSince:string|null;currencies:FinanceCurrency[];coverageNote:string}|null;financeUnavailable:boolean;providers:Record<string,boolean>}
const operationsLabels:Record<string,string>={totalAccounts:'Registered accounts (current)',totalDrivers:'Driver-capable accounts (current)',totalRiders:'Rider accounts (current)',accountsCreated:'Accounts created in range',onlineDrivers:'Online Drivers (last 5 minutes)',onlineRiders:'Online Riders (last 5 minutes)',activeDrivers:'Active Drivers in range',activeRiders:'Active Riders in range',frozenAccounts:'Frozen accounts (current)',deletionRequests:'Deletion requests (current)',tickets:'Support requests in range',openTickets:'Open support requests (current)'}
const trustLabels:Record<string,string>={pendingEligibility:'Pending eligibility (current)',approvedEligibility:'Approved eligibility (current)',expiredDocuments:'Accounts with expired vehicle documents (current)',incidents:'Recorded incidents in range',openIncidents:'Open recorded incidents (current)',appeals:'Appeals submitted in range',privacyRequests:'Privacy requests submitted in range'}
function coverage(value:unknown){return typeof value==='string'?new Date(value).toLocaleString():'No instrumented records yet'}
export default function AnalyticsPage(){
  const [tab,setTab]=useState<'operations'|'finance'|'trust'>('operations'),[data,setData]=useState<Analytics|null>(null)
  const [since,setSince]=useState(''),[until,setUntil]=useState(''),[busy,setBusy]=useState(true),[error,setError]=useState('')
  const [errors,setErrors]=useState<Record<string,string>>({})
  useEffect(()=>{let live=true;void apiRequest<Analytics>('/api/admin/analytics').then(result=>{if(live)setData(result)}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Analytics temporarily unavailable.')}).finally(()=>{if(live)setBusy(false)});return()=>{live=false}},[])
  async function load(){
    const next:Record<string,string>={},now=Date.now(),start=Date.parse(since),end=Date.parse(until)
    if(!since||!Number.isFinite(start)||start>now)next.since='Choose a valid past start date and time.'
    if(!until||!Number.isFinite(end)||end>now)next.until='Choose a valid past end date and time.'
    if(Number.isFinite(start)&&Number.isFinite(end)&&(start>end||end-start>366*86400000))next.until='End must follow start within a range of up to 366 days.'
    setErrors(next);if(Object.keys(next).length)return
    setBusy(true);setError('');setData(null)
    try{setData(await apiRequest<Analytics>(`/api/admin/analytics?since=${encodeURIComponent(new Date(start).toISOString())}&until=${encodeURIComponent(new Date(end).toISOString())}`))}catch(e){setError(e instanceof Error?e.message:'Analytics temporarily unavailable.')}finally{setBusy(false)}
  }
  function change(field:string,value:string){if(field==='since')setSince(value);else setUntil(value);if(value&&Number.isFinite(Date.parse(value)))setErrors(current=>{const next={...current};delete next[field];return next})}
  return <AccountPage title="Administrator analytics" back="/admin"><Feedback error={error}/><Link href="/admin/security" className="secondary-button">Verify administrator MFA</Link>
    <form className="panel" noValidate onSubmit={e=>{e.preventDefault();void load()}}><h2>Date range</h2><p className="muted">Default: the last 30 days. Current totals and presence are labelled separately from range metrics. Dates use your browser’s local time.</p>
      {Object.keys(errors).length>0&&<div className="form-error-summary" role="alert"><ul>{Object.entries(errors).map(([key,value])=><li key={key}><a href={`#${key}`}>{value}</a></li>)}</ul></div>}
      <div className="two-column">{(['since','until'] as const).map(field=><label key={field} className="form-field" htmlFor={field}>{field==='since'?'From':'Through'}<input id={field} type="datetime-local" value={field==='since'?since:until} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field]?`${field}-error`:undefined} onChange={e=>change(field,e.target.value)}/>{errors[field]&&<span id={`${field}-error`} className="field-error">{errors[field]}</span>}</label>)}</div><button className="primary-button" disabled={busy}>Apply range</button>
    </form>
    <nav className="tabs" aria-label="Analytics sections">{(['operations','finance','trust'] as const).map(value=><button key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{value==='trust'?'Trust & Safety':value==='finance'?'Finance':'Operations'}</button>)}</nav>
    {busy&&<p role="status"><span className="loading-indicator"/>Loading protected aggregates…</p>}
    {data&&<><p className="muted">Reporting range: {new Date(data.since).toLocaleString()} – {new Date(data.until).toLocaleString()}</p>
      {tab==='operations'&&<section className="panel"><h2>Operations</h2><p className="status-note">Activity instrumentation begins: {coverage(data.operations.activityCoverageSince)}. Presence reflects signed-in heartbeats and the user’s selected presence; it does not establish physical location. Driver-capable totals include accounts still awaiting eligibility.</p><div className="metric-grid">{Object.entries(operationsLabels).map(([key,label])=><div className="metric" key={key}><strong>{typeof data.operations[key]==='number'?data.operations[key]:'Unavailable'}</strong>{label}</div>)}</div></section>}
      {tab==='trust'&&<section className="panel"><h2>Trust & Safety</h2><p className="status-note">Incident coverage begins: {coverage(data.trust.coverageSince)}. Counts include recorded incidents only; no automated fraud, background-check or camera monitoring provider is connected. Document dates come from reviewed eligibility records.</p><div className="metric-grid">{Object.entries(trustLabels).map(([key,label])=><div className="metric" key={key}><strong>{typeof data.trust[key]==='number'?data.trust[key]:'Unavailable'}</strong>{label}</div>)}</div><Link href="/admin/support" className="secondary-button">Review support and appeals</Link></section>}
      {tab==='finance'&&<section className="panel"><h2>Finance</h2>{data.financeUnavailable||!data.finance?<p className="status-note">Financial reporting is unavailable until its database setup is complete.</p>:<><p className="status-note">Provider-recorded coverage begins: {coverage(data.finance.coverageSince)}. {data.finance.coverageNote}</p>{data.finance.currencies.length===0?<p>No provider-confirmed ledger records in this range.</p>:data.finance.currencies.map(row=><section key={row.currency}><h3>{row.currency}</h3><dl className="metric-grid">{([['grossRidePaymentsCents','Gross settled ride volume'],['rideRefundsCents','Ride refunds'],['recordedUserExpensesCents','Recorded account spending'],['recordedFeesCents','Recorded fees'],['platformRevenueCents','Platform revenue'],['subscriptionRevenueCents','Subscription revenue']] as const).map(([key,label])=><div className="metric" key={key}><dt>{label}</dt><dd><strong>{row[key]===null?'Unavailable':new Intl.NumberFormat(undefined,{style:'currency',currency:row.currency}).format(row[key]/100)}</strong></dd></div>)}</dl></section>)}</> }<p className="muted">Payment provider configuration: {data.providers.payments?'Present; delivery/reconciliation still requires acceptance testing':'Unavailable'}. All amounts retain their currency. Gross ride volume is not Seatbelt revenue.</p></section>}
    </>}
  </AccountPage>
}
