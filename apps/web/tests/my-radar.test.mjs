import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RADAR_PREFERENCES,
  getRadarQueries,
  isAiArticle,
  parseRadarPreferences,
  selectRadarStories,
} from "../src/lib/my-radar.ts";

const makeArticle = (id, category, title, published_at = "2026-10-15T12:00:00Z") => ({
  id, category, title, published_at, summary: null, url: "https://example.com/" + id,
  image_url: null, source: "Example", region: "vn",
});

test("default topics prioritize AI, technology, business and science", () => {
  assert.deepEqual(DEFAULT_RADAR_PREFERENCES.topics, ["ai", "technology", "business", "science"]);
  assert.equal(DEFAULT_RADAR_PREFERENCES.enabled, true);
});

test("malformed storage is ignored and unsupported topics are stripped", () => {
  assert.deepEqual(parseRadarPreferences("{"), DEFAULT_RADAR_PREFERENCES);
  assert.deepEqual(
    parseRadarPreferences('{"enabled":true,"topics":["ai","ai","bad","science"]}'),
    { enabled: true, topics: ["ai", "science"] }
  );
  assert.deepEqual(parseRadarPreferences('{"enabled":false,"topics":[]}'), { enabled: false, topics: [] });
});

test("AI keyword matching does not treat Vietnamese substrings as AI", () => {
  assert.equal(isAiArticle({ title: "Hai công ty ký hợp đồng", summary: null }), false);
  assert.equal(isAiArticle({ title: "Thái Lan đẩy mạnh thương mại", summary: null }), false);
  assert.equal(isAiArticle({ title: "Mô hình trí tuệ nhân tạo mới", summary: null }), true);
  assert.equal(isAiArticle({ title: "OpenAI công bố mô hình mới", summary: null }), true);
  assert.equal(isAiArticle({ title: "Nghiên cứu AI", summary: null }), true);
});

test("queries include source categories and multiple discoverable AI phrases", () => {
  const qs = getRadarQueries(["ai", "technology", "science"]);
  assert.deepEqual(qs.find((q) => q.category === "technology"), { category: "technology", q: "" });
  assert.ok(qs.some((q) => q.q === "trí tuệ nhân tạo"));
  assert.ok(qs.some((q) => q.q === "OpenAI"));
});

test("feed de-duplicates AI stories and alternates topics", () => {
  const items = [
    makeArticle(1, "technology", "OpenAI cập nhật"),
    makeArticle(1, "technology", "OpenAI cập nhật"),
    makeArticle(2, "technology", "Công nghệ mới"),
    makeArticle(3, "business", "Thị trường mới"),
    makeArticle(4, "science", "Khoa học mới"),
  ];
  const output = selectRadarStories(items, ["ai", "technology", "business", "science"], 4);
  assert.deepEqual(output.map((item) => item.article.id), [1, 2, 3, 4]);
  assert.deepEqual(output.map((item) => item.topic), ["ai", "technology", "business", "science"]);
});

test("no selected topics produces an empty feed", () => {
  assert.deepEqual(selectRadarStories([makeArticle(1, "technology", "Tin")], []), []);
});
