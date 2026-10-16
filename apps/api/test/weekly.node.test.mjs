import test from "node:test";
import assert from "node:assert/strict";
import {
  plusDays, completedWeek, isValidWeekStart, buildWeeklyMagazine,
  collectWeeklyCandidates, weeklyAiCandidates,
} from "../src/weekly-builder.ts";
import { editorialPrompt } from "../src/editorial-engine.ts";

function story(id, day, category="technology") {
  return {
    id, title:"Tin công nghệ " + id + " cập nhật ngày " + day,
    summary:"Tổng hợp cập nhật trong ngày từ các nguồn báo gốc.",
    url:"https://example.org/story/" + id, image_url:null,
    published_at:day+"T10:00:00Z",source:id%2?"Nguồn A":"Nguồn B",
    region:"vn", category,
  };
}
function daily(coverageDate,id) {
  return {
    id:plusDays(coverageDate,1),issueDate:plusDays(coverageDate,1),coverageDate,
    title:"Tổng hợp",summary:"Bản tin ngày " + coverageDate,summaryMode:"rss",
    lead:story(id,coverageDate),secondary:[story(id+100,coverageDate,"business")],
    briefs:[story(id+200,coverageDate,"science")],
    radarPool:[story(id+300,coverageDate,"education")],
    articleCount:4,sourceCount:2,createdAt:coverageDate+"T18:00:00Z",
  };
}
test("week boundaries use local Vietnam Monday, not UTC weekday",()=>{
  const week=completedWeek(new Date("2026-10-18T17:05:00Z")); // 00:05 Mon Oct 19 in VN
  assert.deepEqual([week.weekStart,week.weekEnd,week.issueDate],["2026-10-12","2026-10-18","2026-10-19"]);
  assert.equal(week.firstEditionDate,"2026-10-13");
  assert.equal(week.lastEditionDate,"2026-10-19");
  assert.equal(completedWeek(new Date("2026-10-17T02:00:00Z")).weekStart,"2026-10-05");
  assert.equal(plusDays("2026-12-31",1),"2027-01-01");
});
test("reject invalid week and date",()=>{
  assert.equal(isValidWeekStart("2026-10-12"),true);
  assert.equal(isValidWeekStart("2026-10-13"),false);
  assert.equal(isValidWeekStart("2026-02-30"),false);
  assert.throws(()=>plusDays("2026-02-30",1));
  assert.throws(()=>buildWeeklyMagazine("2026-10-13",[]));
});
test("a complete week publishes a fixed magazine with source-backed timeline",()=>{
  const input=Array.from({length:7},(_,i)=>daily(plusDays("2026-10-12",i),i+1));
  const weekly=buildWeeklyMagazine("2026-10-12",input,null,"model_error","2026-10-19T01:00:00Z");
  assert.ok(weekly);
  assert.equal(weekly.coverageDays,7);
  assert.deepEqual(weekly.missingDates,[]);
  assert.equal(weekly.issueDate,"2026-10-19");
  assert.equal(weekly.timeline.length,7);
  assert.equal(weekly.editorial.mode,"fallback");
  assert.equal(weekly.storyCount,12);
  assert.ok(weekly.timeline.every(day=>day.stories.every(item=>item.url.startsWith("https://example.org/"))));
});
test("partial weekly coverage is explicitly marked and never claims full coverage",()=>{
  const one=daily("2026-10-14",4);
  const duplicate={...one,issueDate:"2026-10-14"}; // Should be ignored (issue date mismatch)
  const weekly=buildWeeklyMagazine("2026-10-12",[one,duplicate]);
  assert.ok(weekly);
  assert.equal(weekly.coverageDays,1);
  assert.deepEqual(weekly.availableDates,["2026-10-14"]);
  assert.equal(weekly.missingDates.length,6);
  assert.match(weekly.overview,/1\/7/);
  assert.equal(weekly.timeline.length,1);
});
test("duplicate article links across days remain unique",()=>{
  const first=daily("2026-10-12",1);
  const second=daily("2026-10-13",1);
  const rows=collectWeeklyCandidates([second,first]);
  assert.equal(new Set(rows.map(x=>x.url)).size,rows.length);
  assert.equal(rows[0].coverageDate,"2026-10-12");
  assert.equal(weeklyAiCandidates([first,second]).length<=24,true);
});
test("no daily editions never creates a fake weekly issue",()=>{
  assert.equal(buildWeeklyMagazine("2026-10-12",[]),null);
});
test("weekly editorial prompt uses explicit weekly context",()=>{
  const input=weeklyAiCandidates([daily("2026-10-12",1),daily("2026-10-13",2)]);
  const prompt=editorialPrompt("2026-10-12 đến 2026-10-18",input,"weekly");
  assert.match(prompt,/tạp chí tổng kết tuần/);
  assert.match(prompt,/RSS_DATA_JSON/);
});
