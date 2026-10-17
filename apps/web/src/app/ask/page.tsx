"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import "./ask.css";

const API=(process.env.NEXT_PUBLIC_NEWS_API_URL??"http://127.0.0.1:8787").replace(/\/$/,"");
const HISTORY_KEY="news-radar:ask:v1";
const PERIODS=[
  {value:"all",label:"Tự nhận biết thời gian"},
  {value:"today",label:"Hôm nay"},{value:"yesterday",label:"Hôm qua"},
  {value:"this_week",label:"Tuần này"},{value:"last_week",label:"Tuần trước"},
];
const CATEGORIES=[
  {value:"all",label:"Tất cả chuyên mục"},
  {value:"technology",label:"Công nghệ"},{value:"science",label:"Khoa học"},
  {value:"business",label:"Kinh tế"},{value:"general",label:"Thời sự"},
  {value:"education",label:"Giáo dục"},{value:"sports",label:"Thể thao"},
];
type Citation={id:string;title:string;summary:string;url:string;publisher:string;date:string;
  category:string;editionUrl:string;kind:"daily"|"weekly"};
type Reply={answer:string;citations:Citation[];followUps:string[];mode:"ai"|"sources_only"|"no_evidence";
  scope:string;limitations?:string};
type Thread={id:string;question:string;createdAt:string;data:Reply};
const EXAMPLES=[
  "Tuần này có tin công nghệ gì đáng chú ý?",
  "Tóm tắt những tin kinh tế tuần trước",
  "Hôm qua có diễn biến gì về trí tuệ nhân tạo?",
  "Các nhà khoa học công bố những nghiên cứu gì?",
];
function savedHistory():Thread[]{
  try{
    const raw=JSON.parse(localStorage.getItem(HISTORY_KEY)??"[]");
    if(!Array.isArray(raw))return [];
    return raw.filter(x=>x&&typeof x.question==="string"&&x.data&&Array.isArray(x.data.citations)).slice(0,10);
  }catch{return [];}
}
export default function AskNewsRadar(){
  const [question,setQuestion]=useState("");
  const [period,setPeriod]=useState("all");
  const [category,setCategory]=useState("all");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [showDates,setShowDates]=useState(false);
  const [history,setHistory]=useState<Thread[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [online,setOnline]=useState(true);
  const bottom=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    setHistory(savedHistory());
    setOnline(navigator.onLine);
    const changed=()=>setOnline(navigator.onLine);
    window.addEventListener("online",changed);window.addEventListener("offline",changed);
    return()=>{window.removeEventListener("online",changed);window.removeEventListener("offline",changed);};
  },[]);
  function persist(next:Thread[]){
    const bounded=next.slice(-10);
    setHistory(bounded);
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify(bounded));}catch{/* private browsing */}
  }
  function clear(){
    setHistory([]);try{localStorage.removeItem(HISTORY_KEY);}catch{}
  }
  async function submit(e?:FormEvent<HTMLFormElement>,override?:string){
    e?.preventDefault();
    const text=(override??question).trim();
    if(busy||!online||text.length<8||text.length>350)return;
    if(from&&to&&from>to){setError("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");return;}
    setError("");setBusy(true);setQuestion(text);
    try{
      const response=await fetch(API+"/api/ask",{method:"POST",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({question:text,filters:{period,category,from:from||null,to:to||null}}),
        signal:AbortSignal.timeout(35000),
      });
      const payload=await response.json().catch(()=>({error:"Phản hồi không hợp lệ."}));
      if(!response.ok)throw new Error(typeof payload.error==="string"?payload.error:"API HTTP "+response.status);
      const data=payload.data as Reply;
      if(typeof data?.answer!=="string"||!Array.isArray(data.citations))throw new Error("Phản hồi thiếu bằng chứng.");
      persist([...history,{id:Date.now().toString(36),question:text,createdAt:new Date().toISOString(),data}]);
      setQuestion("");
      setTimeout(()=>bottom.current?.scrollIntoView({behavior:"smooth",block:"end"}),80);
    }catch(err){
      setError(err instanceof Error&&err.name==="TimeoutError"?"AI trả lời quá lâu. Bạn hãy thử lại sau.":
        err instanceof Error?err.message:"Không gửi được câu hỏi. Hãy kiểm tra kết nối.");
    }finally{setBusy(false);}
  }
  return <main className="nr-ask-shell">
    <nav className="nr-ask-nav" aria-label="Điều hướng Ask News Radar">
      <Link href="/">← Trang tin</Link>
      <strong>NEWS RADAR / RESEARCH DESK</strong>
      <Link href="/edition/archive/">Kho số báo ↗</Link>
    </nav>
    <header className="nr-ask-heading">
      <span className="nr-ask-eyebrow">ASK NEWS RADAR / AI NEWS RESEARCH</span>
      <h1>Hỏi tờ báo.</h1>
      <p>Khám phá những gì đã xảy ra dựa trên các ấn bản và nguồn RSS thực tế. Mỗi câu trả lời đều có đường dẫn kiểm chứng.</p>
      <div className="nr-ask-method">Tìm kiếm từ kho số báo đã lưu · Dẫn nguồn thật · Không đọc toàn văn báo gốc</div>
    </header>
    {!online?<div className="nr-ask-offline" role="status">
      <strong>Thiết bị đang offline.</strong> Ask News Radar cần kết nối để tìm kiếm và gọi AI.
      Bạn vẫn có thể <Link href="/library/">đọc các số báo đã lưu trong Tủ báo</Link>.
    </div>:null}
    <section className="nr-ask-intro" aria-label="Gợi ý câu hỏi">
      <div className="nr-ask-section-label"><span>01 / GỢI Ý TÌM HIỂU</span><span>DỮ LIỆU CÓ DẪN NGUỒN</span></div>
      <div className="nr-ask-examples">{EXAMPLES.map(example=>
        <button type="button" key={example} onClick={()=>{setQuestion(example);setError("");}}>{example} <span>↗</span></button>)}</div>
    </section>
    <section aria-label="Bàn hỏi đáp" className="nr-ask-desk">
      <div className="nr-ask-section-label">
        <span>02 / CUỘC TRÒ CHUYỆN</span>
        <button onClick={clear} type="button" disabled={!history.length||busy} className="nr-ask-clear">Xóa lịch sử trên máy</button>
      </div>
      {!history.length?<div className="nr-ask-welcome">
        <span className="nr-ask-sparkle" aria-hidden="true">✦</span>
        <h2>Hôm nay bạn muốn tìm hiểu điều gì?</h2>
        <p>Gửi câu hỏi bên dưới. AI chỉ sử dụng những đoạn mô tả RSS mà News Radar đã lưu, không tự tra cứu Internet.</p>
      </div>:<div className="nr-ask-messages" aria-live="polite">{history.map(item=><article key={item.id} className="nr-ask-exchange">
        <div className="nr-ask-user"><span>BẠN HỎI</span><p>{item.question}</p></div>
        <div className="nr-ask-response">
          <div className="nr-ask-response-top">
            <strong>✦ ASK NEWS RADAR</strong>
            <span>{item.data.mode==="ai"?"AI · Có kiểm chứng nguồn":
              item.data.mode==="sources_only"?"Chỉ hiển thị nguồn":"Chưa tìm thấy dữ liệu"}</span>
          </div>
          <p>{item.data.answer}</p>
          {item.data.citations.length?<div className="nr-ask-sources">
            <h3>NGUỒN ĐƯỢC SỬ DỤNG ({item.data.citations.length})</h3>
            {item.data.citations.map(source=><div className="nr-ask-source" key={source.id}>
              <span>{source.id} · {source.date} · {source.publisher}</span>
              <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>
              <Link href={source.editionUrl}>Xem trong {source.kind==="daily"?"số báo ngày":"tạp chí tuần"} →</Link>
            </div>)}
          </div>:null}
          {item.data.followUps?.length?<div className="nr-ask-followups"><strong>HỎI TIẾP</strong>
            {item.data.followUps.map((follow,i)=><button key={i} onClick={()=>setQuestion(follow)}>{follow} ↗</button>)}
          </div>:null}
          <small>{item.data.limitations??"Cần đối chiếu bài gốc trước khi trích dẫn."}</small>
        </div>
      </article>)}</div>}
      <div ref={bottom}/>
      <form onSubmit={e=>void submit(e)} className="nr-ask-form">
        <label htmlFor="nr-ask-question">ĐẶT CÂU HỎI</label>
        <textarea id="nr-ask-question" rows={3} maxLength={350} required minLength={8}
          placeholder="Ví dụ: Tuần này có những nghiên cứu AI nào đáng chú ý?"
          value={question} onChange={e=>setQuestion(e.target.value)} disabled={busy}/>
        <div className="nr-ask-filters">
          <label>Thời gian
            <select value={period} onChange={e=>setPeriod(e.target.value)} disabled={busy}>
              {PERIODS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
          <label>Chủ đề
            <select value={category} onChange={e=>setCategory(e.target.value)} disabled={busy}>
              {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={()=>setShowDates(!showDates)} className="nr-ask-filter-toggle">{showDates?"Thu gọn":"Chọn ngày cụ thể"} ↗</button>
        </div>
        {showDates?<div className="nr-ask-date-range">
          <label>Từ ngày <input type="date" value={from} onChange={e=>setFrom(e.target.value)} disabled={busy}/></label>
          <label>Đến ngày <input type="date" value={to} onChange={e=>setTo(e.target.value)} disabled={busy}/></label>
          <button type="button" onClick={()=>{setFrom("");setTo("");}}>Xóa bộ lọc ngày</button>
        </div>:null}
        {error?<p role="alert" className="nr-ask-error">{error}</p>:null}
        <div className="nr-ask-send">
          <span>{question.length}/350 ký tự · Tối đa 12 câu hỏi/giờ</span>
          <button type="submit" disabled={busy||!online||question.trim().length<8}>
            {busy?"Đang tra cứu…":"Gửi câu hỏi ↗"}
          </button>
        </div>
      </form>
    </section>
    <footer className="nr-ask-footer">
      <p><strong>Phạm vi tra cứu:</strong> 45 số báo ngày và 10 tạp chí gần nhất. Nếu nguồn không có đủ dữ kiện, AI sẽ không tự suy đoán.</p>
      <p><strong>Quyền riêng tư:</strong> Lịch sử hỏi đáp chỉ lưu trên trình duyệt hiện tại. Nội dung câu hỏi được gửi đến Worker và Workers AI để xử lý, không được lưu trong D1.</p>
      <p>Không sử dụng câu trả lời này để thay thế việc xác minh nội dung nhà xuất bản gốc.</p>
    </footer>
  </main>;
}
