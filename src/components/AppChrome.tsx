'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { apiRequest } from '@/lib/apiClient'

const links = [
  {href:'/feed',label:'Feed',icon:'⌂'}, {href:'/nearby',label:'Nearby',icon:'◎'},
  {href:'/post',label:'Post',icon:'+'}, {href:'/dms',label:'Messages',icon:'▤'},
  {href:'/profile',label:'Profile',icon:'○'},
]
const BackNavigation=createContext<(()=>void)|null>(null)
export function useBackNavigation(fallback='/'){
  const back=useContext(BackNavigation),router=useRouter()
  return back||(()=>router.push(fallback))
}

export default function AppChrome({children,footer}:{children:ReactNode;footer:ReactNode}) {
  const pathname=usePathname(),router=useRouter()
  const [signedIn,setSignedIn]=useState(false)
  const [authResolved,setAuthResolved]=useState(false)
  const [userId,setUserId]=useState<string|null>(null)
  const [unread,setUnread]=useState(0)
  const previous=useRef<string|null>(null)
  const current=useRef(pathname)
  const standard=['/feed','/nearby','/post','/dms','/profile','/driver-eligibility','/verify-identity'].includes(pathname)||pathname.startsWith('/messages/')
  const ownBack=standard||['/about','/notifications'].includes(pathname)||['/profile','/admin','/guidance','/data-usage'].some(prefix=>pathname.startsWith(prefix))
  const protectedPage=standard||pathname==='/notifications'||pathname.startsWith('/profile/')||pathname==='/admin'||pathname.startsWith('/admin/')

  useEffect(()=>{
    let mounted=true
    void supabase.auth.getSession().then(({data})=>{if(mounted){setSignedIn(Boolean(data.session));setUserId(data.session?.user.id||null);setAuthResolved(true)}})
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>{setSignedIn(Boolean(session));setUserId(session?.user.id||null);setAuthResolved(true);if(!session)setUnread(0)})
    return ()=>{mounted=false;data.subscription.unsubscribe()}
  },[])
  useEffect(()=>{
    if(current.current!==pathname){previous.current=current.current;current.current=pathname}
  },[pathname])
  useEffect(()=>{
    if(!signedIn)return
    let stopped=false
    async function update(){
      if(document.visibilityState!=='visible')return
      try{
        await apiRequest('/api/account',{method:'POST',body:JSON.stringify({action:'heartbeat'})})
        const data=await apiRequest<{unreadCount:number}>('/api/notifications')
        if(!stopped)setUnread(data.unreadCount)
      }catch{/* Screen-specific API calls present actionable errors. */}
    }
    void update()
    const timer=setInterval(()=>void update(),60000)
    return ()=>{stopped=true;clearInterval(timer)}
  },[signedIn,userId])

  function goBack(){
    const previousPath=previous.current?.split('?')[0]
    if(signedIn&&(!previousPath||previousPath==='/login')){router.replace('/feed');return}
    if(previous.current)router.back();else router.push(signedIn?'/feed':'/')
  }
  return <BackNavigation.Provider value={goBack}><div className={`app-frame${signedIn&&standard?' with-bottom-nav':''}`}>
    {!ownBack&&<div className="global-back"><button className="back-button" aria-label="Go back" onClick={goBack}>←</button>{signedIn&&<Link href="/notifications" aria-label={`Notifications, ${unread} unread`}>Notifications{unread>0?` (${unread})`:''}</Link>}</div>}
    <div className="app-content" key={userId||'signed-out'}>{protectedPage&&!authResolved?<p className="status-note" role="status"><span className="loading-indicator"/>Checking your session…</p>:protectedPage&&!signedIn?<main className="account-page"><h1>Sign in to continue</h1><Link className="primary-button" href="/login">Sign in</Link></main>:children}</div>
    {footer}
    {signedIn&&standard&&<nav className="bottom-navigation" aria-label="Main navigation">{links.map(link=><Link key={link.href} href={link.href} aria-current={pathname===link.href?'page':undefined}><span aria-hidden="true">{link.icon}</span>{link.label}</Link>)}</nav>}
  </div></BackNavigation.Provider>
}
