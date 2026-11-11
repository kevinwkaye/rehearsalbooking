import {createClient} from 'npm:@supabase/supabase-js@2';

// Never returns a link unless the caller has a valid Auth session and is the sole approved admin.
Deno.serve(async request=>{
 const allowedOrigin=Deno.env.get('APP_ORIGIN')||'http://localhost:5173';
 const origin=request.headers.get('origin')||'';
 const headers={'Access-Control-Allow-Origin':origin===allowedOrigin?origin:allowedOrigin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Vary':'Origin'};
 const reply=(obj:unknown,status=200)=>new Response(JSON.stringify(obj),{status,headers});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const projectUrl=Deno.env.get('SUPABASE_URL')!;
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase=createClient(projectUrl,serviceKey,{auth:{persistSession:false}});
  const bearer=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!bearer)return reply({error:'Sign in required'},401);
  const {data:{user},error:authError}=await supabase.auth.getUser(bearer);
  if(authError||!user)return reply({error:'Invalid session'},401);
  const {data:admin}=await supabase.from('profiles').select('id').eq('id',user.id).eq('role','admin').eq('status','approved').maybeSingle();
  if(!admin)return reply({error:'Administrator only'},403);
  const input=await request.json();
  if(typeof input.user_id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.user_id))return reply({error:'Invalid band account'},400);
  const {data:member}=await supabase.from('profiles').select('email,role').eq('id',input.user_id).single();
  if(!member||member.role!=='band')return reply({error:'Band account not found'},404);
  const {data,error}=await supabase.auth.admin.generateLink({type:'recovery',email:member.email,options:{redirectTo:allowedOrigin}});
  if(error||!data?.properties?.action_link)throw error||new Error('Could not generate recovery link');
  await supabase.from('audit_events').insert({actor_id:user.id,action:'account.recovery_link_generated',details:{user_id:input.user_id}});
  return reply({url:data.properties.action_link});
 }catch(error){console.error('Recovery generation failed',error);return reply({error:'Could not generate recovery link'},500);}
});
