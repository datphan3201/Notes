/* Cache the generic application shell and build assets. Private API/media never enter Cache Storage. */
const CACHE="planner-shell-v1";
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("fetch",event=>{
    const request=event.request,url=new URL(request.url);
    if(request.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;
    const shell=request.mode==="navigate"&&["/","/notes"].includes(url.pathname);
    const asset=url.pathname.startsWith("/_next/static/")||url.pathname.startsWith("/themes/");
    if(!shell&&!asset)return;
    event.respondWith((async()=>{
        const cache=await caches.open(CACHE);
        try{
            const response=await fetch(request);
            if(response.ok){await cache.put(request,response.clone());const keys=await cache.keys();if(keys.length>160)await cache.delete(keys[0]);}
            return response;
        }catch(error){const response=await cache.match(request)||(shell?await cache.match("/"):null);if(response)return response;throw error;}
    })());
});
