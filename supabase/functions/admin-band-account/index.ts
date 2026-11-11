import {createClient} from 'npm:@supabase/supabase-js@2';

Deno.serve(async request=>{
 const allowedOrigin=Deno.env.get('APP_ORIGIN')||'http://localhost:5173';
 const origin=request.headers.get('origin')||'';
 const headers={
  'Access-Control-Allow-Origin':origin===allowedOrigin?origin:allowedOrigin,
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json','Vary':'Origin',
 };
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{headers,status});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!token)return reply({error:'Sign in required'},401);
  const url=Deno.env.get('SUPABASE_URL')!;
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await db.auth.getUser(token);
  if(authError||!user)return reply({error:'Invalid session'},401);
  const {data:actor,error:actorError}=await db.from('profiles').select('id').eq('id',user.id).eq('role','admin').eq('status','approved').maybeSingle();
  if(actorError||!actor)return reply({error:'Administrator only'},403);
  const input=await request.json();
  if(!input||typeof input!=='object')return reply({error:'Invalid request'},400);
  const password=typeof input.password==='string'?input.password:'';
  if(password.length<10||password.length>128)return reply({error:'Password must be 10 to 128 characters'},400);
  if(input.action==='set_password'){
   const id=typeof input.user_id==='string'?input.user_id:'';
   if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))return reply({error:'Invalid band account'},400);
   const {data:bandAccount}=await db.from('profiles').select('id').eq('id',id).eq('role','band').maybeSingle();
   if(!bandAccount)return reply({error:'Band not found'},404);
   const {error}=await db.auth.admin.updateUserById(id,{password});
   if(error)throw error;
   await db.from('audit_events').insert({actor_id:user.id,action:'band.password_changed',details:{user_id:id}});
   return reply({ok:true});
  }
  if(input.action!=='create')return reply({error:'Unknown action'},400);
  const name=typeof input.name==='string'?input.name.trim():'';
  const count=Number(input.member_count);
  const colour=typeof input.colour==='string'?input.colour:'';
  if(name.length<2||name.length>80||!Number.isInteger(count)||count<1||count>50||!/^#[a-fA-F0-9]{6}$/.test(colour))return reply({error:'Invalid band details'},400);
  const {data:duplicate}=await db.from('bands').select('id').ilike('name',name).maybeSingle();
  if(duplicate)return reply({error:'A band with this name already exists'},409);
  const bandId=crypto.randomUUID();
  const email=`band-${bandId}@accounts.example.com`;
  const {data:created,error:authCreateError}=await db.auth.admin.createUser({
   email,password,email_confirm:true,app_metadata:{band_managed:true},
  });
  if(authCreateError||!created.user)throw authCreateError||new Error('Could not create login');
  const accountId=created.user.id;
  let insertedBand=false;
  try{
   const {error:bandError}=await db.from('bands').insert({id:bandId,name,member_count:count,colour});
   if(bandError)throw bandError;
   insertedBand=true;
   const {error:profileError}=await db.from('profiles').insert({
    id:accountId,band_id:bandId,email,contact_name:name,role:'band',status:'approved',
   });
   if(profileError)throw profileError;
  }catch(error){
   // Clean up partial provisioning and do not leave active orphan accounts.
   if(insertedBand)await db.from('bands').delete().eq('id',bandId);
   await db.auth.admin.deleteUser(accountId);
   throw error;
  }
  await db.from('audit_events').insert({actor_id:user.id,action:'band.created',details:{user_id:accountId,band_id:bandId,name}});
  return reply({ok:true,band_id:bandId});
 }catch(error){
  console.error('Band account operation failed',error);
  const code=(error as {code?:string})?.code;
  if(code==='23505')return reply({error:'That band name is already taken'},409);
  return reply({error:'Could not save band account. Please try again.'},500);
 }
});
