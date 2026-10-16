import test from "node:test";
import assert from "node:assert/strict";
import { printEditionHref, isValidIssueDate, editionPrintSources } from "../src/lib/print-edition.ts";

function article(id, category, url = "https://example.org/" + id) {
  return {
    id, category, url, title: "Bài " + id, summary: "Mô tả RSS",
    image_url: null, published_at: "2026-10-16T10:00:00Z",
    source: "Báo " + id, region: "vn",
  };
}
const edition = {
  id: "2026-10-17", issueDate: "2026-10-17", coverageDate: "2026-10-16",
  title: "Ấn bản thử", summary: "Tóm tắt RSS", summaryMode: "rss",
  lead: article(1, "technology"),
  secondary: [article(2, "business"), article(3, "science"), article(4, "technology")],
  briefs: [article(5, "general")],
  radarPool: [article(6, "technology"), article(7, "science")],
  articleCount: 7, sourceCount: 4, createdAt: "2026-10-17T00:00:00Z",
};
const prefs = { enabled: true, topics: ["technology", "science"] };

test("date paths always point to the requested archived issue", () => {
  assert.equal(printEditionHref("2026-10-17"), "/edition/print/?date=2026-10-17");
  assert.equal(printEditionHref(null), "/edition/print/");
  assert.equal(printEditionHref("2026-02-30"), "/edition/print/");
  assert.equal(printEditionHref("2026/10/17"), "/edition/print/");
  assert.equal(isValidIssueDate("2024-02-29"), true);
  assert.equal(isValidIssueDate("2025-02-29"), false);
  assert.equal(isValidIssueDate("2026-13-17"), false);
});

test("print source list includes cover, sections and personalized stories with stable order", () => {
  const rows = editionPrintSources(edition, prefs);
  assert.deepEqual(rows.map((article) => article.id), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(rows.every((article) => article.url.startsWith("https://")));
});

test("personalized items are not included when My Radar is disabled", () => {
  const rows = editionPrintSources(edition, { enabled: false, topics: ["science"] });
  assert.deepEqual(rows.map((article) => article.id), [1, 2, 3, 4, 5]);
});

test("duplicate sources appear only once in the PDF appendix", () => {
  const duplicate = { ...edition, briefs: [...edition.briefs, article(8, "science", edition.lead.url)] };
  assert.deepEqual(editionPrintSources(duplicate, prefs).map((article) => article.id), [1, 2, 3, 4, 5, 6, 7]);
});
