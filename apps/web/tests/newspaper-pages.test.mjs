import test from "node:test";
import assert from "node:assert/strict";
import { buildEditionPages, editionSpreads, indexForPage, offsetSpread } from "../src/lib/newspaper-pages.ts";

function story(id, category) {
  return {
    id, category, title: "Tin số " + id, url: "https://example.org/" + id,
    summary: "Mô tả RSS", image_url: null, published_at: "2026-10-16T10:00:00Z",
    source: "Báo " + id, region: "vn",
  };
}
const edition = {
  id: "2026-10-17", issueDate: "2026-10-17", coverageDate: "2026-10-16",
  title: "Điểm tin", summary: "Tóm tắt RSS", summaryMode: "rss",
  lead: story(1, "general"), secondary: [story(2,"technology"), story(3,"business"), story(4,"science"), story(5,"general"), story(6,"education"), story(7,"sports")],
  briefs: [story(8,"general"), story(9,"technology")],
  radarPool: [story(10,"technology"), story(11,"science"), story(12,"business")],
  articleCount: 12, sourceCount: 4, createdAt: "2026-10-17T00:00:00Z",
};
const prefs = { enabled: true, topics: ["ai", "technology", "business", "science"] };

test("builds predictable cover, two story pages, brief and personal page", () => {
  const pages = buildEditionPages(edition, prefs);
  assert.deepEqual(pages.map((page) => page.kind), ["cover","stories","stories","briefs","radar"]);
  assert.deepEqual(pages.filter((page) => page.kind === "stories").flatMap((page) => page.articles.map((a) => a.id)), [2,3,4,5,6,7]);
  assert.deepEqual(pages.find((page) => page.kind === "radar").articles.map(({article})=>article.id), [10,12,11]);
});
test("desktop has single cover then two-page spreads", () => {
  assert.deepEqual(editionSpreads(5, true), [[0],[1,2],[3,4]]);
  assert.deepEqual(editionSpreads(6, true), [[0],[1,2],[3,4],[5]]);
});
test("mobile reads one page at a time", () => {
  assert.deepEqual(editionSpreads(5,false), [[0],[1],[2],[3],[4]]);
  assert.deepEqual(editionSpreads(0,false), []);
});
test("page anchors find correct spread after responsive layout change", () => {
  assert.equal(indexForPage(editionSpreads(5,true),3),1);
  assert.equal(indexForPage(editionSpreads(5,false),3),2);
  assert.equal(indexForPage(editionSpreads(5,true),999),2);
  assert.equal(indexForPage(editionSpreads(5,true),-1),0);
});
test("prevents navigating outside the book", () => {
  assert.equal(offsetSpread(0,-1,3),0);
  assert.equal(offsetSpread(2,1,3),2);
  assert.equal(offsetSpread(1,1,3),2);
});
test("empty sections are omitted and My Radar disabled is respected", () => {
  const pages=buildEditionPages({ ...edition, secondary: [], briefs: [] },{enabled:false,topics:["technology"]});
  assert.deepEqual(pages.map(p=>p.kind), ["cover","radar"]);
  assert.equal(pages[1].articles.length,0);
});
