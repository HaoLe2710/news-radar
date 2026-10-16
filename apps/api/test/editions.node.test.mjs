import test from "node:test";
import assert from "node:assert/strict";
import { coverageWindow, composeEdition } from "../src/edition-builder.ts";

function article(id, category, image = null) {
  return { id, title:"Bài số "+id, url:"https://example.org/"+id,
    summary:"Tin được tổng hợp từ mô tả RSS", image_url:image,
    published_at:"2026-10-15T10:00:00Z",source:id%2?"Nguồn A":"Nguồn B",
    region:"vn", category };
}
test("Vietnam edition uses the completed previous calendar day",()=>{
 const v=coverageWindow("2026-10-16");
 assert.deepEqual(v,{from:"2026-10-14T17:00:00.000Z",to:"2026-10-15T17:00:00.000Z",coverageDate:"2026-10-15"});
 assert.throws(()=>coverageWindow("2026-13-55"));
});
test("requires at least four RSS items",()=>{
 assert.equal(composeEdition("2026-10-16",[article(1,"science")]),null);
});
test("selects illustrated lead, deduplicates, and splits newspaper sections",()=>{
 const rows=[article(1,"technology"),article(2,"business","https://example.org/2.jpg"),article(2,"business"),article(3,"science"),article(4,"general"),article(5,"science"),article(6,"technology"),article(7,"business"),article(8,"science"),article(9,"general"),article(10,"technology"),article(11,"business"),article(12,"science"),article(13,"general"),article(14,"technology")];
 const e=composeEdition("2026-10-16",rows,null,"2026-10-16T01:00:00Z");
 assert.ok(e); assert.equal(e.lead.id,2);assert.equal(e.secondary.length,6);
 assert.equal(e.briefs.length,6);assert.equal(e.summaryMode,"rss");
 assert.equal(new Set([e.lead,...e.secondary,...e.briefs,...e.radarPool].map(x=>x.id)).size,e.articleCount);
});
test("reuses validated AI overview when available",()=>{
 const rows=[article(1,"science"),article(2,"business"),article(3,"science"),article(4,"technology")];
 const overview="Bản tin tổng hợp thông tin khoa học, công nghệ và kinh tế từ các tiêu đề RSS, không bổ sung dữ kiện khác.";
 const e=composeEdition("2026-10-16",rows,{overview,mode:"ai"});
 assert.equal(e?.summary,overview);assert.equal(e?.summaryMode,"ai");
});
test("edition layout is deterministic for a fixed input and publication time",()=>{
 const rows=[article(1,"science"),article(2,"business"),article(3,"science"),article(4,"technology")];
 assert.deepEqual(composeEdition("2026-10-16",rows,null,"2026-10-16T01:00:00Z"),
                  composeEdition("2026-10-16",rows,null,"2026-10-16T01:00:00Z"));
});
