export type AskSource = { id:string; title:string; summary:string; url:string; publisher:string; category:string; date:string; editionUrl:string; kind:"daily"|"weekly" };
export type AskFilters = {period:"all"|"today"|"yesterday"|"this_week"|"last_week"; category:string;from:string|null;to:string|null};
export type SnapshotRow = {payload_json:string};
export const ASK_CATEGORIES=["all","general","technology","science","business","education","sports"] as const;
const STOP=new Set(["tinh","hinh","nhung","thong","bao","mot","cac","qua","theo","trong","duoc","dang","tai","voi","cho","cua","nay","truoc","hom","ngay","tuan","la","ve","gi","nao","hay","biet","toi","ban","sao","the","tin","tuc","tong","hop","noi","bat","diem","chinh","so","sanh","hai","du","lieu","nhat","what","the","about","news","today","this","week","and","latest","please","muon","xem","bai","trinh","bay","nhu","vay","cung","nguon","cap"]);
const SYN:Record<string,string[]>={technology:["cong nghe","tech","digital"],science:["khoa hoc","nghien cuu"],business:["kinh te","tai chinh","thi truong"],sports:["the thao","bong da"],education:["giao duc"],general:["thoi su","xa hoi"]};
export function ascii(text:string){return text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g,"d").toLowerCase();}
export function terms(text:string):string[]{return [...new Set((ascii(text).match(/[\p{L}\p{N}]{2,}/gu)??[]).filter(x=>!STOP.has(x)))].slice(0,25);}
export function isDate(day:unknown):day is string{if(typeof day!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;const d=new Date(day+"T12:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===day;}
function shift(day:string,days:number){const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function vnToday(now=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);}
export function detectPeriod(question:string):AskFilters["period"]{const q=ascii(question);if(/\bhom qua\b/.test(q))return "yesterday";if(/\bhom nay\b/.test(q))return "today";if(/\btuan truoc\b|\btuan vua qua\b/.test(q))return "last_week";if(/\btuan nay\b|\btrong tuan\b/.test(q))return "this_week";return "all";}
export function periodRange(f:AskFilters,question:string,now=new Date()){
  const period=f.period==="all"?detectPeriod(question):f.period,day=vnToday(now);
  const weekday=new Date(day+"T12:00:00Z").getUTCDay(),monday=shift(day,-((weekday+6)%7));
  let from=f.from??"",to=f.to??"";
  if(!from&&!to){if(period==="today")from=to=day;else if(period==="yesterday")from=to=shift(day,-1);
    else if(period==="this_week"){from=monday;to=day;}else if(period==="last_week"){from=shift(monday,-7);to=shift(monday,-1);}}
  return {period,from,to};
}
function goodUrl(value:unknown):value is string{if(typeof value!=="string"||value.length>2048)return false;try{const u=new URL(value);return ["https:","http:"].includes(u.protocol)&&!!u.hostname;}catch{return false;}}
type Article={title?:unknown;summary?:unknown;url?:unknown;source?:unknown;category?:unknown;coverageDate?:unknown};
function fromArticle(a:Article,date:string,kind:AskSource["kind"],editionUrl:string):Omit<AskSource,"id">|null{
  if(!goodUrl(a.url)||typeof a.title!=="string"||!a.title.trim())return null;
  return {title:a.title.trim().slice(0,200),summary:(typeof a.summary==="string"?a.summary:"").replace(/<[^>]*>/g," ").trim().slice(0,350),
    url:a.url,publisher:typeof a.source==="string"?a.source.slice(0,90):"Nhà xuất bản",category:typeof a.category==="string"?a.category:"general",
    date:typeof a.coverageDate==="string"&&isDate(a.coverageDate)?a.coverageDate:date,editionUrl,kind};
}
export function snapshotSources(daily:SnapshotRow[],weekly:SnapshotRow[]):Omit<AskSource,"id">[]{
  const all=new Map<string,Omit<AskSource,"id">>();
  function add(a:Article,date:string,kind:AskSource["kind"],link:string){const x=fromArticle(a,date,kind,link);if(x&&!all.has(x.url))all.set(x.url,x);}
  for(const {payload_json} of daily){try{const e=JSON.parse(payload_json);if(!isDate(e.coverageDate)||!isDate(e.issueDate))continue;
    for(const a of [e.lead,...(Array.isArray(e.secondary)?e.secondary:[]),...(Array.isArray(e.briefs)?e.briefs:[]),...(Array.isArray(e.radarPool)?e.radarPool:[])])if(a)add(a,e.coverageDate,"daily","/edition/?date="+e.issueDate);
  }catch{}}
  for(const {payload_json} of weekly){try{const m=JSON.parse(payload_json);if(!isDate(m.weekStart)||!isDate(m.weekEnd))continue;
    for(const a of [...(Array.isArray(m.stories)?m.stories:[]),...(Array.isArray(m.radarPool)?m.radarPool:[])])if(a)add(a,m.weekEnd,"weekly","/magazine/?week="+m.weekStart);
  }catch{}}
  return [...all.values()];
}
export function retrieveSources(rows:Omit<AskSource,"id">[],question:string,filters:AskFilters,now=new Date(),limit=6):AskSource[]{
  const {from,to}=periodRange(filters,question,now),q=terms(question);
  const category=filters.category==="all"?(Object.entries(SYN).find(([,words])=>words.some(w=>ascii(question).includes(w)))?.[0]??"all"):filters.category;
  if(!q.length&&category==="all")return [];
  const rated=rows.flatMap(article=>{
    if(from&&article.date<from||to&&article.date>to||category!=="all"&&article.category!==category)return [];
    const title=new Set(terms(article.title)),body=new Set(terms(article.summary));let score=0,hits=0;
    for(const term of q){if(title.has(term)){score+=6;hits++;}else if(body.has(term)){score+=2;hits++;}}
    if(!hits&&q.length)return [];if(!hits)score=1;
    return [{article,score,date:article.date}];
  }).sort((a,b)=>b.score-a.score||b.date.localeCompare(a.date));
  const selected:AskSource[]=[],sources=new Map<string,number>();
  for(const x of rated){if(selected.length>=limit)break;if((sources.get(x.article.publisher)??0)>=3)continue;
    sources.set(x.article.publisher,(sources.get(x.article.publisher)??0)+1);
    selected.push({...x.article,id:"S"+(selected.length+1)});}
  return selected;
}
export function evidencePayload(sources:AskSource[]){return sources.map(({id,title,summary,publisher,category,date})=>({id,title,summary,publisher,category,date}));}
export function validateAnswer(raw:unknown,sources:AskSource[]):{answer:string;citationIds:string[];followUps:string[]}|null{
  let value=raw;
  if(typeof raw==="string"){try{const first=raw.indexOf("{"),last=raw.lastIndexOf("}");if(first<0||last<first)return null;value=JSON.parse(raw.slice(first,last+1));}catch{return null;}}
  if(!value||typeof value!=="object")return null;
  const v=value as Record<string,unknown>;
  if(typeof v.answer!=="string"||!Array.isArray(v.citations))return null;
  const answer=v.answer.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  if(answer.length<35||answer.length>1600||/https?:\/\/|ignore previous instructions/i.test(answer))return null;
  const validIds=new Set(sources.map(s=>s.id));
  const citationIds=[...new Set(v.citations.filter((id):id is string=>typeof id==="string"&&validIds.has(id)))];
  if(!citationIds.length)return null;
  const evidence=sources.filter(s=>citationIds.includes(s.id)).map(s=>s.title+" "+s.summary+" "+s.date).join(" ");
  const numbers=(s:string)=>s.match(/\d+(?:[.,]\d+)*/g)??[];
  const allowed=new Set(numbers(evidence));
  if(numbers(answer).some(n=>!allowed.has(n)))return null;
  const words=terms(answer),evidenceWords=new Set(terms(evidence));
  if(words.length&&words.filter(w=>evidenceWords.has(w)).length/words.length<0.12)return null;
  const followUps=Array.isArray(v.followUps)?v.followUps.filter((x):x is string=>typeof x==="string"&&x.length>=12&&x.length<=100).slice(0,3):[];
  return {answer,citationIds,followUps};
}
