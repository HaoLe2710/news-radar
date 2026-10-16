import { webcrypto } from "node:crypto";

function encode(value) {
  return Buffer.from(value).toString("base64url");
}
const {publicKey,privateKey}=await webcrypto.subtle.generateKey(
  {name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]
);
const raw=await webcrypto.subtle.exportKey("raw",publicKey);
const jwk=await webcrypto.subtle.exportKey("jwk",privateKey);
console.log("New Web Push VAPID key pair (store privately; NEVER commit, paste in chat, or expose private key):");
console.log("VAPID_PUBLIC_KEY="+encode(raw));
console.log("VAPID_PRIVATE_KEY="+jwk.d);
console.log("The optional VAPID_SUBJECT defaults to https://news-radar-9px.pages.dev");
