import {createClient} from '@supabase/supabase-js';

const url=process.env.SUPABASE_URL;
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password=process.env.ADMIN_PASSWORD;
if(!url||!serviceKey||!email||!password||password.length<12){
 console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters).');
 process.exit(1);
}
const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const {count,error:readError}=await db.from('profiles').select('id',{head:true,count:'exact'}).eq('role','admin');
if(readError)throw readError;
if(count!==0)throw new Error('An administrator already exists. Refusing to create a second.');
const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{admin_bootstrap:true}});
if(error||!data.user)throw error||new Error('Could not create administrator');
const {error:writeError}=await db.from('profiles').insert({id:data.user.id,band_id:null,email,contact_name:'Administrator',role:'admin',status:'approved'});
if(writeError){await db.auth.admin.deleteUser(data.user.id);throw writeError;}
console.log('Administrator created successfully:',email);
