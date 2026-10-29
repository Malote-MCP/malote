import assert from "node:assert/strict";
import { test } from "node:test";
import { matcher, normalizeText } from "../src/queries.ts";

test("normalizeText drops accents and case", () => {
  assert.equal(normalizeText("Ação São JOÃO"), "acao sao joao");
});

test("all words must appear, in any order and field", () => {
  const m = matcher("contrato rafael");
  assert.ok(m("O Rafael mandou o contrato"));
  assert.ok(m("contrato.pdf", "de Rafael"));
  assert.ok(!m("só o contrato"));
});

test("accents in the query or the text do not matter", () => {
  assert.ok(matcher("reuniao")("Reunião amanhã"));
  assert.ok(matcher("Reunião")("reuniao amanha"));
});

test("quoted query matches the exact phrase", () => {
  const m = matcher('"chego às 19h"');
  assert.ok(m("ok, chego as 19h"));
  assert.ok(!m("19h eu chego"));
});

test("null fields are ignored", () => {
  assert.ok(!matcher("oi")(null, undefined));
});
