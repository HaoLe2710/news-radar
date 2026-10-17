import test from "node:test";
import assert from "node:assert/strict";
import {
  ascii, terms, isDate, vnToday, detectPeriod, periodRange, snapshotSources,
  retrieveSources, validateAnswer,
} from "../src/ask-retrieval.ts";
import { parseAskRequest, handleAskApi } from "../src/ask-news.ts";
const date="2026-10-16";
const article=(id,title,category="technology")=>({
  id,title,url:"https://example.org/"+id,summary:title+" được tổng hợp từ bản tin chính thức.",
  source:id%2?"Nguồn A":"Nguồn B",category,region:"vn",published_at:date+"T10:00:00Z",
});
const issue=(coverageDate,issueDate,lead,secondary=[])=>({
  payload_json:JSON.stringify({coverageDate,issueDate,lead,secondary,briefs:[],radarPool:[]}),
});
const magazine=(weekStart,weekEnd,stories)=>({
  payload_json:JSON.stringify({weekStart,weekEnd,stories,radarPool:[]}),
});
const news1=article(1,"Hội nghị công nghệ trí tuệ nhân tạo mở rộng tại Việt Nam");
const news2=article(2,"Các nhà khoa học công bố nghiên cứu về năng lượng tái tạo","science");
const news3=article(3,"Thị trường kinh tế cập nhật hoạt động kinh doanh","business");
const raws=snapshotSources([
  issue("2026-10-16","2026-10-17",news1,[news2,news3]),
  issue("2026-10-15","2026-10-16",news1), // original URL duplicated
],[
  magazine("2026-10-12","2026-10-18",[article(4,"Giải bóng đá quốc gia công bố lịch thi đấu","sports")]),
]);
const filters={period:"all",category:"all",from:null,to:null};
test("Vietnam timezone and dates are robust across UTC boundary",()=>{
  assert.equal(vnToday(new Date("2026-10-16T18:00:00Z")),"2026-10-17");
  assert.equal(isDate("2026-02-30"),false);
  assert.equal(isDate("2024-02-29"),true);
  assert.equal(detectPeriod("Tin gì nổi bật tuần trước?"),"last_week");
  assert.equal(detectPeriod("Hôm nay có gì mới?"),"today");
  assert.deepEqual(periodRange(filters,"tuần trước",new Date("2026-10-17T10:00:00Z")),
    {period:"last_week",from:"2026-10-05",to:"2026-10-11"});
});
test("query normalization ignores accents but not evidence requirements",()=>{
  assert.equal(ascii("Trí tuệ NHÂN TẠO"),"tri tue nhan tao");
  assert.ok(terms("Công nghệ đang phát triển").includes("cong"));
  assert.equal(snapshotSources([{payload_json:"not json"}],[]).length,0);
});
test("retrieval reads fixed editions and magazine sources with deduplication",()=>{
  assert.equal(raws.length,4);
  assert.deepEqual(raws.map(x=>x.url),["https://example.org/1","https://example.org/2","https://example.org/3","https://example.org/4"]);
  const result=retrieveSources(raws,"Công nghệ trí tuệ nhân tạo",filters,new Date("2026-10-17T02:00:00Z"));
  assert.ok(result.length>=1);
  assert.equal(result[0].id,"S1");
  assert.equal(result[0].url,news1.url);
  assert.equal(result[0].editionUrl,"/edition/?date=2026-10-17");
  assert.equal(retrieveSources(raws,"bóng đá",{...filters,category:"sports"})[0].editionUrl,"/magazine/?week=2026-10-12");
});
test("date and category restrictions prevent citation outside request",()=>{
  assert.equal(retrieveSources(raws,"kinh tế",{...filters,from:"2026-10-10",to:"2026-10-12"}).length,0);
  const result=retrieveSources(raws,"năng lượng tái tạo",{...filters,category:"science"});
  assert.equal(result.length,1);
  assert.equal(result[0].title,news2.title);
  assert.deepEqual(retrieveSources(raws,"điều không xuất hiện trong bản tin",filters),[]);
});
test("general weekly summary can use actual stored headlines without fabricating",()=>{
  const result=retrieveSources(raws,"Tóm tắt tin tức hôm nay",{...filters,period:"today"},new Date("2026-10-16T10:00:00Z"));
  assert.ok(result.length>0);
  assert.ok(result.every(x=>x.date==="2026-10-16"));
});
test("invalid dates, filters and payloads never pass request parsing",()=>{
  assert.equal(parseAskRequest({question:"short"}),null);
  assert.equal(parseAskRequest({question:"Những tin về công nghệ hôm nay?",filters:{from:"2026-02-30"}}),null);
  assert.equal(parseAskRequest({question:"Những tin về công nghệ hôm nay?",filters:{from:"2026-10-17",to:"2026-10-16"}}),null);
  assert.deepEqual(parseAskRequest({question:"Những tin về công nghệ hôm nay?",filters:{category:"unknown"}})?.filters,filters);
});
test("AI cannot cite fabricated source IDs or invent numeric claims",()=>{
  const evidence=retrieveSources(raws,"Công nghệ trí tuệ nhân tạo",filters);
  assert.ok(evidence.length);
  const good={answer:"Hội nghị công nghệ trí tuệ nhân tạo mở rộng tại Việt Nam được nêu trong nguồn tin chính thức.",
    citations:["S1"],followUps:["Các tin công nghệ tuần trước có gì khác?"]};
  assert.equal(validateAnswer(good,evidence)?.citationIds[0],"S1");
  assert.equal(validateAnswer({...good,citations:["S999"]},evidence),null);
  assert.equal(validateAnswer({...good,answer:"Hội nghị công nghệ trí tuệ nhân tạo có tổng vốn 999 tỷ đồng tại Việt Nam."},evidence),null);
  assert.equal(validateAnswer({...good,answer:"Một tuyên bố không đủ dài"},evidence),null);
});
test("Ask endpoint rejects non-browser submission before touching AI or D1",async()=>{
  const request=new Request("https://api.example.org/api/ask",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({question:"Công nghệ trí tuệ nhân tạo tuần này?"})});
  const response=await handleAskApi(request,{DB:{}});
  assert.equal(response?.status,403);
  const status=await handleAskApi(new Request("https://api.example.org/api/ask/status"),{DB:{}});
  assert.equal(status?.status,200);
  assert.equal((await status?.json())?.status,"ok");
});
