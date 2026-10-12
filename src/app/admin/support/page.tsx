'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import AccountPage,{Feedback} from '@/components/AccountPage'
import {apiRequest} from '@/lib/apiClient'
type Ticket={id:string;category:string;status:string;created_at:string;updated_at:string;subject?:string;message?:string;response?:string|null}
const statuses=['open','in_review','resolved','closed']
export default function AdminSupportPage(){
  const [status,setStatus]=useState('open'),[items,setItems]=useState<Ticket[]>([]),[ticket,setTicket]=useState<Ticket|null>(null)
  const [response,setResponse]=useState(''),[nextStatus,setNextStatus]=useState('in_review'),[busy,setBusy]=useState(true),[error,setError]=useState(''),[success,setSuccess]=useState(''),[responseError,setResponseError]=useState('')
  useEffect(()=>{let live=true;void apiRequest<{tickets:Ticket[]}>(`/api/admin/support?status=${status}`).then(data=>{if(live)setItems(data.tickets)}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Support temporarily unavailable.')}).finally(()=>{if(live)setBusy(false)});return()=>{live=false}},[status])
  async function open(id:string){setBusy(true);setError('');setSuccess('');setTicket(null);setResponseError('');try{const data=await apiRequest<{ticket:Ticket}>(`/api/admin/support?id=${id}`);setTicket(data.ticket);setResponse(data.ticket.response||'');setNextStatus(data.ticket.status==='open'?'in_review':data.ticket.status)}catch(e){setError(e instanceof Error?e.message:'Request unavailable.')}finally{setBusy(false)}}
  async function save(){if(!ticket)return;if(!response.trim()||response.trim().length>2000){setResponseError('Enter a response of 1–2,000 characters.');return}setBusy(true);setError('');setSuccess('');try{const data=await apiRequest<{message:string}>('/api/admin/support',{method:'PATCH',body:JSON.stringify({id:ticket.id,status:nextStatus,response,updatedAt:ticket.updated_at})});setSuccess(data.message);setItems(current=>current.filter(item=>item.id!==ticket.id));setTicket(null)}catch(e){setError(e instanceof Error?e.message:'Response unavailable.')}finally{setBusy(false)}}
  return <AccountPage title="Support review" back="/admin"><Feedback error={error} success={success}/><Link href="/admin/security" className="secondary-button">Verify administrator MFA</Link><p className="status-note">Private founding-administrator queue. Open one request to read its content. Keep replies free of document details and secrets. Resolving a deletion request does not delete data or release legal holds.</p>
    <label className="form-field">Queue<select value={status} onChange={e=>{setBusy(true);setError('');setTicket(null);setItems([]);setStatus(e.target.value)}}>{statuses.map(value=><option key={value} value={value}>{value.replace('_',' ')}</option>)}</select></label>
    {busy&&<p role="status"><span className="loading-indicator"/>Loading…</p>}
    {!busy&&!error&&items.length===0&&<p>No requests in this queue.</p>}
    <ul className="data-list">{items.map(item=><li key={item.id}><strong>{item.category}</strong> · {new Date(item.created_at).toLocaleString()}<br/><button className="secondary-button" disabled={busy} onClick={()=>void open(item.id)}>Open request {item.id.slice(0,8)}</button></li>)}</ul>
    {ticket&&<form className="panel" noValidate onSubmit={e=>{e.preventDefault();void save()}}>{responseError&&<div className="form-error-summary" role="alert"><a href="#support-response">{responseError}</a></div>}<h2>{ticket.subject}</h2><p style={{whiteSpace:'pre-wrap'}}>{ticket.message}</p><p className="muted">Category: {ticket.category}; current status: {ticket.status.replace('_',' ')}.</p>
      <label className="form-field">New status<select value={nextStatus} onChange={e=>setNextStatus(e.target.value)}>{statuses.map(value=><option key={value} value={value}>{value.replace('_',' ')}</option>)}</select></label>
      <label className="form-field" htmlFor="support-response">Signed-in response<textarea id="support-response" rows={6} maxLength={2000} value={response} aria-invalid={Boolean(responseError)} aria-describedby={responseError?'support-response-error':undefined} onChange={e=>{setResponse(e.target.value);if(e.target.value.trim()&&e.target.value.trim().length<=2000)setResponseError('')}}/>{responseError&&<span id="support-response-error" className="field-error">{responseError}</span>}</label><button className="primary-button" disabled={busy}>Save response</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>void open(ticket.id)}>Reload request</button>
    </form>}
  </AccountPage>
}
