'use client'
import {useEffect,useState} from 'react'
import AccountPage,{Feedback,SettingsLink} from '@/components/AccountPage'
import {apiRequest} from '@/lib/apiClient'
type Notice={id:string;title:string;body:string;category:string;created_at:string;read_at:string|null}
export default function NotificationsPage(){const [items,setItems]=useState<Notice[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState('')
  useEffect(()=>{let live=true;void apiRequest<{items:Notice[]}>('/api/notifications').then(data=>{if(live)setItems(data.items)}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Notifications unavailable.')}).finally(()=>{if(live)setBusy(false)});return()=>{live=false}},[])
  async function mark(id:string){setError('');try{await apiRequest('/api/notifications',{method:'PATCH',body:JSON.stringify({id})});setItems(current=>current.map(item=>item.id===id?{...item,read_at:new Date().toISOString()}:item))}catch(e){setError(e instanceof Error?e.message:'Notification unavailable.')}}
  return <AccountPage title="Notifications" back="/profile"><Feedback error={error}/><SettingsLink href="/profile/settings/notifications" title="Notification preferences"/>{busy?<p role="status"><span className="loading-indicator"/>Loading…</p>:!error&&items.length===0?<p>No notifications yet.</p>:<ul className="data-list">{items.map(item=><li key={item.id}><h2>{item.title}</h2><p>{item.body}</p><p className="muted">{new Date(item.created_at).toLocaleString()} · {item.read_at?'Read':'Unread'}</p>{!item.read_at&&<button className="secondary-button" onClick={()=>void mark(item.id)}>Mark as read</button>}</li>)}</ul>}</AccountPage>
}
