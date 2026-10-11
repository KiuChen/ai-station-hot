import assert from "node:assert/strict";
import { test } from "node:test";
import { channelListKey, channelSwitchHref } from "../app/lib/channel-switch.ts";
import { apiGet } from "../app/lib/api.server.ts";
import { adminGet } from "../app/lib/admin.server.ts";

test("switching a searched list reruns the query in the new channel and drops domain-specific filters", async () => {
  const next = channelSwitchHref("/art/all", "?q=Hannah&category=art-works&tag=绘画&page=3&tab=relevance", "ai");
  const url = new URL(next, "http://local");
  assert.equal(url.pathname, "/all");
  assert.equal(url.searchParams.get("q"), "Hannah");
  assert.equal(url.searchParams.get("tab"), "relevance");
  for (const field of ["category", "tag", "page"]) assert.equal(url.searchParams.get(field), null);
  const previous = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => { calls.push(String(input)); return Response.json({ items: [] }); };
  try {
    await apiGet("/api/site/pool?q=Hannah", { request: new Request(url) });
    const art = channelSwitchHref(url.pathname, url.search, "art");
    await apiGet("/api/site/pool?q=Hannah", { request: new Request(new URL(art, url)) });
    assert.equal(calls[0], `${process.env.API_BASE_URL || "http://127.0.0.1:3001"}/api/site/pool?q=Hannah`);
    assert.equal(calls[1], `${process.env.CHANNEL_API_BASE_ART || "http://127.0.0.1:3002"}/api/site/pool?q=Hannah`);
  } finally { globalThis.fetch = previous; }
});

test("switching submits a visible search draft and respects clearing an older query", () => {
  assert.equal(channelSwitchHref("/", "", "art", false, " Hannah "), "/art/all?q=Hannah");
  assert.equal(channelSwitchHref("/all", "?q=old&page=4", "art", false, ""), "/art/all");
  assert.equal(channelSwitchHref("/art/all", "?q=old", "ai", false, "new"), "/all?q=new");
});

test("admin channel switching stays on the search page and reloads its new dataset", async () => {
  const next = channelSwitchHref("/admin/content", "?q=Hannah", "art", true);
  assert.equal(next, "/art/admin/content?q=Hannah");
  assert.equal(channelSwitchHref("/art/admin/sources", "?q=Colossal&kind=rss&page=2", "ai", true), "/admin/sources?q=Colossal");
  assert.equal(channelSwitchHref("/admin/sources/old-source", "", "art", true), "/art/admin/sources");
  const previous = globalThis.fetch;
  let requested = "";
  globalThis.fetch = async (input) => { requested = String(input); return Response.json({ rows: [] }); };
  try {
    await adminGet(new Request(new URL(next, "http://local")), "/api/admin/content?q=Hannah");
    assert.equal(requested, `${process.env.CHANNEL_API_BASE_ART || "http://127.0.0.1:3002"}/api/admin/content?q=Hannah`);
  } finally { globalThis.fetch = previous; }
});

test("the default history key cannot restore another domain, route or query", () => {
  assert.notEqual(channelListKey("/", "", "default"), channelListKey("/art", "", "default"));
  assert.notEqual(channelListKey("/topics/example", "", "default"), channelListKey("/", "", "default"));
  assert.notEqual(channelListKey("/art/all", "q=a", "same"), channelListKey("/art/all", "q=b", "same"));
  assert.equal(channelListKey("/art/all", "q=a", "same"), channelListKey("/art/all", "q=a", "same"));
});

test('new channels retain searches without crossing old domain filters',()=>{
 assert.equal(channelSwitchHref('/art/all','?q=教程&category=art-practice','beauty'),'/beauty/all?q=%E6%95%99%E7%A8%8B');
 assert.equal(channelSwitchHref('/beauty/admin/content','?q=攻略','cs2',true),'/cs2/admin/content?q=%E6%94%BB%E7%95%A5');
 assert.notEqual(channelListKey('/beauty/all','','default'),channelListKey('/cs2/all','','default'));
});


test("single-fetch channel home requests use the same API scope as HTML and nested pages", async () => {
  const previous = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => { calls.push(String(input)); return Response.json({ items: [] }); };
  try {
    for (const [key, port] of [["art", 3002], ["beauty", 3003], ["cs2", 3004]] as const) {
      for (const path of [`/${key}`, `/${key}.data`, `/${key}/all.data?q=SharedQuery`]) {
        await apiGet("/api/site/pool", { request: new Request(`http://local${path}`) });
        assert.equal(calls.at(-1), `${process.env[`CHANNEL_API_BASE_${key.toUpperCase()}`] || `http://127.0.0.1:${port}`}/api/site/pool`);
      }
    }
    await apiGet("/api/site/pool", { request: new Request("http://local/artwork.data") });
    assert.equal(calls.at(-1), `${process.env.API_BASE_URL || "http://127.0.0.1:3001"}/api/site/pool`);
  } finally { globalThis.fetch = previous; }
});
