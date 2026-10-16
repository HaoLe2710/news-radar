import test from "node:test";
import assert from "node:assert/strict";
import { weeklyHref, validWeekStart, weeklyPages, weeklySources } from "../src/lib/weekly-magazine.ts";
import { editionSpreads } from "../src/lib/newspaper-pages.ts";

const article=(id,category="technology")=>({
  id, category, title:"Tin số "+id, summary:"Mô tả "+id, url:"https://example.org/"+id,
  source:"Nguồn "+id,image_url:null,published_at:"2026-10-16T10:00:00Z",region:"vn",
  coverageDate:"2026-10-16",
});
const magazine={
  weekStart:"2026-10-12",weekEnd:"2026-10-18",issueDate:"2026-10-19",
  title:"Tạp chí tuần",overview:"Tổng quan",overviewMode:"rss",
  coverageDays:2,availableDates:["2026-10-14","2026-10-16"],missingDates:["2026-10-12"],
  stories:[
    article(1),article(2,"general"),article(3,"science"),article(4,"business"),
    article(5,"technology"),article(6,"education"),article(7,"business"),
  ],
  radarPool:[article(8,"technology"),article(9,"science")],
  timeline:[{date:"2026-10-14",stories:[{id:1,title:"Tin số 1",url:"https://example.org/1",source:"Nguồn 1"}]}],
  storyCount:7,sourceCount:3,editorial:{mode:"fallback",reason:"model_error",model:null},
  createdAt:"2026-10-19T00:00:00Z",
};
test("archive opens specific immutable magazine by Monday start",()=>{
  assert.equal(weeklyHref("2026-10-12"),"/magazine/?week=2026-10-12");
  assert.equal(weeklyHref("2026-10-12","/magazine/print/"),"/magazine/print/?week=2026-10-12");
  assert.equal(weeklyHref(undefined),"/magazine/");
  assert.equal(validWeekStart("2026-10-13"),false);
  assert.equal(validWeekStart("2026-02-30"),false);
  assert.equal(validWeekStart("2026-10-12"),true);
});
test("magazine has cover, weekly review, section pages, timeline and personal chapter",()=>{
  const pages=weeklyPages(magazine,{enabled:true,topics:["technology","science"]});
  assert.deepEqual(pages.map(p=>p.id),["cover","review","highlights","technology","perspectives","timeline","radar"]);
  assert.deepEqual(pages.find(p=>p.id==="technology").articles.map(a=>a.id),[5,6]);
  assert.deepEqual(pages.find(p=>p.id==="perspectives").articles.map(a=>a.id),[7]);
  assert.deepEqual(editionSpreads(pages.length,true),[[0],[1,2],[3,4],[5,6]]);
  assert.equal(editionSpreads(pages.length,false).length,pages.length);
});
test("My Radar does not mutate shared magazine and can be disabled",()=>{
  const before=JSON.stringify(magazine);
  const pages=weeklyPages(magazine,{enabled:false,topics:["technology"]});
  assert.equal(pages.find(p=>p.id==="radar").articles.length,0);
  assert.equal(JSON.stringify(magazine),before);
});
test("PDF source appendix includes linked articles and timeline without duplicates",()=>{
  const sources=weeklySources(magazine,{enabled:true,topics:["technology","science"]});
  assert.deepEqual(sources.map(s=>s.url),Array.from({length:9},(_,i)=>"https://example.org/"+(i+1)));
  assert.equal(new Set(sources.map(s=>s.url)).size,sources.length);
});
