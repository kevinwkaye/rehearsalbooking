import {useCallback,useEffect,useId,useMemo,useRef,useState, type FormEvent, type CSSProperties} from 'react';
import {ArrowRight,Bell,CalendarDays,Check,ChevronLeft,ChevronRight,Clock,LogOut,Menu,Plus,RefreshCw,ShieldCheck,Trash2,X} from 'lucide-react';
import type {Session} from '@supabase/supabase-js';
import {db,configured,rpc,readableError} from './supabase';
import {dateKey,monthCells,describeDate,times,todayInLondon} from './domain.mjs';
import type {Profile,Band,BandMembership,Booking,Notice,Audit,PracticeRequest,PracticeConfirmation} from './types';
import {VAPID_PUBLIC_KEY} from './pushPublicKey';

const SUPPORT=(import.meta.env.VITE_SUPPORT_EMAIL as string|undefined)?.trim()||'';
const TIME_OPTIONS=times();
const WEEKDAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const STUDIO_COLOURS=['#A30000','#D84797','#FF7700','#00AFB5','#7DDF64'];
function hexIsLight(hex:string){return hex.toUpperCase()!=='#A30000';}
const getMonthTitle=(year:number,month:number)=>new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month,1)));

function Logo({small=false}:{small?:boolean}){return <div className={'logo logo-art'+(small?' logo-art-small':'')}><img src="/88-bunkspace-logo.webp" alt="88 Bunkspace" width={624} height={310} decoding="async"/></div>;}
function StatusMessage({error,success}:{error:string;success:string}){return <>{error&&<div role="alert" className="notice error">{error}</div>}{success&&<div role="status" className="notice success">{success}</div>}</>;}

type PasswordFieldProps={
 label:string;
 value:string;
 onChange:(value:string)=>void;
 autoComplete:'current-password'|'new-password';
 minLength?:number;
 placeholder?:string;
 required?:boolean;
 disabled?:boolean;
};
function PasswordField({label,value,onChange,autoComplete,minLength,placeholder,required=true,disabled=false}:PasswordFieldProps){
 const [visible,setVisible]=useState(false);
 const fieldId=useId();
 return <div className="password-field">
  <label htmlFor={fieldId}>{label}</label>
  <div className="password-input-row">
   <input id={fieldId} type={visible?'text':'password'} autoComplete={autoComplete}
    minLength={minLength} placeholder={placeholder} value={value}
    required={required} disabled={disabled} onChange={e=>onChange(e.target.value)}/>
   <button className="password-visibility-toggle" type="button" aria-controls={fieldId}
    aria-pressed={visible} aria-label={`${visible?'Hide':'Show'} ${label.toLowerCase()}`}
    onClick={()=>setVisible(previous=>!previous)}>
    {visible?'Hide':'Show'}
   </button>
  </div>
 </div>;
}

type SignupBand={id:string;name:string;colour:string};

function AuthScreen({onDone}:{onDone:()=>void}){
 const [mode,setMode]=useState<'login'|'signup'|'forgot'>('login');
 const [availableBands,setAvailableBands]=useState<SignupBand[]>([]),[selectedBands,setSelectedBands]=useState<string[]>([]);
 useEffect(()=>{void rpc<SignupBand[]>('list_signup_bands').then(setAvailableBands).catch(()=>setAvailableBands([]));},[]);
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');setSuccess('');
  try{
   if(mode==='signup'){
    if(name.trim().length<2||name.trim().length>80)throw new Error('Enter your name (2–80 characters).');
    if(password.length<10)throw new Error('Choose a password of at least 10 characters.');
    if(password!==confirm)throw new Error('The passwords do not match.');
    if(selectedBands.length===0)throw new Error('Choose at least one band.');
    const {data,error:signUpError}=await db.auth.signUp({email:email.trim().toLowerCase(),password,options:{data:{contact_name:name.trim(),band_ids:selectedBands}}});
    if(signUpError)throw signUpError;
    if(data.session){onDone();return;}
    setSuccess('Account created. If email confirmation is enabled, please contact the administrator to activate your account.');
   }else if(mode==='forgot'){
    const redirectTo=new URL('/?reset=1',window.location.origin).toString();
    const {error:recoveryError}=await db.auth.resetPasswordForEmail(email.trim().toLowerCase(),{redirectTo});
    if(recoveryError)throw recoveryError;
    setSuccess('If this email address is registered, you will receive a password reset link.');
   }else{
    const {error:signInError}=await db.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
    if(signInError)throw signInError;
    onDone();
   }
  }catch(err){setError(readableError(err));}finally{setBusy(false);}
 }
 return <main className="auth-shell"><section className="auth-card"><Logo/>
  <p className="auth-lead">Book the room. Get the band together.</p>
  <h1 className="login-heading">{mode==='signup'?'Create your account':mode==='forgot'?'Reset your password':'Sign in to your bookings'}</h1>
  <form onSubmit={submit} className="form-stack">
   {mode==='signup'&&<><label>Your name<input value={name} required minLength={2} maxLength={80} autoComplete="name" placeholder="e.g. James" onChange={e=>setName(e.target.value)}/></label><fieldset className="signup-band-picker"><legend>Select your bands</legend><p>Tick every band you play in. Adam approves your account once.</p>{availableBands.map(b=><label key={b.id} className="band-checkbox"><input type="checkbox" checked={selectedBands.includes(b.id)} onChange={e=>setSelectedBands(prev=>e.target.checked?[...prev,b.id]:prev.filter(id=>id!==b.id))}/><span className="band-dot" style={{background:b.colour}}/>{b.name}</label>)}{availableBands.length===0&&<p className="helper">No bands available. Ask the administrator to add one.</p>}</fieldset></>}
   <label>Email address<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
   {mode!=='forgot'&&<PasswordField key={mode} label="Password" required minLength={mode==='signup'?10:undefined} autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={setPassword} placeholder={mode==='signup'?'At least 10 characters':'Your password'}/>} 
   {mode==='signup'&&<PasswordField label="Confirm password" autoComplete="new-password" required value={confirm} onChange={setConfirm} placeholder="Enter it again"/>}
   <StatusMessage error={error} success={success}/>
   <button className="button primary full" type="submit" disabled={busy}>{busy?'One moment…':mode==='signup'?'Create account':mode==='forgot'?'Send reset link':'Open calendar'} <ArrowRight size={17}/></button>
  </form>
  <button className="admin-login-link" type="button" onClick={()=>{setMode(mode==='login'?'signup':'login');setPassword('');setConfirm('');setError('');setSuccess('');}}>{mode==='login'?'New here? Create an account':'Back to sign in'}</button>
  {mode==='login'&&<button className="admin-login-link" type="button" onClick={()=>{setMode('forgot');setError('');setSuccess('');}}>Forgot password?</button>}
  <a className="auth-help-link" href="/help.html" aria-label="How to use 88 Bunkspace">? &nbsp;How it works</a>
  <p className="fineprint">{mode==='signup'?'Your selected bands will be reviewed by the administrator.':'88 Bunkspace'}</p>
 </section><p className="auth-footer">88 BUNKSPACE</p></main>;
}

function ChooseBandScreen({onDone,onLogout}:{onDone:()=>void;onLogout:()=>void}){
 const [bands,setBands]=useState<SignupBand[]>([]),[selected,setSelected]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{setLoading(true);try{setBands(await rpc<SignupBand[]>('list_available_bands')||[]);setError('');}catch(e){setError(readableError(e));}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 async function choose(e:FormEvent){e.preventDefault();if(!selected)return;setBusy(true);setError('');try{await rpc('choose_band_once',{p_band_id:selected});onDone();}catch(e){setError(readableError(e));}finally{setBusy(false);}}
 return <main className="auth-shell"><section className="auth-card"><Logo/><h1 className="login-heading">Which band are you in?</h1>
  <p className="auth-lead">Choose your band to finish an earlier registration. New sign-ups select bands at registration.</p>
  <form onSubmit={choose} className="form-stack"><label>Your band<select value={selected} onChange={e=>setSelected(e.target.value)} required disabled={loading}><option value="">{loading?'Loading bands…':'Select your band'}</option>{bands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
   <StatusMessage error={error} success=""/>
   <button type="submit" className="button primary full" disabled={busy||!selected}>{busy?'Saving…':'Join this band'} <ArrowRight size={17}/></button>
  </form>
  {!loading&&bands.length===0&&<div className="notice">No bands have been created yet. Ask the administrator to add yours.</div>}
  <button className="admin-login-link" onClick={onLogout}>Log out</button>
 </section></main>;
}

function ChangePasswordScreen({onDone,onLogout}:{onDone:()=>void;onLogout:()=>void}){
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(e:FormEvent){e.preventDefault();if(password!==confirm){setError('The passwords do not match.');return;}setBusy(true);setError('');try{const {error}=await db.auth.updateUser({password});if(error)throw error;await rpc('complete_password_change');onDone();}catch(e){setError(readableError(e));}finally{setBusy(false);}}
 return <main className="auth-shell"><section className="auth-card"><Logo/><h1 className="login-heading">Set a new password</h1><p className="auth-lead">The administrator reset your login. Choose your own password to continue.</p>
  <form className="form-stack" onSubmit={save}><PasswordField label="New password" autoComplete="new-password" value={password} minLength={10} required onChange={setPassword}/><PasswordField label="Confirm password" autoComplete="new-password" minLength={10} required value={confirm} onChange={setConfirm}/><StatusMessage error={error} success=""/><button type="submit" className="button primary full" disabled={busy}>Save password</button></form>
  <button className="admin-login-link" onClick={onLogout}>Log out</button></section></main>;
}

function RecoveryScreen({onComplete}:{onComplete:()=>void}){
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(e:FormEvent){e.preventDefault();if(password.length<10||password!==confirm){setError('Use at least 10 characters and make sure both passwords match.');return;}
  setBusy(true);setError('');try{const {error:authError}=await db.auth.updateUser({password});if(authError)throw authError;
   window.history.replaceState({},'',window.location.pathname);await db.auth.signOut();onComplete();
  }catch(err){setError(readableError(err));}finally{setBusy(false);}}
 return <main className="auth-shell"><section className="auth-card"><Logo/><h1 className="login-heading">Choose a new password</h1><p className="auth-lead">Use a unique password with at least 10 characters.</p>
  <form onSubmit={save} className="form-stack"><PasswordField label="New password" autoComplete="new-password" minLength={10} required value={password} onChange={setPassword}/><PasswordField label="Confirm password" autoComplete="new-password" minLength={10} required value={confirm} onChange={setConfirm}/>{error&&<div className="notice error" role="alert">{error}</div>}<button className="button primary full" disabled={busy}>{busy?'Saving…':'Save new password'}</button></form></section></main>;
}

function ProposalVoteCard({proposal,votes,myId,onResult,compact=false}:{proposal:PracticeRequest;votes:PracticeConfirmation[];myId:string;onResult:(result:string)=>void;compact?:boolean}){
 const relevant=votes.filter(v=>v.request_id===proposal.id);
 const confirmed=relevant.filter(v=>v.decision==='confirmed').length;
 const mine=relevant.find(v=>v.user_id===myId);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[declining,setDeclining]=useState(false),[declineReason,setDeclineReason]=useState('');
 async function respond(confirm:boolean){if(!navigator.onLine){setError('Reconnect to respond to this practice.');return;}setBusy(true);setError('');try{
  const result=await rpc<string>('respond_practice',{p_request:proposal.id,p_confirm:confirm,p_reason:confirm?null:declineReason.trim()||null});onResult(result);
 }catch(e){setError(readableError(e));}finally{setBusy(false);}}
 return <article className={`practice-confirmation ${compact?'compact':''}`}>
  <div className="practice-confirmation-copy"><strong>{describeDate(proposal.practice_date)}</strong><span>{proposal.start_time.slice(0,5)} · {confirmed} of {proposal.expected_confirmations} confirmed</span></div>
  {mine?.decision==='awaiting'?<div className="practice-decline-controls">
    <div className="practice-confirmation-buttons">
      <button type="button" className="button primary small" disabled={busy} onClick={()=>void respond(true)}>Confirm</button>
      {!declining&&<button type="button" className="button subtle small" disabled={busy} onClick={()=>{setDeclining(true);setError('');}}>Decline</button>}
    </div>
    {declining&&<div className="decline-reason-panel">
      <label>Reason for declining (optional)
        <textarea rows={3} maxLength={200} value={declineReason} onChange={e=>setDeclineReason(e.target.value)} placeholder="Let your bandmates know why…" />
      </label>
      <small className="reason-counter">{declineReason.length}/200 characters</small>
      <div className="button-row">
        <button type="button" className="button subtle small" disabled={busy} onClick={()=>{setDeclining(false);setDeclineReason('');}}>Back</button>
        <button type="button" className="button danger small" disabled={busy} onClick={()=>void respond(false)}>{busy?'Declining…':'Confirm decline'}</button>
      </div>
    </div>}
   </div>:<span className="practice-voted">{mine?.decision==='confirmed'?'Your vote: confirmed':'Waiting for the band'}</span>}
  {!compact&&<div className="practice-roster">{relevant.map(v=><span key={v.user_id}><span className={`vote-dot ${v.decision}`}/>{v.member_name}: {v.decision==='confirmed'?'Confirmed':v.decision==='declined'?'Declined':'Waiting'}</span>)}</div>}
  {error&&<div className="notice error" role="alert">{error}</div>}
 </article>;
}

function BookingDialog({date,booking,proposal,votes,myId,band,memberBands,admin,onClose,onSaved}:{date:string;booking:Booking|null;proposal:PracticeRequest|null;votes:PracticeConfirmation[];myId:string;band:Band|null;memberBands:Band[];admin:boolean;onClose:()=>void;onSaved:(message?:string)=>void}){
 const [selectedDate,setSelectedDate]=useState(date),[time,setTime]=useState(booking?.start_time?.slice(0,5)||'19:00');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmCancel,setConfirmCancel]=useState(false),[cancelReason,setCancelReason]=useState('');
 const [bookingBandId,setBookingBandId]=useState(memberBands[0]?.id||'');
 const owned=Boolean(booking&&(admin||memberBands.some(b=>b.id===booking.band_id)));
 const canCreate=!booking&&!proposal&&Boolean(bookingBandId);
 async function save(){if(!navigator.onLine){setError('You are offline. Please reconnect before booking.');return;}setBusy(true);setError('');try{
   if(booking){await rpc('update_booking',{p_id:booking.id,p_date:selectedDate,p_time:time});onSaved('Booking updated.');}
   else {const requestId=await rpc<string>('request_practice',{p_date:selectedDate,p_time:time,p_band:bookingBandId});
    const {data:created}=await db.from('practice_requests').select('status').eq('id',requestId).maybeSingle();
    onSaved(created?.status==='confirmed'?'Practice booked.':created?.status==='clashed'?'Another band has booked that date. Please choose another.':'Practice requested. Waiting for your band to confirm.');}
 }catch(err){setError(readableError(err));}finally{setBusy(false);}}
 async function cancel(){if(!booking)return;if(!navigator.onLine){setError('You are offline. Please reconnect before cancelling.');return;}setBusy(true);setError('');try{await rpc('cancel_booking',{p_id:booking.id,p_reason:cancelReason.trim()||null});onSaved('Practice cancelled. Your band has been notified.');}catch(err){setError(readableError(err));}finally{setBusy(false);}}
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-label="Rehearsal booking">
  <div className="modal-header"><span className="eyebrow">REHEARSAL SPACE</span><button aria-label="Close" className="icon-button" onClick={onClose}><X/></button></div>
  <h2>{booking?(owned?'Your booking':'Room unavailable'):proposal?'Band confirmation':'Request practice'}</h2><p className="subdued">{describeDate(date)}</p>
  {booking&&!owned?<div className="occupied"><span className="band-dot" style={{background:band?.colour}}/><div><strong>{band?.name||'Another band'} have this day booked.</strong><p>Practice starts at {booking.start_time.slice(0,5)}.</p></div></div>:
  proposal&&!booking?<ProposalVoteCard proposal={proposal} votes={votes} myId={myId} onResult={r=>onSaved(r==='confirmed'?'Everyone confirmed. Practice booked.':r==='declined'?'Practice request declined.':r==='clashed'?'Another band booked first.':'Your confirmation has been saved.')} />:
  <div className="form-stack">
    <label>Practice date<input type="date" min={todayInLondon()} value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/></label>
    {!booking&&memberBands.length>1&&<label>Book for band<select value={bookingBandId} onChange={e=>setBookingBandId(e.target.value)}>{memberBands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}{!booking&&memberBands.length===1&&<p className="helper">Your band: {memberBands[0].name}. Other members will be asked to confirm.</p>}
    <label>Start time<div className="field-with-icon"><Clock size={18}/><select value={time} onChange={e=>setTime(e.target.value)}>{TIME_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}</select></div></label>
    {!booking&&!canCreate&&<p className="helper">Ask the administrator to assign you to a band before requesting a rehearsal.</p>}
    <button className="button primary full" onClick={save} disabled={busy||!booking&&!canCreate}>{busy?'Saving…':booking?'Save changes':'Request practice'}</button>
    {booking&&!confirmCancel&&<button className="button text-danger" onClick={()=>setConfirmCancel(true)}><Trash2 size={16}/> Cancel this practice</button>}
    {booking&&confirmCancel&&<div className="confirm-box">
      <strong>Definitely cancel this rehearsal?</strong><p>The day will become available to other bands and your bandmates will be notified.</p>
      <label className="cancellation-reason-label">Reason for cancelling (optional)
        <textarea rows={3} maxLength={200} value={cancelReason} onChange={e=>setCancelReason(e.target.value)} placeholder="Let your bandmates know why…" />
      </label>
      <small className="reason-counter">{cancelReason.length}/200 characters</small>
      <div className="button-row"><button type="button" className="button subtle" disabled={busy} onClick={()=>{setConfirmCancel(false);setCancelReason('');}}>Keep booking</button>
        <button type="button" className="button danger" disabled={busy} onClick={()=>void cancel()}>{busy?'Cancelling…':'Yes, cancel'}</button>
      </div>
    </div>}
   </div>}
    {error&&<div className="notice error" role="alert">{error}</div>}
 </section></div>;
}

type AdminAlertPrefs={registration_alerts:boolean;all_band_booking_alerts:boolean;all_band_cancellation_alerts:boolean};
const DEFAULT_ADMIN_ALERT_PREFS:AdminAlertPrefs={registration_alerts:true,all_band_booking_alerts:false,all_band_cancellation_alerts:false};

function NotificationPanel({notices,userId,requests,votes,isAdmin,onClose,onRefresh,onMessage}:{notices:Notice[];userId:string;requests:PracticeRequest[];votes:PracticeConfirmation[];isAdmin:boolean;onClose:()=>void;onRefresh:()=>void;onMessage:(message:string)=>void}){
 const [pushMessage,setPushMessage]=useState('');
 const [confirmClear,setConfirmClear]=useState(false),[clearing,setClearing]=useState(false),[clearMessage,setClearMessage]=useState('');
 const [alertPrefs,setAlertPrefs]=useState<AdminAlertPrefs>({...DEFAULT_ADMIN_ALERT_PREFS});
 const [prefsLoading,setPrefsLoading]=useState(isAdmin),[prefsSaving,setPrefsSaving]=useState(false),[prefsMessage,setPrefsMessage]=useState('');
 useEffect(()=>{
  if(!isAdmin)return;
  let active=true;
  void (async()=>{
   try{
    const {data,error}=await db.from('admin_notification_preferences')
      .select('registration_alerts,all_band_booking_alerts,all_band_cancellation_alerts')
      .eq('user_id',userId).maybeSingle();
    if(error)throw error;
    if(active)setAlertPrefs(data?{
      registration_alerts:data.registration_alerts,
      all_band_booking_alerts:data.all_band_booking_alerts,
      all_band_cancellation_alerts:data.all_band_cancellation_alerts
    }:{...DEFAULT_ADMIN_ALERT_PREFS});
   }catch(e){if(active)setPrefsMessage(readableError(e));}
   finally{if(active)setPrefsLoading(false);}
  })();
  return()=>{active=false;};
 },[isAdmin,userId]);
 async function saveAlertPrefs(){
  setPrefsSaving(true);setPrefsMessage('');
  try{
   const {error}=await db.from('admin_notification_preferences').upsert({
    user_id:userId,...alertPrefs,updated_at:new Date().toISOString()
   },{onConflict:'user_id'});
   if(error)throw error;
   setPrefsMessage('Notification preferences saved.');
  }catch(e){setPrefsMessage(readableError(e));}
  finally{setPrefsSaving(false);}
 }
 async function clearNotifications(){
  if(!notices.length){setConfirmClear(false);return;}
  setClearing(true);setClearMessage('');
  try{
   const ordered=[...notices].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
   const count=await rpc<number>('clear_my_notifications',{p_through_id:ordered[0].id});
   setConfirmClear(false);
   setClearMessage(count===1?'1 notification cleared.':`${count} notifications cleared.`);
   onRefresh();
  }catch(err){setClearMessage(readableError(err));}
  finally{setClearing(false);}
 }
 return <div className="overlay-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><aside className="side-panel" aria-label="Notifications">
  <div className="panel-heading"><h2>Notifications</h2><button aria-label="Close" className="icon-button" onClick={onClose}><X/></button></div>
  {requests.length>0&&<div className="notification-requests"><h3>Practice confirmations</h3>{requests.map(req=><ProposalVoteCard key={req.id} proposal={req} votes={votes} myId={userId} onResult={r=>{onMessage(r==='confirmed'?'Practice booked.':r==='declined'?'Request declined.':'Response saved.');onRefresh();}} />)}</div>}
  <div className="push-settings"><p className="push-guidance">iPhone: add 88 Bunkspace to your Home Screen first, then enable alerts here. Android: allow notifications when prompted.</p><button className="button subtle small" onClick={()=>void enablePush(userId).then(setPushMessage).catch(e=>setPushMessage(readableError(e)))}>Enable phone alerts</button><button className="button subtle small" onClick={()=>void disablePush(userId).then(setPushMessage).catch(e=>setPushMessage(readableError(e)))}>Disable phone alerts</button><button type="button" className="button subtle small" disabled={notices.length===0||clearing} onClick={()=>{setClearMessage('');setConfirmClear(true);}}>Clear notifications</button>{pushMessage&&<p role="status" className="fineprint">{pushMessage}</p>}</div>
  {isAdmin&&<section className="admin-alert-settings" aria-label="Admin notification preferences">
    <h3>Admin alerts</h3>
    <p className="admin-alert-description">Choose which room-wide updates you receive. Your own band's rehearsal confirmations are unaffected.</p>
    {prefsLoading?<p className="helper">Loading preferences…</p>:<>
      <label className="admin-alert-toggle"><input type="checkbox" checked={alertPrefs.registration_alerts} onChange={e=>{setAlertPrefs(p=>({...p,registration_alerts:e.target.checked}));setPrefsMessage('');}}/><span><strong>New member registrations</strong><small>Get notified when an account needs approval.</small></span></label>
      <label className="admin-alert-toggle"><input type="checkbox" checked={alertPrefs.all_band_booking_alerts} onChange={e=>{setAlertPrefs(p=>({...p,all_band_booking_alerts:e.target.checked}));setPrefsMessage('');}}/><span><strong>Bookings from all bands</strong><small>Optional alerts when another band confirms a practice.</small></span></label>
      <label className="admin-alert-toggle"><input type="checkbox" checked={alertPrefs.all_band_cancellation_alerts} onChange={e=>{setAlertPrefs(p=>({...p,all_band_cancellation_alerts:e.target.checked}));setPrefsMessage('');}}/><span><strong>Cancellations from all bands</strong><small>Optional alerts when another band cancels a confirmed practice.</small></span></label>
      <button type="button" className="button primary small" disabled={prefsSaving} onClick={()=>void saveAlertPrefs()}>{prefsSaving?'Saving…':'Save notification choices'}</button>
    </>}
    {prefsMessage&&<p role="status" className="admin-alert-status">{prefsMessage}</p>}
   </section>}
  {confirmClear&&<div className="clear-notifications-confirm" role="group" aria-label="Confirm clearing notification history"><p>Clear your {notices.length} notification{notices.length===1?'':'s'}? This removes past messages, not pending practice confirmations or phone alert settings.</p><div className="button-row"><button type="button" className="button subtle small" disabled={clearing} onClick={()=>setConfirmClear(false)}>Keep notifications</button><button type="button" className="button danger small" disabled={clearing} onClick={()=>void clearNotifications()}>{clearing?'Clearing…':'Yes, clear'}</button></div></div>}
  {clearMessage&&<p className="clear-notifications-message" role="status">{clearMessage}</p>}
  {notices.length===0?<p className="empty">Nothing new.</p>:notices.map(n=><div key={n.id} className={`notice-item ${n.read_at?'':'unread'}`}><span className="notice-dot"/><span><strong>{n.title}</strong><small>{n.body}</small><em>{new Date(n.created_at).toLocaleString('en-GB')}</em></span></div>)}
 </aside></div>;
}

async function enablePush(userId:string):Promise<string>{
 if(!('serviceWorker' in navigator)||!('PushManager' in window))return 'This browser does not support push notifications.';
 const vapid=(import.meta.env.VITE_VAPID_PUBLIC_KEY as string|undefined)||VAPID_PUBLIC_KEY;
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

function AdminPanel({profiles,bands,memberships,bookings,audits,onRefresh,onMessage}:{profiles:Profile[];bands:Band[];memberships:BandMembership[];bookings:Booking[];audits:Audit[];onRefresh:()=>void;onMessage:(text:string)=>void}){
 const [newBand,setNewBand]=useState({name:'',member_count:4,colour:STUDIO_COLOURS[0]});
 const [edit,setEdit]=useState<Band|null>(null),[editForm,setEditForm]=useState({name:'',member_count:4,colour:''});
 const [changing,setChanging]=useState<Profile|null>(null),[assignedBands,setAssignedBands]=useState<string[]>([]);
 const pendingRef=useRef<HTMLDivElement|null>(null);
 const [passwordTarget,setPasswordTarget]=useState<Profile|null>(null),[newPassword,setNewPassword]=useState('');
 const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
 const members=profiles.filter(p=>p.role==='band');
 const pendingMembers=members.filter(p=>p.status==='pending');
 const editMemberships=(p:Profile)=>{setChanging(p);setAssignedBands(memberships.filter(m=>m.user_id===p.id).map(m=>m.band_id));};
 const [deleteTarget,setDeleteTarget]=useState<{kind:'band'|'member';id:string;name:string}|null>(null);
 async function createBand(e:FormEvent){e.preventDefault();setBusy('create');setError('');try{
  await rpc('admin_create_band',{p_name:newBand.name,p_count:newBand.member_count,p_colour:newBand.colour});
  setNewBand({name:'',member_count:4,colour:STUDIO_COLOURS[(bands.length+1)%STUDIO_COLOURS.length]});onMessage('Band created. Members can now choose it during sign-up.');onRefresh();
 }catch(e){setError(readableError(e));}finally{setBusy(null);}}
 async function saveBand(e:FormEvent){e.preventDefault();if(!edit)return;setBusy(edit.id);setError('');try{
  await rpc('admin_update_band',{p_band_id:edit.id,p_name:editForm.name,p_count:editForm.member_count,p_colour:editForm.colour,p_contact:''});setEdit(null);onMessage('Band updated.');onRefresh();
 }catch(e){setError(readableError(e));}finally{setBusy(null);}}
 async function changeStatus(id:string,status:'approved'|'rejected'|'deactivated'){setBusy(id);setError('');try{await rpc('admin_set_status',{p_user_id:id,p_status:status});onMessage(`Member ${status}.`);onRefresh();}catch(e){setError(readableError(e));}finally{setBusy(null);}}
 async function saveMemberBand(e:FormEvent){e.preventDefault();if(!changing)return;setBusy(changing.id);setError('');try{if(assignedBands.length===0)throw new Error('Select at least one band.');await rpc('admin_set_member_bands',{p_user_id:changing.id,p_band_ids:assignedBands});setChanging(null);onMessage('Band assignments updated.');onRefresh();}catch(e){setError(readableError(e));}finally{setBusy(null);}}
 async function resetPassword(e:FormEvent){e.preventDefault();if(!passwordTarget)return;setBusy(passwordTarget.id);setError('');try{
  if(newPassword.length<10)throw new Error('Use at least 10 characters for the temporary password.');
  const {data,error}=await db.functions.invoke('admin-member-access',{body:{action:'reset_password',user_id:passwordTarget.id,password:newPassword}});
  if(error||data?.error)throw new Error(data?.error||'Unable to reset password');
  setPasswordTarget(null);setNewPassword('');onMessage('Temporary password set. Send it privately to the member; they will change it at next sign-in.');onRefresh();
 }catch(e){setError(readableError(e));}finally{setBusy(null);}}
  const startEdit=(band:Band)=>{setEdit(band);setEditForm({name:band.name,member_count:band.member_count,colour:band.colour});};
 async function confirmDeletion(){if(!deleteTarget)return;
  setError('');setBusy('deleting');
  try{
   if(deleteTarget.kind==='member'){
    const {data,error:callError}=await db.functions.invoke('admin-member-access',{body:{action:'delete_member',user_id:deleteTarget.id}});
    if(callError||data?.error)throw new Error(data?.error||callError?.message||'Unable to delete the member');
    onMessage('Account deleted. Its bookings remain in the room history.');
   }else{
    const result=await rpc<'deleted'|'archived'>('admin_delete_band',{p_band_id:deleteTarget.id});
    onMessage(result==='archived'?'Band archived. Its previous rehearsal history has been kept.':'Band deleted.');
   }
   setDeleteTarget(null);onRefresh();
  }catch(e){setError(readableError(e));}finally{setBusy(null);}
 }
 const memberRow=(p:Profile)=><article className="band-member" key={p.id}><div className="band-member-copy"><strong>{p.contact_name}</strong><small>{p.email}</small><small>Assigned: {bands.filter(b=>memberships.some(m=>m.user_id===p.id&&m.band_id===b.id)).map(b=>b.name).join(', ')||'No bands'}</small></div><span className={`status-tag ${p.status}`}>{p.status}</span><div className="band-actions">
  {p.status==='pending'&&memberships.some(m=>m.user_id===p.id)&&<button className="button primary small" disabled={busy!==null} onClick={()=>changeStatus(p.id,'approved')}>Approve</button>}
  {p.status==='deactivated'||p.status==='rejected'?<button className="button subtle small" disabled={busy!==null} onClick={()=>changeStatus(p.id,'approved')}>Reactivate</button>:<button className="button subtle small" disabled={busy!==null} onClick={()=>changeStatus(p.id,'deactivated')}>Deactivate</button>}
  <button className="button subtle small" onClick={()=>editMemberships(p)}>Manage bands</button>
  <button className="button subtle small" disabled={busy!==null} onClick={()=>{setPasswordTarget(p);setNewPassword('');}}>Reset password</button>
  <button className="button small text-danger" disabled={busy!==null} onClick={()=>setDeleteTarget({kind:'member',id:p.id,name:p.contact_name})}><Trash2 size={15}/> Delete account</button>
 </div></article>;
 return <section className="admin-section">
  <div className="section-heading"><h2>Bands and members</h2><p>Members can select several bands when registering. You approve their account once, and manage memberships here.</p></div>
  {error&&<div className="notice error" role="alert">{error}</div>}
  <form className="create-band-panel form-stack" onSubmit={createBand}><h3>Add a band</h3>
   <label>Band name<input required minLength={2} maxLength={80} value={newBand.name} onChange={e=>setNewBand({...newBand,name:e.target.value})} placeholder="e.g. The Fuzz"/></label>
   <label>Expected band members (information only)<input required type="number" min="1" max="50" value={newBand.member_count} onChange={e=>setNewBand({...newBand,member_count:Number(e.target.value)})}/></label>
   <label>Band colour<div className="colour-options">{STUDIO_COLOURS.map(c=><button type="button" aria-label={`Choose colour ${c}`} key={c} className={`colour-chip ${newBand.colour===c?'active':''}`} style={{background:c}} onClick={()=>setNewBand({...newBand,colour:c})}>{newBand.colour===c&&<Check size={18} color={hexIsLight(c)?'#121212':'#FFF3D6'}/>}</button>)}</div></label>
   <button type="submit" className="button primary" disabled={busy!==null}><Plus size={17}/>{busy==='create'?'Creating…':'Add band'}</button>
  </form>
  <div className="stat-grid"><div><b>{bands.length}</b><span>Bands</span></div><div><b>{members.filter(p=>p.status==='approved').length}</b><span>Active members</span></div><div><b>{bookings.filter(b=>b.status==='confirmed').length}</b><span>Bookings</span></div><button className="pending-approvals-stat" type="button" onClick={()=>pendingRef.current?.scrollIntoView({behavior:'smooth',block:'start'})} aria-label={`${pendingMembers.length} accounts pending approval. Jump to pending accounts.`}><b>{pendingMembers.length}</b><span>Pending approvals</span></button></div>
   <div ref={pendingRef} className="pending-accounts" id="pending-accounts"><h3>Waiting for approval ({pendingMembers.length})</h3>{pendingMembers.length===0?<p className="empty">Nothing waiting.</p>:pendingMembers.map(memberRow)}</div>
   <h3>Bands and their members</h3><div className="band-list">{bands.length===0?<p className="empty">Create your first band above.</p>:bands.map(b=>{const linked=profiles.filter(p=>memberships.some(m=>m.band_id===b.id&&m.user_id===p.id));const waiting=linked.filter(p=>p.status==='pending').length;return <article className={`band-admin-card ${waiting>0?'has-pending':''}`} key={b.id}>
    <div className="band-admin-head"><span className="band-dot large" style={{background:b.colour}}/><div><strong>{b.name}</strong><small>{linked.length} account{linked.length===1?'':'s'} · {b.member_count} expected {waiting>0?`· ${waiting} waiting`:''}</small></div></div>
    <div className="band-actions"><button className="button subtle small" onClick={()=>startEdit(b)}>Edit band</button><button className="button small text-danger" onClick={()=>setDeleteTarget({kind:'band',id:b.id,name:b.name})}><Trash2 size={15}/> Delete band</button></div>
    <div className="band-members"><h4>Associated accounts</h4>{linked.length===0?<p className="empty">No accounts assigned yet.</p>:linked.map(p=>p.role==='admin'?<div className="band-member" key={p.id}><div className="band-member-copy"><strong>{p.contact_name} · Admin</strong><small>{p.email}</small></div><div className="band-actions"><button className="button subtle small" onClick={()=>editMemberships(p)}>Manage bands</button></div></div>:memberRow(p))}</div>
   </article>;})}</div>
   {members.some(p=>!memberships.some(m=>m.user_id===p.id))&&<><h3 className="admin-subheading">Not assigned to a band</h3><div className="band-list">{members.filter(p=>!memberships.some(m=>m.user_id===p.id)).map(memberRow)}</div></>}
  <div className="audit-section"><h3>Recent activity</h3>{audits.length===0?<p className="empty">No activity yet.</p>:<div className="audit-list">{audits.slice(0,12).map(a=><div className="audit-line" key={a.id}><strong>{a.action.replaceAll('.',' · ')}</strong><span>{new Date(a.created_at).toLocaleString('en-GB')}</span></div>)}</div>}</div>
   {deleteTarget&&<div className="modal-backdrop"><section className="modal form-stack" role="dialog" aria-modal="true" aria-label="Confirm deletion"><div className="modal-header"><span className="eyebrow">PLEASE CONFIRM</span><button type="button" className="icon-button" aria-label="Close" onClick={()=>setDeleteTarget(null)}><X/></button></div><h2>Delete {deleteTarget.name}?</h2><p className="subdued">{deleteTarget.kind==='member'?'This permanently removes the login. Their past bookings stay in the rehearsal history.':'Members will need to choose a new band. If this band has confirmed bookings, cancel them first. Past booking history will be preserved.'}</p><div className="button-row"><button className="button subtle" onClick={()=>setDeleteTarget(null)}>Keep it</button><button className="button danger" disabled={busy!==null} onClick={()=>void confirmDeletion()}>{busy==='deleting'?'Deleting…':'Yes, delete'}</button></div></section></div>}
  {edit&&<div className="modal-backdrop"><form className="modal form-stack" onSubmit={saveBand} aria-modal="true" role="dialog" aria-label="Edit band"><div className="modal-header"><span className="eyebrow">EDIT BAND</span><button type="button" className="icon-button" onClick={()=>setEdit(null)} aria-label="Close"><X/></button></div><h2>{edit.name}</h2><label>Band name<input required minLength={2} maxLength={80} value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})}/></label><label>Expected band members (information only)<input type="number" min="1" max="50" required value={editForm.member_count} onChange={e=>setEditForm({...editForm,member_count:Number(e.target.value)})}/></label><label>Colour<div className="colour-options">{STUDIO_COLOURS.map(c=><button type="button" key={c} className={`colour-chip ${editForm.colour===c?'active':''}`} aria-label={`Choose colour ${c}`} style={{background:c}} onClick={()=>setEditForm({...editForm,colour:c})}>{editForm.colour===c&&<Check size={18} color={hexIsLight(c)?'#121212':'#FFF3D6'}/>}</button>)}</div></label><button className="button primary" disabled={busy!==null}>Save band</button></form></div>}
  {changing&&<div className="modal-backdrop"><form className="modal form-stack" onSubmit={saveMemberBand} role="dialog" aria-modal="true" aria-label="Change member band"><div className="modal-header"><span className="eyebrow">MEMBER BAND</span><button type="button" className="icon-button" onClick={()=>setChanging(null)} aria-label="Close"><X/></button></div><h2>Bands for {changing.contact_name}</h2><p className="subdued">Only the administrator can change memberships.</p><fieldset className="signup-band-picker"><legend>Assigned bands</legend>{bands.map(b=><label className="band-checkbox" key={b.id}><input type="checkbox" checked={assignedBands.includes(b.id)} onChange={e=>setAssignedBands(old=>e.target.checked?[...old,b.id]:old.filter(id=>id!==b.id))}/>{b.name}</label>)}</fieldset><button className="button primary" disabled={busy!==null||assignedBands.length===0}>Save memberships</button></form></div>}
  {passwordTarget&&<div className="modal-backdrop"><form className="modal form-stack" onSubmit={resetPassword} role="dialog" aria-modal="true" aria-label="Reset member password"><div className="modal-header"><span className="eyebrow">PASSWORD</span><button type="button" className="icon-button" onClick={()=>setPasswordTarget(null)} aria-label="Close"><X/></button></div><h2>Reset password</h2><p className="subdued">Set a temporary password for {passwordTarget.contact_name}. Share it privately. They must change it on login.</p><PasswordField label="Temporary password" required minLength={10} autoComplete="new-password" value={newPassword} onChange={setNewPassword}/><button className="button primary" disabled={busy!==null}>Save temporary password</button></form></div>}
 </section>;
}

export default function App(){
 const [session,setSession]=useState<Session|null>(null),[profile,setProfile]=useState<Profile|null>(null);
 const [bands,setBands]=useState<Band[]>([]),[profiles,setProfiles]=useState<Profile[]>([]),[bookings,setBookings]=useState<Booking[]>([]),[notices,setNotices]=useState<Notice[]>([]),[audits,setAudits]=useState<Audit[]>([]);
 const [practiceRequests,setPracticeRequests]=useState<PracticeRequest[]>([]),[practiceVotes,setPracticeVotes]=useState<PracticeConfirmation[]>([]);
 const [memberships,setMemberships]=useState<BandMembership[]>([]),[recovering,setRecovering]=useState(false);
 const touchStart=useRef<{x:number;y:number}|null>(null);
 const [online,setOnline]=useState(navigator.onLine);
 const [loading,setLoading]=useState(true),[fetching,setFetching]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [panel,setPanel]=useState<'calendar'|'admin'>('calendar'),[showNotifications,setShowNotifications]=useState(()=>new URLSearchParams(window.location.search).has('notifications')),[showMenu,setShowMenu]=useState(false);
 const [chosen,setChosen]=useState<string|null>(null);
 const [month,setMonth]=useState(()=>{const today=todayInLondon().split('-').map(Number);return {year:today[0],month:today[1]-1};});
 useEffect(()=>{if(!session||!profile||profile.status!=='approved')return;
  const query=new URLSearchParams(window.location.search);
  if(query.has('admin')&&(profile.role==='admin'||profile.role==='superadmin')){
   setPanel('admin');query.delete('admin');window.history.replaceState({},'',window.location.pathname+(query.size?'?'+query.toString():''));
   window.setTimeout(()=>document.getElementById('pending-accounts')?.scrollIntoView({block:'start'}),100);
  }else if(query.has('notifications')){
   void openNotifications();query.delete('notifications');window.history.replaceState({},'',window.location.pathname+(query.size?'?'+query.toString():''));
  }
 },[session?.user.id,profile?.status,profile?.role]);
 useEffect(()=>{const handler=(event:MessageEvent)=>{if(event.data?.type==='OPEN_NOTIFICATIONS')void openNotifications();if(event.data?.type==='OPEN_APPROVALS'){setPanel('admin');window.setTimeout(()=>document.getElementById('pending-accounts')?.scrollIntoView({block:'start'}),100);}};
  navigator.serviceWorker?.addEventListener('message',handler);return()=>navigator.serviceWorker?.removeEventListener('message',handler);
 },[session?.user.id]);

 useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);};},[]);
 const refresh=useCallback(async()=>{const {data:{session:active}}=await db.auth.getSession();setSession(active);
   if(!active){setProfile(null);setBands([]);setBookings([]);setProfiles([]);setNotices([]);setAudits([]);setPracticeRequests([]);setPracticeVotes([]);setMemberships([]);setLoading(false);return;}
   setFetching(true);
   try{
    const {data:user,error:ue}=await db.from('profiles').select('*').eq('id',active.user.id).single();if(ue)throw ue;setProfile(user as Profile);
    if(user.status!=='approved'){setBands([]);setProfiles([]);setBookings([]);setNotices([]);setAudits([]);setPracticeRequests([]);setPracticeVotes([]);setMemberships([]);return;}
    const [br,bb,nn,pr,pv,mb]=await Promise.all([db.from('bands').select('*').is('archived_at',null).order('name'),db.from('bookings').select('*').order('practice_date'),db.from('notifications').select('*').order('created_at',{ascending:false}).limit(70),db.from('practice_requests').select('*').order('created_at',{ascending:false}).limit(100),db.from('practice_confirmations').select('*'),db.from('band_memberships').select('*')]);
    if(br.error||bb.error||nn.error||pr.error||pv.error||mb.error)throw br.error||bb.error||nn.error||pr.error||pv.error||mb.error;
    setBands((br.data||[]) as Band[]);setBookings((bb.data||[]) as Booking[]);setNotices((nn.data||[]) as Notice[]);setPracticeRequests((pr.data||[]) as PracticeRequest[]);setPracticeVotes((pv.data||[]) as PracticeConfirmation[]);setMemberships((mb.data||[]) as BandMembership[]);
    if(user.role==='admin'||user.role==='superadmin'){const [all,history]=await Promise.all([db.from('profiles').select('*').order('created_at',{ascending:false}),db.from('audit_events').select('*').order('created_at',{ascending:false}).limit(30)]);if(all.error||history.error)throw all.error||history.error;setProfiles((all.data||[]) as Profile[]);setAudits((history.data||[]) as Audit[]);}
    setError('');
   }catch(e){setError(readableError(e));}finally{setFetching(false);setLoading(false);}
 },[]);
 useEffect(()=>{
   void refresh();const {data:{subscription}}=db.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_OUT'){setPanel('calendar');setRecovering(false);}
    if(event==='PASSWORD_RECOVERY'){setRecovering(true);}
    // Avoid awaiting Supabase API calls inside its auth callback.
    setTimeout(()=>{void refresh();},0);
   });return()=>subscription.unsubscribe();
 },[refresh]);
 useEffect(()=>{if(!session||profile?.status!=='approved')return;
   const channel=db.channel('bunkface-live').on('postgres_changes',{event:'*',schema:'public',table:'bookings'},()=>void refresh())
     .on('postgres_changes',{event:'*',schema:'public',table:'notifications'},()=>void refresh())
     .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},()=>void refresh())
     .on('postgres_changes',{event:'*',schema:'public',table:'band_memberships'},()=>void refresh())
     .on('postgres_changes',{event:'*',schema:'public',table:'practice_requests'},()=>void refresh())
     .on('postgres_changes',{event:'*',schema:'public',table:'practice_confirmations'},()=>void refresh()).subscribe();
   const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},60000);
   const visibility=()=>{if(!document.hidden)void refresh();};document.addEventListener('visibilitychange',visibility);
   return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',visibility);void db.removeChannel(channel);};
 },[session?.user.id,profile?.status,refresh]);
 const monthDays=useMemo(()=>monthCells(month.year,month.month),[month]);
 const currentDate=todayInLondon();
 const currentMonthBookings=useMemo(()=>new Map(bookings.filter(b=>b.status==='confirmed').map(b=>[b.practice_date,b])),[bookings]);
 const selectedBooking=chosen?currentMonthBookings.get(chosen)||null:null;
 const ownMemberships=memberships.filter(m=>m.user_id===profile?.id).map(m=>m.band_id);
 const ownBands=bands.filter(b=>ownMemberships.includes(b.id));
 const ownPendingRequests=practiceRequests.filter(r=>r.status==='pending'&&ownMemberships.includes(r.band_id));
 const selectedRequest=chosen?ownPendingRequests.find(r=>r.practice_date===chosen)||null:null;
 const awaitingMyVote=ownPendingRequests.filter(r=>practiceVotes.some(v=>v.request_id===r.id&&v.user_id===profile?.id&&v.decision==='awaiting'));
 const selectedBand=selectedBooking?bands.find(b=>b.id===selectedBooking.band_id)||null:null;
 const approved=profile?.status==='approved',admin=profile?.role==='admin'||profile?.role==='superadmin';
 function monthBy(delta:number){const date=new Date(Date.UTC(month.year,month.month+delta,1));const today=todayInLondon().slice(0,7);const target=`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;if(target<today)return;setMonth({year:date.getUTCFullYear(),month:date.getUTCMonth()});}
 const viewingCurrentMonth=`${month.year}-${String(month.month+1).padStart(2,'0')}`<=currentDate.slice(0,7);
 useEffect(()=>{const current=todayInLondon().slice(0,7);const displayed=`${month.year}-${String(month.month+1).padStart(2,'0')}`;if(displayed<current){const [y,m]=current.split('-').map(Number);setMonth({year:y,month:m-1});}},[month.year,month.month,currentDate]);
 async function openNotifications(){setShowNotifications(true);
  try{const {data, error:queryError}=await db.from('notifications').select('id').is('read_at',null).order('created_at',{ascending:false}).limit(1);if(queryError)throw queryError;
   if(data?.[0]?.id){await rpc('mark_all_notices_read',{p_through_id:data[0].id});await refresh();}
  }catch(e){setError(readableError(e));}}
 async function doLogout(){try{if('serviceWorker' in navigator){const registration=await navigator.serviceWorker.ready;const sub=await registration.pushManager?.getSubscription();if(sub){await db.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);await sub.unsubscribe();}}}catch{/* Still allow logout if push cleanup is unavailable */}await db.auth.signOut();setMessage('');setSession(null);setProfile(null);}
 function saved(text='Calendar updated. Updated.'){setChosen(null);setMessage(text);void refresh();}
 if(!configured)return <div className="config-screen"><Logo/><h2>Almost ready to rock.</h2><p>The app needs its Supabase project configured before it can accept logins and bookings.</p><p>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> as described in <code>DEPLOYMENT.md</code>.</p></div>;
 if(loading)return <div className="config-screen"><Logo/><p>Loading your rehearsal space…</p></div>;
 if(!session||!profile)return <AuthScreen onDone={()=>{void refresh();}}/>;
 if(recovering||new URLSearchParams(window.location.search).has('reset'))return <RecoveryScreen onComplete={()=>{setRecovering(false);void refresh();}}/>;
 if(profile.role==='band'&&!profile.band_id&&profile.status==='pending')return <ChooseBandScreen onDone={()=>void refresh()} onLogout={()=>void doLogout()}/>;
 if(profile.must_change_password)return <ChangePasswordScreen onDone={()=>void refresh()} onLogout={()=>void doLogout()}/>;
 if(!approved)return <main className="auth-shell"><section className="auth-card"><Logo/><div className="pending-icon"><Clock size={32}/></div><h1>{profile.status==='pending'?'Waiting for approval':profile.status==='rejected'?'Registration declined':'Account deactivated'}</h1><p className="auth-lead">{profile.status==='pending'?'Your selected bands have been sent to the administrator for approval.':SUPPORT?<>Contact <a className="support-email" href={`mailto:${SUPPORT}`}>{SUPPORT}</a> if you think this is a mistake.</>:<>Contact the room administrator if you think this is a mistake.</>}</p><div className="button-row"><button className="button subtle" onClick={()=>void refresh()}><RefreshCw size={16}/> Check again</button><button className="button subtle" onClick={doLogout}><LogOut size={16}/> Log out</button></div></section></main>;
  return <div className={`app-layout ${panel==='calendar'?'calendar-mode':''}`}>
   <header className="site-header"><div className="header-inner"><Logo small/>
    <nav className="desktop-nav"><button className={panel==='calendar'?'active':''} onClick={()=>setPanel('calendar')}><CalendarDays size={17}/> Calendar</button>{admin&&<button className={panel==='admin'?'active':''} onClick={()=>setPanel('admin')}><ShieldCheck size={17}/> Admin</button>}</nav>
    <div className="header-actions"><a className="help-nav-link" href="/help.html" aria-label="How to use 88 Bunkspace" title="How to use 88 Bunkspace">?</a><button className="icon-button" aria-label="Refresh calendar" title="Refresh" onClick={()=>void refresh()}><RefreshCw size={19} className={fetching?'spin':''}/></button>
     <button className="icon-button notify-button" aria-label="Notifications and band confirmations" onClick={()=>void openNotifications()}><Bell size={21}/>{(notices.some(n=>!n.read_at)||awaitingMyVote.length>0)&&<span className="notification-count"/>}</button>
     <button className="icon-button menu-button" aria-label="Menu" onClick={()=>setShowMenu(!showMenu)}><Menu size={21}/></button>
     <button className="button logout desktop-logout" onClick={doLogout}><LogOut size={16}/> Log out</button>
    </div></div></header>
   {showMenu&&<div className="mobile-menu"><button onClick={()=>{setPanel('calendar');setShowMenu(false);}}>Calendar</button>{admin&&<button onClick={()=>{setPanel('admin');setShowMenu(false);}}>Admin</button>}<button onClick={doLogout}>Log out</button></div>}
   <main className={`main-container ${panel==='calendar'?'calendar-page':''}`}>
    {!online&&<div className="notice error" role="status">You are offline. Bookings are disabled until you reconnect.</div>}
    {error&&<div className="notice error" role="alert">{error}<button className="mini-close" onClick={()=>setError('')} aria-label="Dismiss"><X size={16}/></button></div>}
    {message&&<div className="notice success" role="status">{message}<button className="mini-close" onClick={()=>setMessage('')} aria-label="Dismiss"><X size={16}/></button></div>}
    {panel==='admin'&&admin?<AdminPanel profiles={profiles} bands={bands} memberships={memberships} bookings={bookings} audits={audits} onRefresh={()=>void refresh()} onMessage={setMessage}/>:<>
     {awaitingMyVote.length>0&&<div className="pending-banner"><strong>{awaitingMyVote.length} practice {awaitingMyVote.length===1?'needs':'requests need'} your confirmation</strong><button className="button primary small" onClick={()=>void openNotifications()}>Review</button></div>}
     <section className="calendar-card"><div className="calendar-header"><h2>{getMonthTitle(month.year,month.month)}</h2><div className="calendar-nav"><button aria-label="Previous month" title={viewingCurrentMonth?'Earlier months are unavailable':'Previous month'} disabled={viewingCurrentMonth} onClick={()=>monthBy(-1)}><ChevronLeft size={21}/></button><button className="today-button" onClick={()=>{const d=currentDate.split('-').map(Number);setMonth({year:d[0],month:d[1]-1});}}>Today</button><button aria-label="Next month" onClick={()=>monthBy(1)}><ChevronRight size={21}/></button></div></div>
     <div className="calendar-grid" onTouchStart={e=>{touchStart.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchEnd={e=>{if(!touchStart.current)return;const dx=e.changedTouches[0].clientX-touchStart.current.x;const dy=e.changedTouches[0].clientY-touchStart.current.y;touchStart.current=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.4)monthBy(dx<0?1:-1);}}>{WEEKDAYS.map((w,i)=><div className="weekday" key={`${w}${i}`}>{w}</div>)}
       {monthDays.map((d,i)=>{if(d===null)return <div className="blank-day" key={`blank${i}`}/>;const key=dateKey(month.year,month.month,d);const b=currentMonthBookings.get(key);const band=b?bands.find(x=>x.id===b.band_id):undefined;const past=key<currentDate;const isToday=key===currentDate;const pending=ownPendingRequests.find(r=>r.practice_date===key);
         return <button type="button" key={key} className={`calendar-day ${b?'booked':''} ${pending&&!b?'pending-practice':''} ${past&&!b?'past':''} ${isToday?'today':''}`} style={b?{'--band-colour':band?.colour||'#7DDF64',color:hexIsLight(band?.colour||'#7DDF64')?'#121212':'#FFF3D6'} as CSSProperties:undefined} onClick={()=>setChosen(key)} disabled={past&&!b} aria-label={`${describeDate(key)}: ${b?`${band?.name||'Booked'} at ${b.start_time.slice(0,5)}`:past?'Past date':'Available'}`}>
         <span className="day-number">{d}</span>{b?<span className="day-booked"><span className="day-band">{band?.name||'Booked'}</span><span className="day-time">{b.start_time.slice(0,5)}</span></span>:!past&&<span className="day-add"><Plus size={15}/></span>}{pending&&!b&&<span className="pending-day-label">Awaiting band</span>}{isToday&&<span className="today-underline"/>}</button>;
       })}</div>
     <div className="calendar-foot"><div className="legend">{bands.map(b=><span className="legend-item" key={b.id}><span className="band-dot" style={{background:b.colour}}/>{b.name}</span>)}</div></div>
     </section>
    </>}
    </main>
   {chosen&&<BookingDialog key={chosen+String(selectedBooking?.id)+String(selectedRequest?.id)} date={chosen} booking={selectedBooking} proposal={selectedRequest} votes={practiceVotes} myId={profile.id} band={selectedBand||ownBands[0]||null} memberBands={ownBands} admin={admin} onClose={()=>setChosen(null)} onSaved={saved}/>}
   {showNotifications&&<NotificationPanel notices={notices} userId={profile.id} requests={ownPendingRequests} votes={practiceVotes} isAdmin={admin} onClose={()=>setShowNotifications(false)} onRefresh={()=>void refresh()} onMessage={setMessage}/>}
 </div>;
}
