import test from "node:test";
import assert from "node:assert/strict";
import { chooseEditorialCandidates, parseEditorialResponse, generateEditorial } from "../src/editorial-engine.ts";
import { composeEdition } from "../src/edition-builder.ts";

const titles = [
  "Doanh nghiệp công nghệ Việt Nam công bố ứng dụng trí tuệ nhân tạo mới",
  "Các nhà khoa học công bố nghiên cứu về năng lượng tái tạo tại Việt Nam",
  "Thị trường kinh tế ghi nhận những thay đổi trong hoạt động xuất nhập khẩu",
  "Trường đại học triển khai chương trình đào tạo kỹ năng số cho sinh viên",
  "Ngành du lịch Việt Nam giới thiệu giải pháp phát triển du lịch bền vững",
  "Chuyên gia môi trường đánh giá chất lượng nguồn nước và hệ sinh thái",
  "Giải bóng đá quốc gia công bố lịch thi đấu cho mùa giải mới",
  "Cơ quan quản lý công bố thông tin về các dự án giao thông mới",
];
function row(id, category = "technology", source = "RSS A") {
  return {
    id, title: titles[(id-1) % titles.length], summary: titles[(id-1) % titles.length] + ".",
    url: "https://example.org/" + id, image_url: id===2 ? "https://example.org/2.jpg" : null,
    category, source, region: "vn", published_at:"2026-10-16T10:00:00Z",
  };
}
const items = Array.from({length:8}, (_,i)=>row(i+1, ["technology","science","business","education"][i%4]));
const valid = {
  headline: "Những chuyển động khoa học, công nghệ và kinh tế hôm nay",
  overview: "Các doanh nghiệp công nghệ Việt Nam công bố ứng dụng trí tuệ nhân tạo mới. Các nhà khoa học công bố nghiên cứu về năng lượng tái tạo. Hoạt động xuất nhập khẩu và đào tạo kỹ năng số cũng được nhắc đến trong bản tin.",
  ranked: [ {id:2,score:95},{id:1,score:91},{id:3,score:88},{id:4,score:84},{id:5,score:75},{id:6,score:73},{id:7,score:70} ],
  digests: [{id:2,text:"Các nhà khoa học công bố nghiên cứu về năng lượng tái tạo tại Việt Nam."}],
};
test("candidate selection caps the model request and rotates sources/categories", () => {
  const pool = Array.from({length:60},(_,i)=>row(i+1,i%3?"science":"business",i%2?"Nguồn 1":"Nguồn 2"));
  const selected = chooseEditorialCandidates(pool,24);
  assert.ok(selected.length<=10); // Two sources, capped at five articles each
  assert.ok(selected.every(x=>selected.filter(y=>y.source===x.source).length<=5));
});
test("AI response accepts ranked source IDs and source-grounded digests", () => {
  const draft = parseEditorialResponse(JSON.stringify(valid),items);
  assert.ok(draft);
  assert.equal(draft.ranked[0].id,2);
  assert.equal(draft.digests[0].id,2);
  const edition = composeEdition("2026-10-17",items,null,"2026-10-17T02:00:00Z",draft,"success");
  assert.equal(edition?.lead.id,2);
  assert.equal(edition?.lead.editorialScore,95);
  assert.equal(edition?.lead.editorialSummary,draft.digests[0].text);
  assert.equal(edition?.editorial?.mode,"ai");
  assert.equal(edition?.summary,draft.overview);
});
test("rejects made-up IDs and never selects articles outside supplied RSS", () => {
  const untrusted = {...valid,ranked:[{id:99999,score:100},{id:2,score:93},{id:1,score:92},{id:3,score:80},{id:4,score:70}]};
  const draft=parseEditorialResponse(untrusted,items);
  assert.ok(draft);
  assert.deepEqual(draft.ranked.map(x=>x.id),[2,1,3,4]);
});
test("invalid ranking, hallucinated numbers or unrelated output falls back", () => {
  assert.equal(parseEditorialResponse({...valid,ranked:[{id:404,score:100}]},items),null);
  assert.equal(parseEditorialResponse({...valid,overview:"Hệ thống ngân hàng công bố 9000 tỷ trong báo cáo mới nhất về nền kinh tế."},items),null);
  assert.equal(parseEditorialResponse("nonsense",items),null);
  assert.equal(parseEditorialResponse({...valid,headline:"x"},items),null);
  assert.equal(parseEditorialResponse({...valid,headline:"Doanh nghiệp công bố doanh thu đạt 99999 tỷ đồng trong ngày"},items),null);
});
test("unsupported digest facts are dropped without discarding validated ranking", () => {
  const draft=parseEditorialResponse({...valid,digests:[{id:2,text:"Các nhà khoa học công bố nghiên cứu về năng lượng tái tạo trị giá 99999 tỷ đồng."}]},items);
  assert.ok(draft);
  assert.equal(draft.digests.length,0);
});
test("unavailable AI produces safe fallback without a model call", async () => {
  const result=await generateEditorial(undefined,"2026-10-17",items);
  assert.deepEqual(result,{draft:null,reason:"binding_missing"});
  const edition=composeEdition("2026-10-17",items,null,"2026-10-17T02:00:00Z",null,result.reason);
  assert.equal(edition?.editorial?.mode,"fallback");
  assert.equal(edition?.lead.id,2);
});
