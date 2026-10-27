import assert from "node:assert/strict";
import { INDENT, descendants, layout, outline, progress } from "../src/lib/topics.js";

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

// Leaves take a column each; a parent is centred over its children.
let tree = layout(topics, "chem");
assert.equal(tree.nodes.length, 5, "root + 4 chem topics, no biology");
const organic = at(tree, "organic");
assert.equal(organic.x, (at(tree, "alkanes").x + at(tree, "alkenes").x) / 2);
assert.ok(at(tree, "alkanes").y > organic.y, "children sit below their parent");
assert.equal(at(tree, null).x, (organic.x + at(tree, "inorganic").x) / 2, "subject centred over its topics");
assert.equal(tree.edges.length, 4);

// Folding a branch hides everything under it and makes it a leaf.
tree = layout(topics.map((x) => (x.id === "organic" ? { ...x, collapsed: true } : x)), "chem");
assert.equal(tree.nodes.length, 3, "root, organic, inorganic");
assert.equal(at(tree, "alkanes"), undefined);

// Deleting a topic takes its whole branch; progress counts the branch.
assert.deepEqual(descendants(topics, "organic").sort(), ["alkanes", "alkenes"]);
assert.deepEqual(descendants(topics, "inorganic"), []);
assert.deepEqual(progress(topics, "organic"), { done: 1, total: 2 });

// An empty subject is just the root.
tree = layout([], "chem");
assert.equal(tree.nodes.length, 1);
assert.ok(tree.width > 0 && tree.height > 0);

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
