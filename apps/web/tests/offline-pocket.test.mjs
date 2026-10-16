import test from "node:test";
import assert from "node:assert/strict";
import {
  offlineKey, offlineHref, normalizeSavedPage, progressKey,
} from "../src/lib/offline-library.ts";

test("offline keys are distinct per daily vs weekly edition",()=>{
  assert.equal(offlineKey("daily","2026-10-17"),"daily:2026-10-17");
  assert.equal(offlineKey("weekly","2026-10-17"),"weekly:2026-10-17");
  assert.notEqual(offlineKey("daily","2026-10-17"),offlineKey("weekly","2026-10-17"));
  assert.throws(()=>offlineKey("daily","2026/10/17"));
});
test("offline deep links pin the issue instead of requesting latest",()=>{
  assert.equal(offlineHref({kind:"daily",issueDate:"2026-10-17"}),"/edition/?date=2026-10-17");
  assert.equal(offlineHref({kind:"weekly",issueDate:"2026-10-12"}),"/magazine/?week=2026-10-12");
});
test("reading position ignores invalid or unbounded numbers",()=>{
  assert.equal(normalizeSavedPage("5"),5);
  assert.equal(normalizeSavedPage("not-a-number"),1);
  assert.equal(normalizeSavedPage(-20),1);
  assert.equal(normalizeSavedPage(0),1);
  assert.equal(normalizeSavedPage(1000),1);
  assert.equal(normalizeSavedPage("3.5"),1);
  assert.equal(normalizeSavedPage(null),1);
});
test("reading progress has isolated, predictable local storage keys",()=>{
  assert.equal(progressKey("daily:2026-10-17"),"news-radar:reading:v1:daily:2026-10-17");
  assert.notEqual(progressKey("daily:2026-10-17"),progressKey("weekly:2026-10-17"));
});
