"use client";
import { useEffect, useState } from "react";
import {
  getOfflineIssue, offlineKey, removeOfflineIssue, saveOfflineIssue,
} from "../lib/offline-library";
import type { NewspaperEdition } from "../lib/newspaper-pages";
import type { WeeklyMagazine } from "../lib/weekly-magazine";

type Props = { kind: "daily"; issue: NewspaperEdition } | { kind: "weekly"; issue: WeeklyMagazine };

export default function OfflineIssueButton(props: Props) {
  const date=props.kind==="daily" ? props.issue.issueDate : props.issue.weekStart;
  const key=offlineKey(props.kind,date);
  const [saved,setSaved]=useState(false);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  useEffect(()=>{
    let active=true;
    getOfflineIssue(key).then(item=>{if(active)setSaved(!!item);}).catch(()=>{
      if(active)setStatus("Không thể truy cập bộ nhớ offline.");
    });
    return ()=>{active=false;};
  },[key]);
  async function toggle(){
    setBusy(true);setStatus("");
    try{
      if(saved){await removeOfflineIssue(key);setSaved(false);setStatus("Đã xóa bản offline.");}
      else {
        if(props.kind==="daily")await saveOfflineIssue("daily",props.issue);
        else await saveOfflineIssue("weekly",props.issue);
        setSaved(true);setStatus("Đã lưu nội dung trên thiết bị.");
      }
    }catch(e){setStatus(e instanceof Error?e.message:"Không thể lưu bản offline.");}
    finally{setBusy(false);}
  }
  return <span className="nr-offline-action">
    <button type="button" disabled={busy} onClick={()=>void toggle()}>
      {busy?"Đang lưu…":saved?"✓ Đã lưu · Xóa offline":"↓ Lưu để đọc offline"}
    </button>
    <span role="status" className="nr-offline-status">{status}</span>
  </span>;
}
