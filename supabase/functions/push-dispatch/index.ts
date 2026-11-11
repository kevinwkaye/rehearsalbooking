import {createClient} from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

// Database webhook: notifications INSERT, custom x-bunkface-secret header.
// The record is always re-read from the trusted database. The caller cannot specify notification text.
Deno.serve(async request=>{
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const secret=Deno.env.get('PUSH_DISPATCH_SECRET');
 if(!secret||request.headers.get('x-bunkface-secret')!==secret)return new Response('Forbidden',{status:403});
 try{
  const payload=await request.json();
  if(payload?.type!=='INSERT'||payload?.schema!=='public'||payload?.table!=='notifications'||typeof payload?.record?.id!=='string')return new Response('Ignored',{status:200});
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:n,error:noticeError}=await supabase.from('notifications').select('*').eq('id',payload.record.id).single();
  if(noticeError||!n)return new Response('Not found',{status:404});
  if(n.push_sent_at)return new Response('Already processed',{status:200});
  const publicKey=Deno.env.get('VAPID_PUBLIC_KEY');const privateKey=Deno.env.get('VAPID_PRIVATE_KEY');
  if(!publicKey||!privateKey)return new Response('VAPID not configured',{status:503});
  webpush.setVapidDetails(Deno.env.get('VAPID_CONTACT')||'mailto:bunkface_booking_boutique@proton.me',publicKey,privateKey);
  const {data:subscriptions,error:subError}=await supabase.from('push_subscriptions').select('id,subscription').eq('user_id',n.recipient_user_id);
  if(subError)throw subError;
  const body=JSON.stringify({title:n.title,body:n.body,tag:n.id});
  let failures=0;
  for(const sub of subscriptions||[]){
    try{await webpush.sendNotification(sub.subscription,body,{TTL:86400});}
    catch(err){const status=(err as {statusCode?:number}).statusCode;
      if(status===404||status===410){await supabase.from('push_subscriptions').delete().eq('id',sub.id);}
      else{failures++;console.error('Push failed',status||err);}
    }
  }
  if(failures>0)return new Response(JSON.stringify({failed:failures}),{status:503});
  await supabase.from('notifications').update({push_sent_at:new Date().toISOString()}).eq('id',n.id).is('push_sent_at',null);
  return new Response(JSON.stringify({ok:true,devices:subscriptions?.length||0}),{headers:{'Content-Type':'application/json'}});
 }catch(e){console.error('Push dispatch failed',e);return new Response('Push dispatch failed',{status:500});}
});
