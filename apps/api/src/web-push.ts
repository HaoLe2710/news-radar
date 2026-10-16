/* Self-contained RFC 8291 aes128gcm Web Push + RFC 8292 VAPID using WebCrypto.
   No Node-specific crypto, no external notification provider SDK. */
export type PushSubscriptionData = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};
export type NotificationData = { title: string; body: string; url: string; tag: string };
export type VapidSettings = { publicKey: string; privateKey: string; subject: string };

const textEncoder = new TextEncoder();
export function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url");
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4-value.length%4)%4));
  return Uint8Array.from(raw, ch => ch.charCodeAt(0));
}
export function bytesToBase64Url(data: Uint8Array): string {
  let result="";
  for(let i=0;i<data.length;i+=8192) result+=String.fromCharCode(...data.slice(i,i+8192));
  return btoa(result).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}
function join(...arrays: Uint8Array[]): Uint8Array {
  const result=new Uint8Array(arrays.reduce((n,x)=>n+x.length,0));
  let pos=0;
  for(const array of arrays){result.set(array,pos);pos+=array.length;}
  return result;
}
function utf8(value: string): Uint8Array {return textEncoder.encode(value);}
export function safePushEndpoint(endpoint:string): boolean {
  try {
    const url=new URL(endpoint);
    if(url.protocol!=="https:" || url.port || url.username || url.password || endpoint.length>2048 || !url.pathname.startsWith("/"))return false;
    const host=url.hostname.toLowerCase();
    return [
      "fcm.googleapis.com","updates.push.services.mozilla.com",
      "web.push.apple.com","push.apple.com",
    ].includes(host) || host.endsWith(".notify.windows.com") || host.endsWith(".push.apple.com");
  }catch{return false;}
}
export function validPushSubscription(value: unknown): value is PushSubscriptionData {
  if(!value||typeof value!=="object")return false;
  const item=value as Record<string,unknown>;
  const keys=item.keys;
  if(typeof item.endpoint!=="string" || !safePushEndpoint(item.endpoint) || !keys || typeof keys!=="object")return false;
  const record=keys as Record<string,unknown>;
  if(typeof record.p256dh!=="string" || typeof record.auth!=="string")return false;
  try{
    const p256dh=base64UrlToBytes(record.p256dh),auth=base64UrlToBytes(record.auth);
    return p256dh.length===65 && p256dh[0]===4 && auth.length>=16 && auth.length<=32;
  }catch{return false;}
}
export async function createVapidAuthorization(endpoint:string,keys:VapidSettings):Promise<string>{
  const pub=base64UrlToBytes(keys.publicKey),priv=base64UrlToBytes(keys.privateKey);
  if(pub.length!==65||pub[0]!==4||priv.length!==32)throw new Error("Invalid VAPID keys");
  if(!keys.subject.startsWith("mailto:") && !keys.subject.startsWith("https://"))throw new Error("Invalid VAPID contact");
  const jwk:JsonWebKey={
    kty:"EC",crv:"P-256",
    x:bytesToBase64Url(pub.slice(1,33)),y:bytesToBase64Url(pub.slice(33,65)),
    d:keys.privateKey,ext:false,
  };
  const privateKey=await crypto.subtle.importKey("jwk",jwk,{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
  const header=bytesToBase64Url(utf8(JSON.stringify({typ:"JWT",alg:"ES256"})));
  const payload=bytesToBase64Url(utf8(JSON.stringify({
    aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+12*60*60,sub:keys.subject,
  })));
  const signingInput=header+"."+payload;
  const signature=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},privateKey,utf8(signingInput));
  const jwt=signingInput+"."+bytesToBase64Url(new Uint8Array(signature));
  return "vapid t="+jwt+", k="+keys.publicKey;
}
async function hkdf(ikm:Uint8Array,salt:Uint8Array,info:Uint8Array,bits:number):Promise<Uint8Array>{
  const key=await crypto.subtle.importKey("raw",ikm,"HKDF",false,["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({name:"HKDF",hash:"SHA-256",salt,info},key,bits));
}
export async function encryptWebPushPayload(subscription:PushSubscriptionData,message:NotificationData):Promise<Uint8Array>{
  if(!validPushSubscription(subscription))throw new Error("Invalid PushSubscription");
  const recipientPub=base64UrlToBytes(subscription.keys.p256dh);
  const auth=base64UrlToBytes(subscription.keys.auth);
  const recipientKey=await crypto.subtle.importKey("raw",recipientPub,{name:"ECDH",namedCurve:"P-256"},false,[]);
  const ephemeral=await crypto.subtle.generateKey({name:"ECDH",namedCurve:"P-256"},true,["deriveBits"]);
  const serverPub=new Uint8Array(await crypto.subtle.exportKey("raw",ephemeral.publicKey));
  const secret=new Uint8Array(await crypto.subtle.deriveBits({name:"ECDH",public:recipientKey},ephemeral.privateKey,256));
  const ikm=await hkdf(secret,auth,join(utf8("WebPush: info"),new Uint8Array([0]),recipientPub,serverPub),256);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const cek=await hkdf(ikm,salt,utf8("Content-Encoding: aes128gcm\0"),128);
  const nonce=await hkdf(ikm,salt,utf8("Content-Encoding: nonce\0"),96);
  const plaintext=join(utf8(JSON.stringify(message)),new Uint8Array([2]));
  if(plaintext.length>3993)throw new Error("Push payload too large");
  const key=await crypto.subtle.importKey("raw",cek,"AES-GCM",false,["encrypt"]);
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:nonce,tagLength:128},key,plaintext));
  const recordSize=new Uint8Array([0,0,16,0]); // 4096 octets
  return join(salt,recordSize,new Uint8Array([serverPub.length]),serverPub,encrypted);
}
export async function sendWebPush(subscription:PushSubscriptionData,message:NotificationData,keys:VapidSettings):Promise<number>{
  if(!validPushSubscription(subscription))throw new Error("Unsafe push endpoint or keys");
  const authorization=await createVapidAuthorization(subscription.endpoint,keys);
  const body=await encryptWebPushPayload(subscription,message);
  const response=await fetch(subscription.endpoint,{
    method:"POST",headers:{
      "Authorization":authorization,"TTL":"3600",
      "Content-Encoding":"aes128gcm","Content-Type":"application/octet-stream",
      "Urgency":"normal",
    },body,signal:AbortSignal.timeout(10000),
  });
  return response.status;
}
