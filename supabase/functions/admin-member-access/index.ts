import {createClient} from 'npm:@supabase/supabase-js@2';

Deno.serve(async (request)=>{
 const allowedOrigin=Deno.env.get('APP_ORIGIN')||'https://bunkface-booking-boutique.pages.dev';
 const origin=request.headers.get('origin')||'';
 const originAllowed=!origin||origin===allowedOrigin||origin==='http://localhost:5173'||/^https:\/\/[a-z0-9-]+\.pages\.dev$/.test(origin);
 const headers={
   'Access-Control-Allow-Origin':originAllowed&&origin?origin:allowedOrigin,
   'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
   'Access-Control-Allow-Methods':'POST, OPTIONS',
   'Content-Type':'application/json','Vary':'Origin',
 };
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{headers,status});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 if(!originAllowed)return reply({error:'Origin not allowed'},403);
 try{
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!token)return reply({error:'Sign in required'},401);
  const url=Deno.env.get('SUPABASE_URL')!;
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user)return reply({error:'Invalid session'},401);
  const {data:actor,error:actorError}=await admin.from('profiles').select('id').eq('id',user.id).eq('role','admin').eq('status','approved').maybeSingle();
  if(actorError||!actor)return reply({error:'Administrator only'},403);
  const data=await request.json();
  if(data?.action==='delete_member'){
    const id=typeof data.user_id==='string'?data.user_id:'';
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)||id===user.id)return reply({error:'Cannot delete this account'},400);
    const {data:member}=await admin.from('profiles').select('id,role,contact_name').eq('id',id).maybeSingle();
    if(!member||member.role!=='band')return reply({error:'Member not found'},404);
    // A delete removes access immediately at the profile layer; the Auth delete
    // cascades profiles, notifications and subscriptions, while retaining bookings.
    const {error:deleteError}=await admin.auth.admin.deleteUser(id);
    if(deleteError)throw deleteError;
    await admin.from('audit_events').insert({actor_id:user.id,action:'member.deleted',details:{user_id:id,contact_name:member.contact_name}});
    return reply({ok:true});
  }
  if(data?.action!=='reset_password')return reply({error:'Unknown action'},400);
  const id=typeof data.user_id==='string'?data.user_id:'';
  const password=typeof data.password==='string'?data.password:'';
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)||password.length<10||password.length>128)return reply({error:'Invalid member or password'},400);
  const {data:member}=await admin.from('profiles').select('id').eq('id',id).eq('role','band').maybeSingle();
  if(!member)return reply({error:'Member not found'},404);
  const {error:updateError}=await admin.auth.admin.updateUserById(id,{password});
  if(updateError)throw updateError;
  const {error:flagError}=await admin.from('profiles').update({must_change_password:true,password_reset_at:new Date().toISOString()}).eq('id',id);
  if(flagError)throw flagError;
  await admin.from('audit_events').insert({actor_id:user.id,action:'member.password_reset',details:{user_id:id}});
  return reply({ok:true});
 }catch(err){console.error('Member access operation failed',err);return reply({error:'Could not reset the member password'},500);}
});
