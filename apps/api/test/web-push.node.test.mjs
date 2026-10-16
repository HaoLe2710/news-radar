import test from "node:test";
import assert from "node:assert/strict";
import {
  base64UrlToBytes,bytesToBase64Url,safePushEndpoint,validPushSubscription,
  createVapidAuthorization,encryptWebPushPayload,
} from "../src/web-push.ts";

const toBytes=val=>new Uint8Array(val);
const utf8=text=>new TextEncoder().encode(text);
function concat(...parts) {
  const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;
  for(const part of parts){result.set(part,offset);offset+=part.length;}
  return result;
}
async function derive(ikm,salt,info,bits){
  const key=await crypto.subtle.importKey("raw",ikm,"HKDF",false,["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({name:"HKDF",hash:"SHA-256",salt,info},key,bits));
}
async function clientKeys(){
  const pair=await crypto.subtle.generateKey({name:"ECDH",namedCurve:"P-256"},true,["deriveBits"]);
  const pub=toBytes(await crypto.subtle.exportKey("raw",pair.publicKey));
  const auth=crypto.getRandomValues(new Uint8Array(16));
  return {pair,pub,auth,sub:{endpoint:"https://fcm.googleapis.com/fcm/send/mock",keys:{
    p256dh:bytesToBase64Url(pub),auth:bytesToBase64Url(auth),
  }}};
}
test("base64url roundtrip preserves binary key material",()=>{
  const original=new Uint8Array([0,1,2,3,250,251,252,253,254,255]);
  assert.deepEqual(base64UrlToBytes(bytesToBase64Url(original)),original);
  assert.throws(()=>base64UrlToBytes("bad+value"));
});
test("push endpoints enforce HTTPS and known browser push services",()=>{
  assert.equal(safePushEndpoint("https://fcm.googleapis.com/fcm/send/test"),true);
  assert.equal(safePushEndpoint("https://updates.push.services.mozilla.com/wpush/test"),true);
  assert.equal(safePushEndpoint("https://web.push.apple.com/abc"),true);
  assert.equal(safePushEndpoint("https://push.notify.windows.com/?token=x"),true);
  for(const value of ["http://fcm.googleapis.com/test","https://evil.test/","https://localhost/","https://fcm.googleapis.com.evil.test/test","https://user@fcm.googleapis.com/test"]){
    assert.equal(safePushEndpoint(value),false,value);
  }
});
test("subscription requires browser ECDH and authentication keys",async()=>{
  const {sub}=await clientKeys();
  assert.equal(validPushSubscription(sub),true);
  assert.equal(validPushSubscription({...sub,keys:{...sub.keys,p256dh:"broken"}}),false);
  assert.equal(validPushSubscription({...sub,endpoint:"https://127.0.0.1:443/"}),false);
});
test("VAPID JWT signs with ES256 and binds audience to browser push origin",async()=>{
  const pair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
  const publicKey=toBytes(await crypto.subtle.exportKey("raw",pair.publicKey));
  const privateJwk=await crypto.subtle.exportKey("jwk",pair.privateKey);
  const publicB64=bytesToBase64Url(publicKey);
  const value=await createVapidAuthorization("https://fcm.googleapis.com/fcm/send/x",{
    publicKey:publicB64,privateKey:privateJwk.d,subject:"https://news-radar-9px.pages.dev",
  });
  assert.match(value,/^vapid t=[A-Za-z0-9_.-]+, k=[A-Za-z0-9_-]+$/);
  const token=value.slice("vapid t=".length).split(", k=")[0];
  const [header,payload,signature]=token.split(".");
  const decoded=JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
  assert.equal(decoded.aud,"https://fcm.googleapis.com");
  assert.equal(decoded.sub,"https://news-radar-9px.pages.dev");
  const isValid=await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},pair.publicKey,base64UrlToBytes(signature),utf8(header+"."+payload));
  assert.equal(isValid,true);
});
test("aes128gcm encrypted payload decrypts with the recipient keys (RFC 8291)",async()=>{
  const {pair,pub,auth,sub}=await clientKeys();
  const notification={title:"News Radar",body:"Số báo ngày 17/10",url:"/edition/?date=2026-10-17",tag:"daily-2026-10-17"};
  const packet=await encryptWebPushPayload(sub,notification);
  assert.deepEqual(Array.from(packet.slice(16,21)),[0,0,16,0,65]);
  const salt=packet.slice(0,16);
  const senderPubBytes=packet.slice(21,86);
  const senderPub=await crypto.subtle.importKey("raw",senderPubBytes,{name:"ECDH",namedCurve:"P-256"},false,[]);
  const secret=toBytes(await crypto.subtle.deriveBits({name:"ECDH",public:senderPub},pair.privateKey,256));
  const ikm=await derive(secret,auth,concat(utf8("WebPush: info"),new Uint8Array([0]),pub,senderPubBytes),256);
  const keyBytes=await derive(ikm,salt,utf8("Content-Encoding: aes128gcm\0"),128);
  const nonce=await derive(ikm,salt,utf8("Content-Encoding: nonce\0"),96);
  const aesKey=await crypto.subtle.importKey("raw",keyBytes,"AES-GCM",false,["decrypt"]);
  const plaintext=toBytes(await crypto.subtle.decrypt({name:"AES-GCM",iv:nonce,tagLength:128},aesKey,packet.slice(86)));
  assert.equal(plaintext.at(-1),2);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(plaintext.slice(0,-1))),notification);
});
