import { describe, expect, it } from "vitest";
import { groupRelatedStories, titleSimilarity, titleTokens } from "../src/story-groups";

const time = "2026-10-16T08:00:00.000Z";
function article(id: number, title: string, region = "vn", published_at = time) {
  return {
    id, title, url: `https://example.org/${id}`,
    source: id % 2 ? "Source A" : "Source B", region,
    category: "technology", image_url: null, published_at,
  };
}

describe("related story grouping", () => {
  it("groups highly similar Vietnamese headlines", () => {
    const rows = [
      article(1, "Doanh nghiệp công nghệ Việt Nam công bố nền tảng trí tuệ nhân tạo mới"),
      article(2, "Doanh nghiệp công nghệ Việt Nam công bố nền tảng trí tuệ nhân tạo mới hôm nay"),
    ];
    const groups = groupRelatedStories(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].articleCount).toBe(2);
  });

  it("rejects unrelated headlines and cross-region matches", () => {
    const rows = [
      article(1, "Doanh nghiệp công nghệ Việt Nam công bố nền tảng trí tuệ nhân tạo mới"),
      article(2, "Giá bất động sản tăng tại nhiều quận ở Thành phố Hồ Chí Minh"),
      article(3, "Doanh nghiệp công nghệ Việt Nam công bố nền tảng trí tuệ nhân tạo mới", "world"),
    ];
    expect(groupRelatedStories(rows)).toHaveLength(0);
  });

  it("does not cluster unrelated publication times", () => {
    const title = "Doanh nghiệp công nghệ Việt Nam công bố nền tảng trí tuệ nhân tạo mới";
    expect(groupRelatedStories([
      article(1, title),
      article(2, title, "vn", "2026-10-12T08:00:00.000Z"),
    ])).toHaveLength(0);
  });

  it("normalizes accents and rejects short weak titles", () => {
    expect(titleSimilarity(titleTokens("AI mới"), titleTokens("AI mới"))).toBe(0);
    expect(titleTokens("Việt Nam").has("viet")).toBe(true);
  });
});
