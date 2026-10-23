import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../src/", import.meta.url);
const read = path => readFileSync(new URL(path,root),"utf8");

test("Vietnamese-safe serif and sans fonts have offline fallbacks",()=>{
  const layout=read("app/layout.tsx");
  const theme=read("app/newspaper-rework.css");
  assert.match(layout,/Be\+Vietnam\+Pro/);
  assert.match(layout,/Noto\+Serif/);
  assert.match(theme,/--nr-serif:[^;]+"Times New Roman"/);
  assert.match(theme,/--nr-sans:[^;]+"Segoe UI"/);
  assert.match(layout,/<SiteNavbar\/>/);
});
test("global navigation exposes Daily Weekly Library Ask and notifications with mobile accessibility",()=>{
  const navbar=read("components/SiteNavbar.tsx");
  for(const href of ["/","/edition/","/magazine/","/edition/archive/","/library/","/ask/","/notifications/"]){
    assert.ok(navbar.includes('href: "'+href+'"'),"missing "+href);
  }
  assert.match(navbar,/aria-expanded=\{open\}/);
  assert.match(navbar,/aria-current=\{active\(item.href\)/);
  assert.match(read("app/newspaper-rework.css"),/nr-global-navigation-open/);
});
test("homepage no longer renders giant promotional banners ahead of the actual news",()=>{
  const home=read("app/page.tsx");
  assert.doesNotMatch(home,/<section className="nr-pocket-home"/);
  assert.doesNotMatch(home,/<section className="nr-notifications-home"/);
  assert.doesNotMatch(home,/<section className="edition-entry"/);
  assert.match(home,/<h1>Những câu chuyện đáng chú ý<\/h1>/);
  assert.match(home,/onClick=\{refresh\}/);
});
test("daily and weekly show real excerpt data, publisher credits, images and original URLs",()=>{
  const daily=read("app/edition/page.tsx");
  const weekly=read("app/magazine/magazine-content.tsx");
  const print=read("app/edition/print/page.tsx");
  for(const source of [daily,weekly]){
    assert.match(source,/article\.editorialSummary \|\| article\.summary/);
    assert.match(source,/article\.image_url/);
    assert.match(source,/article\.source/);
    assert.match(source,/rel="noopener noreferrer"/);
    assert.match(source,/article\.url/);
  }
  assert.match(daily,/nr-cover-teasers/);
  assert.match(daily,/nr-report-picture/);
  assert.match(weekly,/wm-cover-briefs/);
  assert.match(weekly,/wm-article-figure/);
  assert.match(weekly,/wm-week-review-grid/);
  assert.match(print,/pe-cover-teasers/);
  assert.match(print,/pe-print-image/);
});
test("paper layouts retain multi-column reading and collapse for mobile",()=>{
  const css=read("app/newspaper-rework.css");
  assert.match(css,/\.nr-report-list\s*\{[^}]*grid-template-columns:repeat\(2/);
  assert.match(css,/\.wm-articles\s*\{[^}]*grid-template-columns:repeat\(2/);
  assert.match(css,/@media\s*\(max-width:720px\)/);
  assert.match(css,/@media print/);
});
