"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const API=(process.env.NEXT_PUBLIC_NEWS_API_URL??"http://127.0.0.1:8787").replace(/\/$/,"");
const TOPICS=[
  {id:"ai",label:"AI"}, {id:"technology",label:"Công nghệ"}, {id:"business",label:"Kinh tế"},
  {id:"science",label:"Khoa học"}, {id:"education",label:"Giáo dục"},
  {id:"sports",label:"Thể thao"}, {id:"general",label:"Tin tổng hợp"},
] as const;
type Topic=typeof TOPICS[number]["id"];
type Prefs={
  daily:boolean;weekly:boolean;topicsEnabled:boolean;topics:Topic[];
  quietStart:string;quietEnd:string;timeZone:string;
};
const KEY="news-radar:push-prefs:v1";
const defaultPreferences:Prefs={
  daily:true,weekly:true,topicsEnabled:false,topics:[],
  quietStart:"22:00",quietEnd:"07:00",timeZone:"Asia/Ho_Chi_Minh",
};
function urlBase64ToBytes(text:string):Uint8Array{
  const base64=text.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-text.length%4)%4);
  return Uint8Array.from(atob(base64),char=>char.charCodeAt(0));
}
async function postSubscription(path:string,subscription:PushSubscription,preferences?:Prefs){
  const response=await fetch(API+path,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({subscription:subscription.toJSON(),preferences}),
  });
  const body=await response.json().catch(()=>({error:"Không nhận được phản hồi hợp lệ."}));
  if(!response.ok)throw new Error(typeof body.error==="string"?body.error:"Worker HTTP "+response.status);
  return body;
}
export default function NotificationSettings(){
  const [supported,setSupported]=useState(false);
  const [serverEnabled,setServerEnabled]=useState(false);
  const [publicKey,setPublicKey]=useState("");
  const [subscribed,setSubscribed]=useState(false);
  const [permission,setPermission]=useState("default");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [prefs,setPrefs]=useState<Prefs>(defaultPreferences);

  useEffect(()=>{
    let active=true;
    const browserSupport="serviceWorker" in navigator && "PushManager" in window &&
      "Notification" in window && window.isSecureContext;
    setSupported(browserSupport);
    if("Notification" in window)setPermission(Notification.permission);
    try{
      const saved=localStorage.getItem(KEY);
      const localTimeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
      const previous=saved?JSON.parse(saved) as Partial<Prefs>:null;
      const valid=previous && typeof previous==="object" ? previous : {};
      const ids=new Set<string>(TOPICS.map(item=>item.id));
      const time=(value:unknown,fallback:string)=>
        typeof value==="string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)?value:fallback;
      setPrefs({
        daily:typeof valid.daily==="boolean"?valid.daily:true,
        weekly:typeof valid.weekly==="boolean"?valid.weekly:true,
        topicsEnabled:valid.topicsEnabled===true,
        topics:Array.isArray(valid.topics)?valid.topics.filter((item):item is Topic=>
          typeof item==="string"&&ids.has(item)) : [],
        quietStart:time(valid.quietStart,"22:00"),
        quietEnd:time(valid.quietEnd,"07:00"),
        timeZone:localTimeZone||defaultPreferences.timeZone,
      });
    }catch{}
    (async()=>{
      try{
        const response=await fetch(API+"/api/push/config",{cache:"no-store"});
        if(!response.ok)throw new Error("Worker HTTP "+response.status);
        const result:{enabled:boolean;publicKey:string|null}=await response.json();
        if(!active)return;
        setServerEnabled(result.enabled);setPublicKey(result.publicKey??"");
        if(browserSupport){
          const reg=await navigator.serviceWorker.ready;
          const existing=await reg.pushManager.getSubscription();
          if(active)setSubscribed(!!existing);
        }
      }catch{if(active)setStatus("Chưa kết nối được Worker. Hãy thử lại sau.");}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[]);

  function update(next:Prefs){
    setPrefs(next);
    try{localStorage.setItem(KEY,JSON.stringify(next));}catch{}
  }
  async function subscribe(){
    if(!supported||!serverEnabled||!publicKey)return;
    setBusy(true);setStatus("");
    try{
      // Permission prompt happens only in direct response to the button click.
      const granted=await Notification.requestPermission();
      setPermission(granted);
      if(granted!=="granted"){setStatus("Bạn chưa cấp quyền thông báo.");return;}
      const registration=await navigator.serviceWorker.ready;
      let existing=await registration.pushManager.getSubscription();
      const wasExisting=!!existing;
      if(!existing){
        const bytes=urlBase64ToBytes(publicKey);
        existing=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes as BufferSource});
      }
      try{await postSubscription("/api/push/subscribe",existing,prefs);}
      catch(error){if(!wasExisting)await existing.unsubscribe();throw error;}
      setSubscribed(true);
      setStatus("Đã đăng ký. Thông báo sẽ chỉ được gửi khi số báo phù hợp được xuất bản.");
    }catch(error){setStatus(error instanceof Error?error.message:"Không đăng ký được thông báo.");}
    finally{setBusy(false);}
  }
  async function save(){
    setBusy(true);setStatus("");
    try{
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.getSubscription();
      if(!subscription)throw new Error("Thiết bị chưa đăng ký Web Push.");
      await postSubscription("/api/push/subscribe",subscription,prefs);
      setStatus("Đã lưu tùy chọn nhận thông báo.");
    }catch(error){setStatus(error instanceof Error?error.message:"Không thể lưu cài đặt.");}
    finally{setBusy(false);}
  }
  async function unsubscribe(){
    setBusy(true);setStatus("");
    try{
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.getSubscription();
      if(subscription){
        await postSubscription("/api/push/unsubscribe",subscription);
        await subscription.unsubscribe();
      }
      setSubscribed(false);setStatus("Đã tắt thông báo cho thiết bị này.");
    }catch(error){setStatus(error instanceof Error?error.message:"Không thể hủy đăng ký.");}
    finally{setBusy(false);}
  }
  return <main className="nr-notifications-shell">
    <nav className="nr-reader-top"><Link href="/">← Trang tin</Link><strong>NEWS RADAR · ALERTS</strong><Link href="/library/">Tủ báo cá nhân ↗</Link></nav>
    <header className="nr-notifications-heading"><span className="nr-reader-eyebrow">NEWS RADAR / THÔNG BÁO THÔNG MINH</span>
      <h1>Tin đến đúng lúc</h1>
      <p>Đăng ký tự nguyện để biết khi báo ngày hoặc tạp chí tuần đã phát hành. Tùy chọn chỉ lưu cho thiết bị này. Không gửi tin nóng liên tục.</p>
    </header>
    <section className="nr-notifications-card">
      <h2>Trạng thái thiết bị</h2>
      <p>{loading?"Đang kiểm tra Web Push…":!supported?"Trình duyệt chưa hỗ trợ Web Push hoặc ứng dụng chưa chạy qua HTTPS. Trên iPhone, hãy thêm News Radar vào Màn hình chính trước.":!serverEnabled?"Worker chưa có VAPID keys — thông báo hiện chưa kích hoạt.":subscribed?"✓ Thiết bị đã đăng ký nhận thông báo.":"Thiết bị chưa đăng ký."}</p>
      <p className="nr-notifications-detail">Quyền trình duyệt: {permission==="granted"?"Đã cấp":permission==="denied"?"Đã từ chối":"Chưa quyết định"} · {prefs.timeZone}</p>
    </section>
    <section className="nr-notifications-card">
      <h2>Loại thông báo</h2>
      <label><input type="checkbox" checked={prefs.daily} onChange={e=>update({...prefs,daily:e.target.checked})}/> Báo giấy hằng ngày — chỉ sau khi số mới xuất bản</label>
      <label><input type="checkbox" checked={prefs.weekly} onChange={e=>update({...prefs,weekly:e.target.checked})}/> Tạp chí tổng kết tuần — khi tập mới sẵn sàng</label>
      <label><input type="checkbox" checked={prefs.topicsEnabled} onChange={e=>update({...prefs,topicsEnabled:e.target.checked})}/> Một tin theo chủ đề mỗi ngày (nếu có)</label>
      <div className="nr-notifications-topics">{TOPICS.map(topic=><label key={topic.id}><input type="checkbox" disabled={!prefs.topicsEnabled}
        checked={prefs.topics.includes(topic.id)}
        onChange={e=>update({...prefs,topics:e.target.checked?[...prefs.topics,topic.id]:prefs.topics.filter(x=>x!==topic.id)})}/>{topic.label}</label>)}</div>
    </section>
    <section className="nr-notifications-card">
      <h2>Giờ không làm phiền</h2>
      <p className="nr-notifications-detail">Không gửi push trong khung giờ đã chọn. Nếu đến giờ yên lặng, thông báo có thể được gửi sau đó, khi kỳ báo còn mới.</p>
      <div className="nr-notifications-hours">
        <label>Từ <input type="time" value={prefs.quietStart} onChange={e=>update({...prefs,quietStart:e.target.value})}/></label>
        <label>Đến <input type="time" value={prefs.quietEnd} onChange={e=>update({...prefs,quietEnd:e.target.value})}/></label>
      </div>
    </section>
    <section className="nr-notifications-actions">
      {!subscribed?<button type="button" disabled={busy||loading||!supported||!serverEnabled}
        onClick={()=>void subscribe()}>Bật nhận thông báo</button>:
        <><button type="button" disabled={busy||!serverEnabled} onClick={()=>void save()}>Lưu cài đặt</button>
          <button className="nr-alerts-danger" type="button" disabled={busy} onClick={()=>void unsubscribe()}>Tắt nhận thông báo</button></>}
      <p role="status">{status}</p>
    </section>
    <p className="nr-notifications-footnote">Web Push cần sự đồng ý của bạn. iPhone hỗ trợ khi News Radar được thêm vào Màn hình chính và dùng phiên bản iOS hỗ trợ Web Push. Mỗi trình duyệt cần đăng ký riêng. Dữ liệu đăng ký được lưu trên Cloudflare D1 và xóa khi bạn hủy đăng ký.</p>
  </main>;
}
