// Cache only app-shell assets; never cache API data or calendar availability.
const CACHE='bunkface-shell-v2';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/icon.svg','/manifest.webmanifest'])));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('push',event=>{let data={};try{data=event.data?.json()??{};}catch{data={title:'Bunkface',body:'A booking has changed.'};}
const title=String(data.title||'The Bunkface Booking Boutique'); const body=String(data.body||'A booking has changed.');
event.waitUntil(self.registration.showNotification(title,{body,icon:'/icon.svg',badge:'/icon.svg',tag:String(data.tag||'bunkface'),data:{url:'/?notifications=1'}}));});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{const app=clients.find(client=>new URL(client.url).origin===self.location.origin);if(app){return app.navigate('/?notifications=1').then(()=>app.focus());}return self.clients.openWindow('/?notifications=1');}));});
