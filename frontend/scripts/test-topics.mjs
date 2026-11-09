import assert from "node:assert/strict";
import { INDENT, columns, descendants, outline, progress } from "../src/lib/topics.js";

// Chemistry → Organic (Alkanes, Alkenes), Inorganic. Biology is another subject.
const t = (id, parentId, extra = {}) => ({ id, courseId: "chem", parentId, text: id, done: false, collapsed: false, ...extra });
const topics = [
  t("organic", null),
  t("alkanes", "organic", { done: true }),
  t("alkenes", "organic"),
  t("inorganic", null),
  { ...t("cells", null), courseId: "bio" },
];

const at = (tree, id) => tree.nodes.find((n) => (n.topic ? n.topic.id : null) === id);

// Wide screens: the subject on top, a card per top-level branch, packed into
// as many columns as fit, never wider than the space given.
let tree = columns(topics, "chem", 1000);
assert.equal(tree.nodes.length, 4, "the 4 chem topics, no biology, no root card");
assert.ok(tree.width <= 1000, "fits the width given");
assert.equal(tree.cards.length, 2, "one card per top-level topic");
assert.notEqual(tree.cards[0].x, tree.cards[1].x, "two branches sit side by side, not stacked");
assert.ok(at(tree, "alkanes").x > at(tree, "organic").x, "sub-topics indented under their topic");
assert.ok(at(tree, "alkanes").y > at(tree, "organic").y, "and below it");
assert.equal(tree.edges.length, 2, "lines inside branches only");

// Many branches wrap into rows instead of running off the side.
const many = Array.from({ length: 30 }, (_, i) => t(`b${i}`, null));
tree = columns(many, "chem", 1000);
assert.ok(tree.width <= 1000);
assert.ok(tree.height < 30 * 60, "shorter than one long list");
// A narrow space still gets one full column.
tree = columns(many, "chem", 100);
assert.equal(new Set(tree.cards.map((c) => c.x)).size, 1);

// Folding a branch hides everything under it.
tree = columns(topics.map((x) => (x.id === "organic" ? { ...x, collapsed: true } : x)), "chem", 1000);
assert.equal(tree.nodes.length, 2, "organic, inorganic");
assert.equal(at(tree, "alkanes"), undefined);

// Deleting a topic takes its whole branch; progress counts the branch.
assert.deepEqual(descendants(topics, "organic").sort(), ["alkanes", "alkenes"]);
assert.deepEqual(descendants(topics, "inorganic"), []);
assert.deepEqual(progress(topics, "organic"), { done: 1, total: 2 });

// An empty subject draws nothing (the page shows its "add the first topic" hint).
tree = columns([], "chem", 1000);
assert.equal(tree.nodes.length, 0);

// Phones: an outline, one row per topic in reading order, children indented.
tree = outline(topics, "chem", 300);
assert.deepEqual(tree.nodes.map((n) => (n.topic ? n.topic.id : null)), [null, "organic", "alkanes", "alkenes", "inorganic"]);
assert.ok(tree.nodes.every((n, i) => i === 0 || n.y > tree.nodes[i - 1].y), "each row below the last");
assert.equal(at(tree, "alkanes").x, 2 * INDENT, "sub-topics indented twice");
assert.equal(at(tree, "organic").w, 300 - INDENT, "rows fill the width left after the indent");
assert.ok(tree.width <= 300, "fits the space given");
assert.equal(tree.edges.length, 4);
tree = outline(topics.map((x) => (x.id === "organic" ? { ...x, collapsed: true } : x)), "chem", 300);
assert.equal(tree.nodes.length, 3, "folding hides the branch in the outline too");

console.log("topics: ok");
