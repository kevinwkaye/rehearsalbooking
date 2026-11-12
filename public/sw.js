// Cache only app-shell assets; never cache API data or calendar availability.
const CACHE='88-bunkspace-shell-v3';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/icon.svg','/manifest.webmanifest'])));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('push',event=>{let data={};try{data=event.data?.json()??{};}catch{data={title:'88 Bunkspace',body:'A booking has changed.'};}
const title=String(data.title||'88 Bunkspace'); const body=String(data.body||'A booking has changed.');const target=data.url==='/?admin=approvals'?'/?admin=approvals':'/?notifications=1';
event.waitUntil(self.registration.showNotification(title,{body,icon:'/icon.svg',badge:'/icon.svg',tag:String(data.tag||'bunkface'),data:{url:target}}));});
self.addEventListener('notificationclick',event=>{
 const url=event.notification.data?.url==='/?admin=approvals'?'/?admin=approvals':'/?notifications=1';
 const destination=new URL(url,self.location.origin).href;
 event.waitUntil((async()=>{
  try{
   const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});
   const app=clientsList.find(client=>{try{return new URL(client.url).origin===self.location.origin;}catch{return false;}});
   if(app){try{const navigated=await app.navigate(destination);await (navigated||app).focus();return;}catch{try{await app.focus();app.postMessage({type:url.includes('admin')?'OPEN_APPROVALS':'OPEN_NOTIFICATIONS'});return;}catch{}}}
   const opened=await self.clients.openWindow(destination);
   if(opened)await opened.focus();
  }finally{event.notification.close();}
 })());
});
