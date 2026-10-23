import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldLocalize, localizationPrompt, parseLocalizedBatch, applyLocalization,
  localizePendingArticles,
} from "../src/localization.ts";
const rows=[
  {id:1,region:"world",title:"Scientists discover a new battery technology in 2026",
   summary:"Researchers report a battery design that lasts 20 hours."},
  {id:2,region:"world",title:"Technology company announces its global expansion",
   summary:"The company opens offices in three countries."},
  {id:3,region:"world",title:"Researchers report a new health study",
   summary:null},
];
const translation={translations:[
  {id:1,titleVi:"Các nhà khoa học khám phá công nghệ pin mới trong năm 2026",
   summaryVi:"Các nhà nghiên cứu công bố thiết kế pin hoạt động được 20 giờ."},
  {id:2,titleVi:"Doanh nghiệp công nghệ công bố kế hoạch mở rộng toàn cầu",
   summaryVi:"Doanh nghiệp mở văn phòng tại ba quốc gia."},
  {id:3,titleVi:"Các nhà nghiên cứu công bố một nghiên cứu sức khỏe mới",summaryVi:null},
]};
test("translate English/world only; do not touch original Vietnamese news",()=>{
  assert.equal(shouldLocalize(rows[0]),true);
  assert.equal(shouldLocalize({...rows[0],region:"vn"}),false);
  assert.equal(shouldLocalize({...rows[0],title:"Nhà khoa học phát triển pin mới"}),false);
  assert.equal(shouldLocalize({...rows[0],title:"Công nghệ đang phát triển"}),false);
});
test("prompt preserves original RSS scope, source content and missing summaries",()=>{
  const prompt=localizationPrompt(rows);
  assert.match(prompt,/summaryVi=null/);
  assert.match(prompt,/không tự thêm/);
  assert.match(prompt,/Scientists discover/);
  assert.match(prompt,/RSS_DATA=/);
});
test("parse JSON responses, map IDs and keep all source numbers",()=>{
  const result=parseLocalizedBatch(JSON.stringify(translation),rows);
  assert.equal(result.size,3);
  assert.match(result.get(1)?.titleVi??"",/2026/);
  assert.match(result.get(1)?.summaryVi??"",/20/);
  assert.equal(result.get(3)?.summaryVi,undefined);
  const original=rows[0];
  const localized=applyLocalization(original,result);
  assert.equal(localized.title,original.title);
  assert.equal(localized.summary,original.summary);
  assert.equal(localized.titleVi,result.get(1)?.titleVi);
});
test("reject fabricated dates and numbers, unknown IDs, non-Vietnamese and HTML injections",()=>{
  const invalid=[
    {id:1,titleVi:"Các nhà khoa học báo cáo kết quả năm 2035",summaryVi:translation.translations[0].summaryVi},
    {id:8,titleVi:"Thông tin quốc tế hoàn toàn mới",summaryVi:"Một câu mô tả không có dữ kiện."},
    {id:2,titleVi:"Global company announces expansion",summaryVi:"The company expands abroad."},
    {id:3,titleVi:"<script>alert('x')</script>",summaryVi:null},
  ];
  assert.equal(parseLocalizedBatch({translations:invalid},rows).size,0);
  assert.equal(parseLocalizedBatch("not JSON",rows).size,0);
});
test("cannot hallucinate a description if original RSS summary was empty",()=>{
  const draft={translations:[{id:3,titleVi:"Các nhà nghiên cứu công bố nghiên cứu sức khỏe mới",
    summaryVi:"Nghiên cứu cho thấy mức tăng trưởng 50 phần trăm."}]};
  const parsed=parseLocalizedBatch(draft,[rows[2]]);
  assert.equal(parsed.size,1);
  assert.equal(parsed.get(3)?.summaryVi,undefined);
});
test("missing Workers AI never mutates the database or blocks scheduled news ingestion",async()=>{
  const result=await localizePendingArticles({DB:{},AI:undefined});
  assert.deepEqual(result,{attempted:0,translated:0});
});
