import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newsTitle,newsSummary,isTranslated } from "../src/lib/localized-news.ts";

const source=(path)=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
const sample={title:"Global research team reports new findings",summary:"This is the original English RSS excerpt.",
  titleVi:"Nhóm nghiên cứu quốc tế công bố kết quả mới",
  summaryVi:"Một nhóm nghiên cứu quốc tế vừa công bố các kết quả mới."};
test("Vietnamese first, original RSS remains available and reliable fallback",()=>{
  assert.equal(newsTitle(sample),sample.titleVi);
  assert.equal(newsSummary(sample),sample.summaryVi);
  assert.equal(isTranslated(sample),true);
  assert.equal(newsTitle({title:sample.title}),sample.title);
  assert.equal(newsSummary({title:sample.title,summary:sample.summary}),sample.summary);
  assert.equal(newsSummary({title:sample.title,summary:null,editorialSummary:"Bản tóm lược AI"}),"Bản tóm lược AI");
});
test("restore distinctive original paper icon instead of Phase 18 text-only NR.",()=>{
  const nav=source("components/SiteNavbar.tsx");
  assert.match(nav,/src="\/icon\.svg"/);
  assert.match(nav,/className="nr-global-brand-logo"/);
  assert.doesNotMatch(nav,/nr-global-brand-mark/);
});
test("daily, weekly and printed edition prefer saved Vietnamese summaries",()=>{
  const targets=[
    "app/page.tsx",
    "app/edition/page.tsx",
    "app/edition/print/page.tsx",
    "app/magazine/magazine-content.tsx"
  ];
  for(const path of targets){
    const content=source(path);
    assert.match(content,/newsTitle/,"No translated headlines on "+path);
    assert.match(content,/newsSummary/,"No translated summaries on "+path);
  }
  assert.match(source("app/page.tsx"),/VI · AI dịch từ RSS/);
  assert.match(source("app/edition/page.tsx"),/Bản tiếng Việt do AI dịch/);
});
test("the original SVG logo is still present and not re-created using text",()=>{
  const svg=readFileSync(new URL("../public/icon.svg",import.meta.url),"utf8");
  assert.match(svg,/<svg/);
  assert.match(svg,/>RADAR</);
  assert.match(svg,/>NEWS</);
});
