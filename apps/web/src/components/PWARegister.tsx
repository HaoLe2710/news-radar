"use client";
import { useEffect } from "react";
export default function PWARegister(){
  useEffect(()=>{
    if(!("serviceWorker" in navigator) || !window.isSecureContext)return;
    navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(error=>{
      console.warn("News Radar offline shell unavailable", error);
    });
  },[]);
  return null;
}
