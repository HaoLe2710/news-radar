import { latestEdition } from "./editions";
import { latestWeeklyMagazine } from "./weekly-magazines";
import {
  base64UrlToBytes, bytesToBase64Url, safePushEndpoint, sendWebPush,
  validPushSubscription, type NotificationData, type PushSubscriptionData,
} from "./web-push";

export type PushEnv = {
  DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};
export const PUSH_TOPICS = ["ai","technology","business","science","education","sports","general"] as const;
export type PushTopic = typeof PUSH_TOPICS[number];
export type PushPreferences = {
  daily: boolean;
  weekly: boolean;
  topicsEnabled: boolean;
  topics: PushTopic[];
  quietStart: string;
  quietEnd: string;
  timeZone: string;
};
export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  daily:true, weekly:true, topicsEnabled:false, topics:[],
  quietStart:"22:00", quietEnd:"07:00", timeZone:"Asia/Ho_Chi_Minh",
};
type Subscriber = {
  id:string; endpoint:string; p256dh:string; auth:string;
  preferences_json:string; created_at:string;
};
const CORS_ORIGINS = new Set(["https://news-radar-9px.pages.dev","http://localhost:3000","http://127.0.0.1:3000"]);

export function normalizePushPreferences(raw:unknown):PushPreferences {
  if(!raw || typeof raw!=="object")return {...DEFAULT_PUSH_PREFERENCES};
  const val=raw as Record<string,unknown>;
  const time=(value:unknown,defaultTime:string)=>{
    return typeof value==="string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : defaultTime;
  };
  const timeZone=typeof val.timeZone==="string" && val.timeZone.length<=64 ? val.timeZone : "Asia/Ho_Chi_Minh";
  let safeZone="Asia/Ho_Chi_Minh";
  try { new Intl.DateTimeFormat("en-US",{timeZone}).format(new Date());safeZone=timeZone; } catch{}
  return {
    daily:typeof val.daily==="boolean" ? val.daily : true,
    weekly:typeof val.weekly==="boolean" ? val.weekly : true,
    topicsEnabled:val.topicsEnabled===true,
    topics:Array.isArray(val.topics) ? [...new Set(val.topics.filter((topic):topic is PushTopic=>
      typeof topic==="string" && PUSH_TOPICS.includes(topic as PushTopic)))].slice(0,7) : [],
    quietStart:time(val.quietStart,DEFAULT_PUSH_PREFERENCES.quietStart),
    quietEnd:time(val.quietEnd,DEFAULT_PUSH_PREFERENCES.quietEnd),
    timeZone:safeZone,
  };
}
export function isQuietNow(settings:PushPreferences,now=new Date()):boolean {
  const hour=new Intl.DateTimeFormat("en-GB", {
    timeZone:settings.timeZone,hour:"2-digit",minute:"2-digit",hourCycle:"h23",
  }).format(now);
  const current=Number(hour.slice(0,2))*60+Number(hour.slice(3,5));
  const parse=(clock:string)=>Number(clock.slice(0,2))*60+Number(clock.slice(3,5));
  const start=parse(settings.quietStart),end=parse(settings.quietEnd);
  if(start===end)return false; // Equal endpoints mean no quiet window.
  return start<end ? current>=start && current<end : current>=start || current<end;
}
export function configuredForPush(env:PushEnv):boolean {
  try {
    return typeof env.VAPID_PUBLIC_KEY==="string" && typeof env.VAPID_PRIVATE_KEY==="string" &&
      base64UrlToBytes(env.VAPID_PUBLIC_KEY).length===65 &&
      base64UrlToBytes(env.VAPID_PRIVATE_KEY).length===32;
  }catch{return false;}
}
function corsHeaders(origin:string|null): Headers {
  const headers=new Headers({
    "Cache-Control":"no-store","Content-Type":"application/json;charset=utf-8",
    "Vary":"Origin","Access-Control-Allow-Headers":"Content-Type",
    "Access-Control-Allow-Methods":"GET,POST,DELETE,OPTIONS",
  });
  if(origin && CORS_ORIGINS.has(origin)) headers.set("Access-Control-Allow-Origin",origin);
  return headers;
}
function response(data:unknown,code:number,origin:string|null):Response {
  return new Response(JSON.stringify(data),{status:code,headers:corsHeaders(origin)});
}
async function readJson(request:Request):Promise<unknown>{
  const length=Number(request.headers.get("content-length")??0);
  if(length>8192 || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))throw Error("Invalid JSON content type or size");
  const body=await request.text();
  if(body.length>8192)throw Error("Body too large");
  return JSON.parse(body);
}
async function subscriberId(endpoint:string):Promise<string>{
  const bytes=new TextEncoder().encode(endpoint);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return bytesToBase64Url(new Uint8Array(digest));
}
async function enforceRegistrationLimit(request:Request,env:PushEnv):Promise<boolean>{
  const ip=request.headers.get("cf-connecting-ip")??"unknown";
  const secret=env.VAPID_PRIVATE_KEY??"";
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip+"|"+secret));
  const key=bytesToBase64Url(new Uint8Array(hash));
  const day=new Date().toISOString().slice(0,10);
  const result=await env.DB.prepare(
    "INSERT INTO push_registration_limits(day,ip_hash,count) VALUES(?,?,1) "+
    "ON CONFLICT(day,ip_hash) DO UPDATE SET count=count+1 WHERE count < 20"
  ).bind(day,key).run();
  return (result.meta.changes??0)>0;
}
export async function handlePushApi(request:Request,env:PushEnv):Promise<Response|null>{
  const path=new URL(request.url).pathname;
  if(!path.startsWith("/api/push/"))return null;
  const origin=request.headers.get("origin");
  if(origin && !CORS_ORIGINS.has(origin))return response({error:"Origin not allowed"},403,origin);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders(origin)});
  if(path==="/api/push/config" && request.method==="GET"){
    return response({enabled:configuredForPush(env),publicKey:configuredForPush(env)?env.VAPID_PUBLIC_KEY:null},200,origin);
  }
  if(!["/api/push/subscribe","/api/push/unsubscribe"].includes(path))return response({error:"Not Found"},404,origin);
  if(!origin || !CORS_ORIGINS.has(origin))return response({error:"Browser Origin required"},403,origin);
  if(!configuredForPush(env))return response({error:"Push chưa được cấu hình VAPID trên Worker."},503,origin);
  if((path.endsWith("/subscribe")&&request.method!=="POST")||
     (path.endsWith("/unsubscribe")&&request.method!=="POST"))return response({error:"Method Not Allowed"},405,origin);
  let body:unknown;
  try{body=await readJson(request);}catch{return response({error:"Invalid JSON request"},400,origin);}
  const record=body&&typeof body==="object" ? body as Record<string,unknown> : null;
  const subscription=record?.subscription;
  if(!validPushSubscription(subscription))return response({error:"Invalid Web Push subscription"},400,origin);
  const id=await subscriberId(subscription.endpoint);
  if(path==="/api/push/unsubscribe"){
    const result=await env.DB.prepare("DELETE FROM push_subscriptions WHERE id=? AND auth=?")
      .bind(id,subscription.keys.auth).run();
    if((result.meta.changes??0)>0)await env.DB.prepare("DELETE FROM push_deliveries WHERE subscription_id=?").bind(id).run();
    return response({ok:true},200,origin);
  }
  if(!await enforceRegistrationLimit(request,env))return response({error:"Rate limit exceeded"},429,origin);
  const preferences=normalizePushPreferences(record?.preferences);
  const updatedAt=new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO push_subscriptions(id,endpoint,p256dh,auth,preferences_json,created_at,updated_at,last_checked_at) VALUES(?,?,?,?,?,?,?,'') "+
    "ON CONFLICT(id) DO UPDATE SET endpoint=excluded.endpoint,p256dh=excluded.p256dh,auth=excluded.auth,"+
    "preferences_json=excluded.preferences_json,updated_at=excluded.updated_at"
  ).bind(id,subscription.endpoint,subscription.keys.p256dh,subscription.keys.auth,JSON.stringify(preferences),updatedAt,updatedAt).run();
  return response({ok:true,preferences},200,origin);
}
function interested(topic:PushTopic,category:string,title:string,summary:string|null):boolean {
  if(topic!=="ai")return topic===category;
  return /(?:^|[^\p{L}\p{N}])(?:AI|ChatGPT|OpenAI|trí tuệ nhân tạo|machine learning)(?=$|[^\p{L}\p{N}])/iu.test(title+" "+(summary??""));
}
function isRecent(date:string,days:number,now:Date):boolean {
  const time=Date.parse(date+"T00:00:00+07:00");
  return Number.isFinite(time) && time <= now.getTime()+24*3600000 && now.getTime()-time < days*86400000;
}
type IssueEvent = {kind:"daily"|"weekly"|"topic";key:string;message:NotificationData};
function notificationsForSubscriber(
  daily:Awaited<ReturnType<typeof latestEdition>>,
  weekly:Awaited<ReturnType<typeof latestWeeklyMagazine>>,
  preferences:PushPreferences,now:Date,subscribedAt?:string
):IssueEvent[]{
  const events:IssueEvent[]=[];
  if(daily && isRecent(daily.issueDate,2,now) && (!subscribedAt || Date.parse(daily.createdAt)>=Date.parse(subscribedAt))){
    if(preferences.daily)events.push({
      kind:"daily",key:daily.issueDate,
      message:{title:"News Radar · Báo ngày mới",body:"Số báo "+daily.issueDate+" đã sẵn sàng để đọc.",url:"/edition/?date="+daily.issueDate,tag:"news-radar-daily-"+daily.issueDate},
    });
    if(preferences.topicsEnabled && preferences.topics.length){
      const article=[daily.lead,...daily.secondary].find(item=>preferences.topics.some(topic=>interested(topic,item.category,item.title,item.summary)));
      if(article)events.push({
        kind:"topic",key:daily.issueDate,
        message:{title:"News Radar · Tin bạn quan tâm",body:article.title.slice(0,130),url:"/edition/?date="+daily.issueDate,tag:"news-radar-topic-"+daily.issueDate},
      });
    }
  }
  if(weekly && preferences.weekly && isRecent(weekly.issueDate,9,now) && (!subscribedAt || Date.parse(weekly.createdAt)>=Date.parse(subscribedAt))){
    events.push({
      kind:"weekly",key:weekly.weekStart,
      message:{title:"News Radar Weekly · Tạp chí mới",body:"Tổng kết tuần "+weekly.weekStart+" — "+weekly.weekEnd+" đã được xuất bản.",
        url:"/magazine/?week="+weekly.weekStart,tag:"news-radar-weekly-"+weekly.weekStart},
    });
  }
  return events;
}
async function attemptDelivery(env:PushEnv,subscriber:Subscriber,event:IssueEvent):Promise<void>{
  const created=await env.DB.prepare(
    "INSERT OR IGNORE INTO push_deliveries(subscription_id,issue_kind,issue_key,status,attempts) VALUES(?,?,?,'sending',1)"
  ).bind(subscriber.id,event.kind,event.key).run();
  if(!(created.meta.changes??0)){
    const retried=await env.DB.prepare(
      "UPDATE push_deliveries SET status='sending',attempts=attempts+1,attempted_at=? "+
      "WHERE subscription_id=? AND issue_kind=? AND issue_key=? AND status='failed' AND attempts<2"
    ).bind(new Date().toISOString(),subscriber.id,event.kind,event.key).run();
    if(!(retried.meta.changes??0))return;
  }
  try {
    const status=await sendWebPush(
      {endpoint:subscriber.endpoint,keys:{p256dh:subscriber.p256dh,auth:subscriber.auth}},
      event.message,{publicKey:env.VAPID_PUBLIC_KEY!,privateKey:env.VAPID_PRIVATE_KEY!,
        subject:env.VAPID_SUBJECT??"https://news-radar-9px.pages.dev"},
    );
    if(status===404||status===410){
      await env.DB.prepare("DELETE FROM push_subscriptions WHERE id=?").bind(subscriber.id).run();
      await env.DB.prepare("DELETE FROM push_deliveries WHERE subscription_id=?").bind(subscriber.id).run();
      return;
    }
    await env.DB.prepare("UPDATE push_deliveries SET status=? WHERE subscription_id=? AND issue_kind=? AND issue_key=?")
      .bind(status>=200&&status<300?"delivered":"failed",subscriber.id,event.kind,event.key).run();
    if(status<200||status>=300)console.warn("Push service returned",status,event.kind);
  }catch(error){
    console.warn("Web Push delivery unavailable",error instanceof Error?error.message:String(error));
    await env.DB.prepare("UPDATE push_deliveries SET status='failed' WHERE subscription_id=? AND issue_kind=? AND issue_key=?")
      .bind(subscriber.id,event.kind,event.key).run();
  }
}
export async function deliverPublishedNotifications(env:PushEnv,now=new Date()):Promise<void>{
  if(!configuredForPush(env))return;
  const [daily,weekly]=await Promise.all([latestEdition(env),latestWeeklyMagazine(env)]);
  if(!daily&&!weekly)return;
  const rows=await env.DB.prepare(
    "SELECT id,endpoint,p256dh,auth,preferences_json,created_at FROM push_subscriptions "+
    "ORDER BY last_checked_at ASC LIMIT 12"
  ).all<Subscriber>();
  const subscribers=rows.results??[];
  for(let i=0;i<subscribers.length;i+=3){
    await Promise.all(subscribers.slice(i,i+3).map(async subscriber=>{
      try{
        const preferences=normalizePushPreferences(JSON.parse(subscriber.preferences_json));
        if(!isQuietNow(preferences,now)){
          for(const event of notificationsForSubscriber(daily,weekly,preferences,now,subscriber.created_at))
            await attemptDelivery(env,subscriber,event);
        }
      }catch(error){console.warn("Push subscriber failed",error instanceof Error?error.message:String(error));}
      finally{await env.DB.prepare("UPDATE push_subscriptions SET last_checked_at=? WHERE id=?")
        .bind(new Date().toISOString(),subscriber.id).run();}
    }));
  }
}
export const pushNotificationEvents=notificationsForSubscriber;
