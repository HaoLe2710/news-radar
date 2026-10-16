/* News Radar Pocket — offline app shell only.
   Never cache cross-origin RSS/API traffic or sensitive requests. */
const VERSION="nr-shell-v15";
const SHELL=["/","/edition/","/magazine/","/library/","/edition/archive/","/magazine/archive/","/manifest.webmanifest","/icon.svg"];
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(VERSION);
    const assets=new Set();
    await Promise.all(SHELL.map(async path=>{
      try{
        const response=await fetch(path,{cache:"reload"});
        if(!response.ok)return;
        await cache.put(path,response.clone());
        if(!response.headers.get("content-type")?.includes("text/html"))return;
        const html=await response.text();
        // Precache linked Next.js build assets needed by static pages.
        for(const match of html.matchAll(/(?:src|href)=["'](\/_next\/static\/[^"']+)["']/g)){
          const asset=match[1].replace(/&amp;/g,"&");
          if(assets.size<160)assets.add(asset);
        }
      }catch(e){console.warn("Cannot pre-cache page",path,e);}
    }));
    await Promise.all([...assets].map(async url=>{
      try{const result=await fetch(url);if(result.ok)await cache.put(url,result);}catch{}
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys())if(name.startsWith("nr-shell-")&&name!==VERSION)await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  const isAsset=url.pathname.startsWith("/_next/static/") ||
    url.pathname==="/manifest.webmanifest" || url.pathname==="/icon.svg" || url.pathname==="/icon-maskable.svg";
  if(isAsset){
    event.respondWith((async()=>{
      const cache=await caches.open(VERSION);
      const cached=await cache.match(req);
      if(cached)return cached;
      const response=await fetch(req);
      if(response.ok)await cache.put(req,response.clone());
      return response;
    })());
    return;
  }
  if(req.mode!=="navigate")return;
  event.respondWith((async()=>{
    const cache=await caches.open(VERSION);
    try {
      const response=await fetch(req);
      if(response.ok)await cache.put(url.pathname,response.clone());
      return response;
    }catch{
      return (await cache.match(url.pathname)) || (await cache.match(url.pathname.endsWith("/")?url.pathname:url.pathname+"/")) ||
        (await cache.match("/")) || new Response("News Radar chưa được tải xuống cho chế độ offline.",{status:503,headers:{"Content-Type":"text/plain;charset=utf-8"}});
    }
  })());
});
