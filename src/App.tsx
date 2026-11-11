import {useCallback,useEffect,useMemo,useState, type FormEvent, type CSSProperties} from 'react';
import {ArrowRight,Bell,BellRing,CalendarDays,Check,ChevronLeft,ChevronRight,Clock,LogOut,Menu,Music2,Plus,RefreshCw,ShieldCheck,Trash2,X} from 'lucide-react';
import type {Session} from '@supabase/supabase-js';
import {db,configured,rpc,readableError} from './supabase';
import {dateKey,monthCells,describeDate,times,todayInLondon} from './domain.mjs';
import type {Profile,Band,Booking,Notice,Audit} from './types';

const SUPPORT='bunkface_booking_boutique@proton.me';
const TIME_OPTIONS=times();
const WEEKDAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const STUDIO_COLOURS=['#74B8A7','#EAA56F','#BE96C9','#85A7DF','#D67D87','#C5BE7B'];
function hexIsLight(hex:string){const nums=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);return nums.reduce((sum,c,i)=>sum+(c<=.04045?c/12.92:((c+.055)/1.055)**2.4)*[.2126,.7152,.0722][i],0)>.38;}
const getMonthTitle=(year:number,month:number)=>new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month,1)));

function Logo({small=false}:{small?:boolean}){return <div className="logo"><span className="logo-mark"><Music2 size={small?21:27} strokeWidth={2.5}/></span><span><strong>{small?'Bunkface':'The Bunkface'}</strong><span className="logo-subtitle">Booking Boutique</span></span></div>;}
function StatusMessage({error,success}:{error:string;success:string}){return <>{error&&<div role="alert" className="notice error">{error}</div>}{success&&<div role="status" className="notice success">{success}</div>}</>;}

function AuthScreen({onDone,resetMode}:{onDone:()=>void;resetMode:boolean}){
 const [mode,setMode]=useState<'login'|'register'|'recover'>(resetMode?'recover':'login');
 const [waiting,setWaiting]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [name,setName]=useState(''),[bandName,setBandName]=useState(''),[memberCount,setMemberCount]=useState(4);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 useEffect(()=>{if(resetMode)setMode('recover');},[resetMode]);
 async function submit(event:FormEvent){event.preventDefault();setWaiting(true);setError('');setSuccess('');try{
   if(mode==='register'){
     if(password!==confirm)throw new Error('Passwords do not match.');
     if(password.length<8)throw new Error('Choose a password with at least eight characters.');
     if(memberCount<1||memberCount>50)throw new Error('Enter between 1 and 50 members.');
     const result=await db.auth.signUp({email:email.trim().toLowerCase(),password,options:{data:{contact_name:name.trim(),band_name:bandName.trim(),member_count:memberCount}}});
     if(result.error)throw result.error;
     setSuccess('Account created! Your band is now waiting for administrator approval.');
     onDone();
   }else if(mode==='login'){
     const result=await db.auth.signInWithPassword({email:email.trim(),password});if(result.error)throw result.error;onDone();
   }else{
     if(!resetMode)throw new Error('Ask the administrator to send you a recovery link.');
     if(password!==confirm||password.length<8)throw new Error('Passwords must match and contain at least eight characters.');
     const result=await db.auth.updateUser({password});if(result.error)throw result.error;
     setSuccess('Password updated. You can now use the calendar.');setMode('login');onDone();
   }
 }catch(err){setError(readableError(err));}finally{setWaiting(false);}}
 return <main className="auth-shell"><section className="auth-card"><Logo/><p className="auth-lead">More playing, less group chat. Book the room and get on with the music.</p>
 <div className="auth-tabs" role="tablist" aria-label="Account options">
   <button type="button" className={mode==='login'?'selected':''} onClick={()=>{setMode('login');setError('');setSuccess('');}}>Log in</button>
   <button type="button" className={mode==='register'?'selected':''} onClick={()=>{setMode('register');setError('');setSuccess('');}}>Register a band</button>
 </div>
 <form onSubmit={submit} className="form-stack">
  {mode==='register'&&<><label>Contact name<input autoComplete="name" required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>
   <label>Band name<input required maxLength={80} value={bandName} onChange={e=>setBandName(e.target.value)} placeholder="Your band's name"/></label>
   <label>Number of members<input type="number" min="1" max="50" required value={memberCount} onChange={e=>setMemberCount(Number(e.target.value))}/></label></>}
  {mode!=='recover'&&<label>Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="band@example.com"/></label>}
  <label>{mode==='recover'?'New password':'Password'}<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='login'?1:8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label>
  {mode!=='login'&&<label>Confirm password<input type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="••••••••"/></label>}
  <StatusMessage error={error} success={success}/>
  <button className="button primary full" type="submit" disabled={waiting}>{waiting?'One moment…':mode==='register'?'Create band account':mode==='recover'?'Set new password':'Log in'} <ArrowRight size={17}/></button>
 </form>
 {mode==='login'&&<p className="fineprint">Forgotten your password? Contact <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a> for a recovery link.</p>}
 {mode==='register'&&<p className="fineprint">One account per band. Your registration needs approval before you can book.</p>}
 </section><p className="auth-footer">THE BUNKFACE BOOKING BOUTIQUE · YOUR ROOM, YOUR RULES</p></main>;
}

function BookingDialog({date,booking,band,allBands,myBandId,admin,onClose,onSaved}:{date:string;booking:Booking|null;band:Band|null;allBands:Band[];myBandId:string|null;admin:boolean;onClose:()=>void;onSaved:()=>void}){
 const [selectedDate,setSelectedDate]=useState(date),[time,setTime]=useState(booking?.start_time?.slice(0,5)||'19:00');
 const [bandId,setBandId]=useState(booking?.band_id||myBandId||allBands[0]?.id||'');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmCancel,setConfirmCancel]=useState(false);
 const owned=Boolean(booking&&(admin||booking.band_id===myBandId));
 const canCreate=!booking&&(admin||Boolean(myBandId));
 async function save(){if(!navigator.onLine){setError('You are offline. Please reconnect before booking.');return;}setBusy(true);setError('');try{
   if(booking){await rpc('update_booking',{p_id:booking.id,p_date:selectedDate,p_time:time});}
   else await rpc('create_booking',{p_date:selectedDate,p_time:time,...(admin?{p_band:bandId}:{})});
   onSaved();
 }catch(err){setError(readableError(err));}finally{setBusy(false);}}
 async function cancel(){if(!booking)return;if(!navigator.onLine){setError('You are offline. Please reconnect before cancelling.');return;}setBusy(true);setError('');try{await rpc('cancel_booking',{p_id:booking.id});onSaved();}catch(err){setError(readableError(err));}finally{setBusy(false);}}
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-label="Rehearsal booking">
  <div className="modal-header"><span className="eyebrow">REHEARSAL SPACE</span><button aria-label="Close" className="icon-button" onClick={onClose}><X/></button></div>
  <h2>{booking?(owned?'Your booking':'Room unavailable'):'Book the room'}</h2><p className="subdued">{describeDate(date)}</p>
  {booking&&!owned?<div className="occupied"><span className="band-dot" style={{background:band?.colour}}/> <div><strong>{band?.name||'Another band'} have this day booked.</strong><p>Practice starts at {booking.start_time.slice(0,5)}.</p></div></div>:
  <div className="form-stack">
    <label>Practice date<input type="date" min={todayInLondon()} value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/></label>
    {canCreate&&admin&&<label>Booking for<select value={bandId} onChange={e=>setBandId(e.target.value)}>{allBands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
    <label>Start time<div className="field-with-icon"><Clock size={18}/><select value={time} onChange={e=>setTime(e.target.value)}>{TIME_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}</select></div></label>
    <p className="helper"><CalendarDays size={16}/> This reserves the entire day, whatever time you start.</p>
    <button className="button primary full" onClick={save} disabled={busy||!bandId&&admin}>{busy?'Saving…':booking?'Save changes':'Confirm booking'}</button>
    {booking&&!confirmCancel&&<button className="button text-danger" onClick={()=>setConfirmCancel(true)}><Trash2 size={16}/> Cancel this practice</button>}
    {booking&&confirmCancel&&<div className="confirm-box"><strong>Definitely cancel this rehearsal?</strong><p>The day will immediately become available to other bands.</p><div className="button-row"><button className="button subtle" onClick={()=>setConfirmCancel(false)}>Keep booking</button><button className="button danger" disabled={busy} onClick={cancel}>Yes, cancel</button></div></div>}
   </div>}
    {error&&<div className="notice error" role="alert">{error}</div>}
 </section></div>;
}

function NotificationPanel({notices,onClose,onRefresh}:{notices:Notice[];onClose:()=>void;onRefresh:()=>void}){
 async function mark(id:string){try{await rpc('mark_notice_read',{p_id:id});onRefresh();}catch{/* Keeping the panel usable if offline */}}
 return <div className="overlay-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><aside className="side-panel" aria-label="Notifications">
  <div className="panel-heading"><h2>Notifications</h2><button aria-label="Close" className="icon-button" onClick={onClose}><X/></button></div>
  {notices.length===0?<p className="empty">Nothing new. Enjoy the peace and quiet.</p>:notices.map(n=><button key={n.id} onClick={()=>mark(n.id)} className={`notice-item ${n.read_at?'':'unread'}`}><span className="notice-dot"/><span><strong>{n.title}</strong><small>{n.body}</small><em>{new Date(n.created_at).toLocaleString('en-GB')}</em></span></button>)}
 </aside></div>;
}

async function enablePush(userId:string):Promise<string>{
 if(!('serviceWorker' in navigator)||!('PushManager' in window))return 'This browser does not support push notifications.';
 const vapid=import.meta.env.VITE_VAPID_PUBLIC_KEY as string|undefined;
 if(!vapid)return 'Push notifications are not yet configured. Booking alerts are still available in the app.';
 if(Notification.permission==='denied')return 'Notifications have been blocked. Enable them in your device or browser settings.';
 const permission=await Notification.requestPermission();if(permission!=='granted')return 'Notifications were not enabled.';
 const registration=await navigator.serviceWorker.ready;
 const bytes=Uint8Array.from(atob(vapid.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(vapid.length/4)*4,'=')),c=>c.charCodeAt(0));
 const current=await registration.pushManager.getSubscription();
 const subscription=current||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes as BufferSource});
 const {error}=await db.from('push_subscriptions').upsert({user_id:userId,endpoint:subscription.endpoint,subscription:subscription.toJSON()},{onConflict:'endpoint'});if(error)throw error;
 return 'Notifications enabled on this device.';
}

async function disablePush(userId:string):Promise<string>{
 if(!('serviceWorker' in navigator))return 'This browser does not support notifications.';
 const registration=await navigator.serviceWorker.ready;
 const existing=await registration.pushManager?.getSubscription();
 if(!existing)return 'Notifications are already disabled on this device.';
 const {error}=await db.from('push_subscriptions').delete().eq('user_id',userId).eq('endpoint',existing.endpoint);
 if(error)throw error;
 await existing.unsubscribe();
 return 'Notifications disabled on this device.';
}

function AdminPanel({profiles,bands,bookings,audits,onRefresh,onMessage}:{profiles:Profile[];bands:Band[];bookings:Booking[];audits:Audit[];onRefresh:()=>void;onMessage:(text:string)=>void}){
 const [edit,setEdit]=useState<string|null>(null),[form,setForm]=useState({name:'',member_count:4,colour:'#74B8A7',contact_name:''});
 const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[recovery,setRecovery]=useState<string|null>(null);
 const members=profiles.filter(p=>p.role==='band');
 async function changeStatus(id:string,status:'approved'|'rejected'|'deactivated'){
  setBusy(id);setError('');try{await rpc('admin_set_status',{p_user_id:id,p_status:status});onMessage(`Account ${status}.`);onRefresh();}catch(e){setError(readableError(e));}finally{setBusy(null);}}
 async function saveBand(){if(!edit)return;setBusy(edit);setError('');try{await rpc('admin_update_band',{p_band_id:edit,p_name:form.name,p_count:form.member_count,p_colour:form.colour,p_contact:form.contact_name});setEdit(null);onMessage('Band details updated.');onRefresh();}catch(e){setError(readableError(e));}finally{setBusy(null);}}
 function startEdit(p:Profile){const band=bands.find(b=>b.id===p.band_id);if(!band)return;setEdit(band.id);setForm({name:band.name,member_count:band.member_count,colour:band.colour,contact_name:p.contact_name});}
 async function resetLink(p:Profile){if(!window.confirm(`Generate a recovery link for ${p.email}? Only share it with the verified band contact.`))return;
  setBusy(p.id);setError('');try{const {data,error}=await db.functions.invoke('admin-recovery',{body:{user_id:p.id}});if(error)throw error;if(!data?.url)throw new Error(data?.error||'Could not create link.');setRecovery(data.url);}catch(e){setError(readableError(e));}finally{setBusy(null);}}
 return <section className="admin-section"><div className="section-heading"><div><span className="eyebrow">MANAGEMENT</span><h2>Band accounts</h2><p>Approve new bands, change details and manage access.</p></div></div>
    {error&&<div className="notice error" role="alert">{error}</div>}
  {recovery&&<div className="confirm-box"><strong>Recovery link generated</strong><p>Copy this once and send it to the verified band contact via Proton Mail. Treat it like a password.</p><textarea readOnly rows={3} value={recovery} onFocus={e=>e.currentTarget.select()}/><div className="button-row"><button className="button primary" onClick={()=>navigator.clipboard.writeText(recovery).then(()=>onMessage('Link copied.'))}>Copy link</button><button className="button subtle" onClick={()=>setRecovery(null)}>Close</button></div></div>}
  <div className="stat-grid"><div><b>{members.length}</b><span>Total bands</span></div><div><b>{members.filter(p=>p.status==='pending').length}</b><span>Awaiting approval</span></div><div><b>{bookings.filter(b=>b.status==='confirmed').length}</b><span>Bookings</span></div></div>
  <div className="band-list">{members.length===0?<p className="empty">No band registrations yet.</p>:members.map(p=>{const b=bands.find(b=>b.id===p.band_id);return <article className="band-admin-card" key={p.id}>
   <div className="band-admin-head"><span className="band-dot large" style={{background:b?.colour||'#888'}}/><div><strong>{b?.name||'Unknown band'}</strong><small>{p.contact_name} · {p.email}</small><small>{b?.member_count||'?'} members</small></div><span className={`status-tag ${p.status}`}>{p.status}</span></div>
   <div className="band-actions">{p.status==='pending'?<><button className="button primary small" onClick={()=>changeStatus(p.id,'approved')} disabled={busy!==null}><Check size={15}/> Approve</button><button className="button subtle small" onClick={()=>changeStatus(p.id,'rejected')} disabled={busy!==null}>Reject</button></>:<>
    {p.status==='approved'?<button className="button subtle small" onClick={()=>changeStatus(p.id,'deactivated')} disabled={busy!==null}>Deactivate</button>:<button className="button primary small" onClick={()=>changeStatus(p.id,'approved')} disabled={busy!==null}>Reactivate</button>}
   </>}
   <button className="button subtle small" onClick={()=>startEdit(p)}>Edit band</button><button className="button subtle small" onClick={()=>resetLink(p)} disabled={busy!==null}>Recovery link</button></div>
  </article>;})}</div>
  <div className="audit-section"><h3>Recent activity</h3>{audits.length===0?<p className="empty">No changes recorded yet.</p>:<div className="audit-list">{audits.slice(0,12).map(a=><div className="audit-line" key={a.id}><strong>{a.action.replaceAll('.',' · ')}</strong><span>{new Date(a.created_at).toLocaleString('en-GB')}</span></div>)}</div>}</div>
  {edit&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEdit(null);}}><div className="modal" role="dialog" aria-modal="true" aria-label="Edit band"><div className="modal-header"><span className="eyebrow">EDIT BAND</span><button className="icon-button" aria-label="Close" onClick={()=>setEdit(null)}><X/></button></div><div className="form-stack">
   <label>Band name<input value={form.name} maxLength={80} onChange={e=>setForm({...form,name:e.target.value})}/></label>
   <label>Contact name<input value={form.contact_name} maxLength={80} onChange={e=>setForm({...form,contact_name:e.target.value})}/></label>
   <label>Number of members<input type="number" min="1" max="50" value={form.member_count} onChange={e=>setForm({...form,member_count:Number(e.target.value)})}/></label>
   <label>Band colour<div className="colour-options">{STUDIO_COLOURS.map(c=><button key={c} type="button" aria-label={`Choose colour ${c}`} title={c} className={`colour-chip ${form.colour===c?'active':''}`} onClick={()=>setForm({...form,colour:c})} style={{background:c}}>{form.colour===c&&<Check size={18} color={hexIsLight(c)?'#17202B':'#FFFFFF'}/>}</button>)}</div><input aria-label="Custom hex colour" value={form.colour} onChange={e=>setForm({...form,colour:e.target.value})} maxLength={7}/></label>
   <button className="button primary full" onClick={saveBand} disabled={busy!==null}>Save band details</button></div></div></div>}
 </section>;
}

export default function App(){
 const [session,setSession]=useState<Session|null>(null),[profile,setProfile]=useState<Profile|null>(null);
 const [bands,setBands]=useState<Band[]>([]),[profiles,setProfiles]=useState<Profile[]>([]),[bookings,setBookings]=useState<Booking[]>([]),[notices,setNotices]=useState<Notice[]>([]),[audits,setAudits]=useState<Audit[]>([]);
 const [online,setOnline]=useState(navigator.onLine);
 const [loading,setLoading]=useState(true),[fetching,setFetching]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [panel,setPanel]=useState<'calendar'|'admin'>('calendar'),[showNotifications,setShowNotifications]=useState(false),[showMenu,setShowMenu]=useState(false);
 const [chosen,setChosen]=useState<string|null>(null),[resetMode,setResetMode]=useState(false);
 const [month,setMonth]=useState(()=>{const today=todayInLondon().split('-').map(Number);return {year:today[0],month:today[1]-1};});

 useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);};},[]);
 const refresh=useCallback(async()=>{const {data:{session:active}}=await db.auth.getSession();setSession(active);
   if(!active){setProfile(null);setBands([]);setBookings([]);setProfiles([]);setNotices([]);setAudits([]);setLoading(false);return;}
   setFetching(true);
   try{
    const {data:user,error:ue}=await db.from('profiles').select('*').eq('id',active.user.id).single();if(ue)throw ue;setProfile(user as Profile);
    if(user.status!=='approved'){setBands([]);setProfiles([]);setBookings([]);setNotices([]);setAudits([]);return;}
    const [br,bb,nn]=await Promise.all([db.from('bands').select('*').order('name'),db.from('bookings').select('*').order('practice_date'),db.from('notifications').select('*').order('created_at',{ascending:false}).limit(70)]);
    if(br.error||bb.error||nn.error)throw br.error||bb.error||nn.error;
    setBands((br.data||[]) as Band[]);setBookings((bb.data||[]) as Booking[]);setNotices((nn.data||[]) as Notice[]);
    if(user.role==='admin'){const [all,history]=await Promise.all([db.from('profiles').select('*').order('created_at',{ascending:false}),db.from('audit_events').select('*').order('created_at',{ascending:false}).limit(30)]);if(all.error||history.error)throw all.error||history.error;setProfiles((all.data||[]) as Profile[]);setAudits((history.data||[]) as Audit[]);}
    setError('');
   }catch(e){setError(readableError(e));}finally{setFetching(false);setLoading(false);}
 },[]);
 useEffect(()=>{
   void refresh();const {data:{subscription}}=db.auth.onAuthStateChange((event)=>{
    if(event==='PASSWORD_RECOVERY')setResetMode(true);
    if(event==='SIGNED_OUT'){setResetMode(false);setPanel('calendar');}
    // Avoid awaiting Supabase API calls inside its auth callback.
    setTimeout(()=>{void refresh();},0);
   });return()=>subscription.unsubscribe();
 },[refresh]);
 useEffect(()=>{if(!session||profile?.status!=='approved')return;
   const channel=db.channel('bunkface-live').on('postgres_changes',{event:'*',schema:'public',table:'bookings'},()=>void refresh())
     .on('postgres_changes',{event:'*',schema:'public',table:'notifications'},()=>void refresh())
     .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},()=>void refresh()).subscribe();
   const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},60000);
   const visibility=()=>{if(!document.hidden)void refresh();};document.addEventListener('visibilitychange',visibility);
   return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',visibility);void db.removeChannel(channel);};
 },[session?.user.id,profile?.status,refresh]);
 const monthDays=useMemo(()=>monthCells(month.year,month.month),[month]);
 const currentDate=todayInLondon();
 const currentMonthBookings=useMemo(()=>new Map(bookings.filter(b=>b.status==='confirmed').map(b=>[b.practice_date,b])),[bookings]);
 const selectedBooking=chosen?currentMonthBookings.get(chosen)||null:null;
 const selectedBand=selectedBooking?bands.find(b=>b.id===selectedBooking.band_id)||null:null;
 const myBand=profile?.band_id?bands.find(b=>b.id===profile.band_id):null;
 const approved=profile?.status==='approved',admin=profile?.role==='admin';
 function monthBy(delta:number){const date=new Date(Date.UTC(month.year,month.month+delta,1));setMonth({year:date.getUTCFullYear(),month:date.getUTCMonth()});}
 async function doLogout(){try{if('serviceWorker' in navigator){const registration=await navigator.serviceWorker.ready;const sub=await registration.pushManager?.getSubscription();if(sub){await db.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);await sub.unsubscribe();}}}catch{/* Still allow logout if push cleanup is unavailable */}await db.auth.signOut();setMessage('');setSession(null);setProfile(null);}
 function saved(){setChosen(null);setMessage('Calendar updated. Sorted!');void refresh();}
 if(!configured)return <div className="config-screen"><Logo/><h2>Almost ready to rock.</h2><p>The app needs its Supabase project configured before it can accept logins and bookings.</p><p>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> as described in <code>DEPLOYMENT.md</code>.</p></div>;
 if(loading)return <div className="config-screen"><Logo/><p>Loading your rehearsal space…</p></div>;
 if(!session||!profile||resetMode)return <AuthScreen onDone={()=>{setResetMode(false);void refresh();}} resetMode={resetMode}/>;
 if(!approved)return <main className="auth-shell"><section className="auth-card"><Logo/><div className="pending-icon"><Clock size={32}/></div><h1>{profile.status==='pending'?'Waiting for approval':profile.status==='rejected'?'Registration declined':'Account deactivated'}</h1><p className="auth-lead">{profile.status==='pending'?'Your band has registered. The administrator needs to approve it before you can book the room.':`Contact ${SUPPORT} if you think this is a mistake.`}</p><div className="button-row"><button className="button subtle" onClick={()=>void refresh()}><RefreshCw size={16}/> Check again</button><button className="button subtle" onClick={doLogout}><LogOut size={16}/> Log out</button></div></section></main>;
 return <div className="app-layout">
   <header className="site-header"><div className="header-inner"><Logo small/>
    <nav className="desktop-nav"><button className={panel==='calendar'?'active':''} onClick={()=>setPanel('calendar')}><CalendarDays size={17}/> Calendar</button>{admin&&<button className={panel==='admin'?'active':''} onClick={()=>setPanel('admin')}><ShieldCheck size={17}/> Admin</button>}</nav>
    <div className="header-actions"><button className="icon-button" aria-label="Refresh calendar" title="Refresh" onClick={()=>void refresh()}><RefreshCw size={19} className={fetching?'spin':''}/></button>
     <button className="icon-button notify-button" aria-label="Notifications" onClick={()=>setShowNotifications(true)}><Bell size={21}/>{notices.some(n=>!n.read_at)&&<span className="notification-count"/>}</button>
     <button className="icon-button menu-button" aria-label="Menu" onClick={()=>setShowMenu(!showMenu)}><Menu size={21}/></button>
     <button className="button logout desktop-logout" onClick={doLogout}><LogOut size={16}/> Log out</button>
    </div></div></header>
   {showMenu&&<div className="mobile-menu"><button onClick={()=>{setPanel('calendar');setShowMenu(false);}}>Calendar</button>{admin&&<button onClick={()=>{setPanel('admin');setShowMenu(false);}}>Admin</button>}<button onClick={doLogout}>Log out</button></div>}
   <main className="main-container">
    <div className="top-intro"><div><span className="eyebrow">YOUR REHEARSAL SPACE</span><h1>{admin?'Welcome, boss.':`Alright, ${myBand?.name||profile.contact_name}.`}</h1><p>{admin?'Keep the room running smoothly, without the drama.':'Find a free day, pick your time and get practising.'}</p></div><div className="identity-chip"><span className="identity-dot" style={{background:myBand?.colour||'#EAA56F'}}/>{admin?'Administrator':myBand?.name}</div></div>
    {!online&&<div className="notice error" role="status">You are offline. Bookings are disabled until you reconnect.</div>}
    {error&&<div className="notice error" role="alert">{error}<button className="mini-close" onClick={()=>setError('')} aria-label="Dismiss"><X size={16}/></button></div>}
    {message&&<div className="notice success" role="status">{message}<button className="mini-close" onClick={()=>setMessage('')} aria-label="Dismiss"><X size={16}/></button></div>}
    {panel==='admin'&&admin?<AdminPanel profiles={profiles} bands={bands} bookings={bookings} audits={audits} onRefresh={()=>void refresh()} onMessage={setMessage}/>:<>
     <section className="calendar-card"><div className="calendar-header"><div><span className="eyebrow">THE ROOM AT A GLANCE</span><h2>{getMonthTitle(month.year,month.month)}</h2></div><div className="calendar-nav"><button aria-label="Previous month" onClick={()=>monthBy(-1)}><ChevronLeft size={21}/></button><button className="today-button" onClick={()=>{const d=currentDate.split('-').map(Number);setMonth({year:d[0],month:d[1]-1});}}>Today</button><button aria-label="Next month" onClick={()=>monthBy(1)}><ChevronRight size={21}/></button></div></div>
     <div className="calendar-grid">{WEEKDAYS.map((w,i)=><div className="weekday" key={`${w}${i}`}>{w}</div>)}
       {monthDays.map((d,i)=>{if(d===null)return <div className="blank-day" key={`blank${i}`}/>;const key=dateKey(month.year,month.month,d);const b=currentMonthBookings.get(key);const band=b?bands.find(x=>x.id===b.band_id):undefined;const past=key<currentDate;const isToday=key===currentDate;
         return <button type="button" key={key} className={`calendar-day ${b?'booked':''} ${past&&!b?'past':''} ${isToday?'today':''}`} style={b?{'--band-colour':band?.colour||'#74B8A7',color:hexIsLight(band?.colour||'#74B8A7')?'#17202B':'#FFFFFF'} as CSSProperties:undefined} onClick={()=>setChosen(key)} disabled={past&&!b} aria-label={`${describeDate(key)}: ${b?`${band?.name||'Booked'} at ${b.start_time.slice(0,5)}`:past?'Past date':'Available'}`}>
         <span className="day-number">{d}</span>{b?<span className="day-booked"><span className="day-band">{band?.name||'Booked'}</span><span className="day-time">{b.start_time.slice(0,5)}</span></span>:!past&&<span className="day-add"><Plus size={15}/></span>}{isToday&&<span className="today-underline"/>}</button>;
       })}</div>
     <div className="calendar-foot"><div className="legend">{bands.map(b=><span className="legend-item" key={b.id}><span className="band-dot" style={{background:b.colour}}/>{b.name}</span>)}</div><small>Tap a day to see details or book.</small></div>
     </section>
     <section className="bottom-cards"><div className="info-card"><div className="card-icon amber"><CalendarDays size={23}/></div><h3>Keep it simple</h3><p>Pick a free day, choose your start time and confirm. The room is yours for the whole day.</p></div>
      <div className="info-card"><div className="card-icon mint"><BellRing size={23}/></div><h3>Stay in the loop</h3><p>Get alerts whenever another band books, moves or cancels a practice.</p><button className="subtle-link" onClick={()=>enablePush(profile.id).then(setMessage).catch(e=>setError(readableError(e)))}>Enable notifications <ArrowRight size={15}/></button><button className="subtle-link" style={{marginLeft:18}} onClick={()=>disablePush(profile.id).then(setMessage).catch(e=>setError(readableError(e)))}>Disable on this device</button></div></section>
    </>}
    <footer className="site-footer"><span>© The Bunkface Booking Boutique</span><a href={`mailto:${SUPPORT}`}>Need a hand?</a></footer>
   </main>
   {chosen&&<BookingDialog key={chosen+String(selectedBooking?.id)} date={chosen} booking={selectedBooking} band={selectedBand} allBands={bands.filter(b=>profiles.some(p=>p.band_id===b.id&&p.status==='approved')||!admin)} myBandId={profile.band_id} admin={admin} onClose={()=>setChosen(null)} onSaved={saved}/>}
   {showNotifications&&<NotificationPanel notices={notices} onClose={()=>setShowNotifications(false)} onRefresh={()=>void refresh()}/>}
 </div>;
}
