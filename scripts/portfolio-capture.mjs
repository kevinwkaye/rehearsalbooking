// Portfolio-only screenshot harness, run in CI on a disposable branch.
// Captures real, public sign-in/guide and renders the actual React calendar/admin
// with intercepted demo-only Supabase responses. Never authenticates to production.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

const BASE='https://88-bunkspace.pages.dev';
const LOCAL='http://127.0.0.1:4173';
const OUT='portfolio/screenshots';
const ID='11111111-1111-4111-8111-111111111111';
const OTHER=[
'22222222-2222-4222-8222-222222222222',
'33333333-3333-4333-8333-333333333333',
'44444444-4444-4444-8444-444444444444'
];
const bands=[
 {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'88 Bunkface',colour:'#A30000',member_count:4,created_at:new Date().toISOString(),archived_at:null},
 {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Claymore',colour:'#D84797',member_count:4,created_at:new Date().toISOString(),archived_at:null},
 {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',name:'Prometheus',colour:'#FF7700',member_count:3,created_at:new Date().toISOString(),archived_at:null},
 {id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',name:'White Violet',colour:'#00AFB5',member_count:4,created_at:new Date().toISOString(),archived_at:null}
];
const profile={
 id:ID,contact_name:'Demo Owner',email:'demo-owner@example.invalid',
 role:'admin',status:'approved',band_id:null,must_change_password:false
};
const profiles=[profile,
 ...OTHER.map((id,i)=>({
 id,contact_name:['Alex (demo)','Sam (demo)','Taylor (demo)'][i],
 email:'demo-member-'+(i+1)+'@example.invalid',role:'band',status:'approved',
 band_id:bands[i%bands.length].id,must_change_password:false
 }))
];
const memberships=OTHER.map((id,i)=>({user_id:id,band_id:bands[i%bands.length].id,created_at:new Date().toISOString()}));
const today=new Date();
const y=today.getUTCFullYear(),m=today.getUTCMonth();
const firstFuture=Math.max(3,today.getUTCDate()+1);
const days=[firstFuture,firstFuture+3,firstFuture+6,firstFuture+9].filter(d=>d<=new Date(Date.UTC(y,m+1,0)).getUTCDate());
const fmt=(d)=>[y,String(m+1).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
const bookings=days.map((day,i)=>({
 id:'abcdefab-'+String(i+1).padStart(4,'0')+'-4def-8abc-abcdefabcdef',
 band_id:bands[i%4].id,
 practice_date:fmt(day),start_time:['18:30:00','19:00:00','20:00:00','18:00:00'][i],
 status:'confirmed',created_by:ID,updated_at:new Date().toISOString(),created_at:new Date().toISOString()
}));
const notices=[{
 id:'55555555-5555-4555-8555-555555555555',
 recipient_user_id:ID,title:'Room booked',
 body:'88 Bunkface rehearsal confirmed.',read_at:null,created_at:new Date().toISOString()
}];
const audits=[{id:'66666666-6666-4666-8666-666666666666',actor_id:ID,action:'booking.confirmed',details:{},created_at:new Date().toISOString()}];
const data={bands,bookings,profiles,notifications:notices,practice_requests:[],practice_confirmations:[],band_memberships:memberships,audit_events:audits};
function base64url(v){return Buffer.from(JSON.stringify(v)).toString('base64url')}
const token=base64url({alg:'HS256',typ:'JWT'})+'.'+base64url({sub:ID,role:'authenticated',aud:'authenticated',exp:4102444800,iat:1700000000,iss:'https://portfolio.supabase.co/auth/v1'})+'.demo-signature';
const session={
 access_token:token,token_type:'bearer',expires_at:4102444800,expires_in:2100000000,
 refresh_token:'portfolio-demo-only',user:{
 id:ID,email:profile.email,aud:'authenticated',
 app_metadata:{provider:'email',providers:['email']},
 user_metadata:{contact_name:profile.contact_name},
 created_at:'2026-11-01T10:00:00.000Z',
 updated_at:'2026-11-01T10:00:00.000Z',
 role:'authenticated'
 }
};

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function localReady(){
 for(let i=0;i<80;i++){
  try {const res=await fetch(LOCAL);if(res.ok)return;}catch{}
  await sleep(250);
 }
 throw new Error('Local portfolio preview server did not start');
}
async function seededContext(browser,viewport){
 const context=await browser.newContext({viewport,deviceScaleFactor:1,serviceWorkers:'block'});
 await context.addInitScript(v=>{
   window.localStorage.setItem('sb-portfolio-auth-token',JSON.stringify(v));
 },session);
 await context.route('https://portfolio.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json','cache-control':'no-store'};
  if(req.method()==='OPTIONS'){return route.fulfill({status:200,headers:cors,body:'{}'});}
  if(url.pathname.startsWith('/rest/v1/')){
   const table=url.pathname.split('/').pop();
   if(table==='profiles' && url.searchParams.has('id')){
    return route.fulfill({status:200,headers:cors,body:JSON.stringify(profile)});
   }
   return route.fulfill({status:200,headers:cors,body:JSON.stringify(data[table]??[])});
  }
  if(url.pathname.includes('/auth/v1/user')){
   return route.fulfill({status:200,headers:cors,body:JSON.stringify(session.user)});
  }
  if(url.pathname.includes('/auth/v1/token')){
   return route.fulfill({status:200,headers:cors,body:JSON.stringify(session)});
  }
  return route.fulfill({status:200,headers:cors,body:'{}'});
 });
 return context;
}
await mkdir(OUT,{recursive:true});
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4173'],{stdio:'inherit',env:process.env});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 await localReady();
 for(const {name,width,height,path,click} of [
  {name:'01-sign-in-desktop.png',width:1440,height:900,path:'/'},
  {name:'02-how-to-desktop.png',width:1440,height:900,path:'/help.html'},
  {name:'03-sign-up-mobile.png',width:390,height:844,path:'/',click:'New here? Create an account'}
 ]){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  const page=await ctx.newPage();
  await page.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:45000});
  if(click) await page.getByText(click,{exact:false}).first().click();
  await sleep(900);
  await page.screenshot({path:OUT+'/'+name,fullPage:true});
  console.log('Captured live public page:',name,'title',await page.title());
  await ctx.close();
 }
 for(const {name,width,height,admin,booking} of [
  {name:'04-calendar-desktop-demo.png',width:1440,height:900},
  {name:'05-calendar-mobile-demo.png',width:390,height:844},
  {name:'06-admin-desktop-demo.png',width:1440,height:900,admin:true},
  {name:'07-admin-mobile-demo.png',width:390,height:844,admin:true},
  {name:'08-booking-mobile-demo.png',width:390,height:844,booking:true}
 ]){
  const ctx=await seededContext(browser,{width,height});
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(LOCAL+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.calendar-grid').waitFor({timeout:15000});
  await sleep(700);
  if(admin){
   if(width<=740) {
    await page.getByRole('button',{name:'Menu'}).click();
    await page.getByRole('button',{name:'Admin',exact:true}).last().click();
   } else {
    await page.getByRole('button',{name:'Admin',exact:true}).first().click();
   }
  }
  if(booking){
   await page.getByRole('button',{name:/Available/}).first().click();
   await page.getByText('Request practice',{exact:false}).first().waitFor();
  }
  await sleep(350);
  await page.screenshot({path:OUT+'/'+name,fullPage:!booking});
  console.log('Captured actual React UI with demo fixtures:',name,'errors',errors.slice(0,3));
  await ctx.close();
 }
}finally{
 await browser.close();
 server.kill('SIGTERM');
}
