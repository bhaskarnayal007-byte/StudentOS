import assert from "node:assert/strict";
import { chatTitle, cleanBody, layoutMessages, preview, senderName, MAX_BODY } from "../src/lib/chatFormat.js";

const me = "u-me";
const ana = { user_id: "u-ana", tag: "ana", name: "Ana" };
const raj = { user_id: "u-raj", tag: "raj", name: "" };
const dm = { is_group: false, members: [{ user_id: me, tag: "me", name: "Me" }, ana] };
const group = { is_group: true, title: "Chem lab", members: [{ user_id: me }, ana, raj] };

// Bodies: trimmed, empty refused, capped.
assert.equal(cleanBody("  hi \n"), "hi");
assert.equal(cleanBody("   "), null);
assert.equal(cleanBody(undefined), null);
assert.equal(cleanBody("x".repeat(MAX_BODY + 50)).length, MAX_BODY);

// Titles: the group's name, or the other person (name, else @tag).
assert.equal(chatTitle(group, me), "Chem lab");
assert.equal(chatTitle(dm, me), "Ana");
assert.equal(chatTitle({ is_group: false, members: [{ user_id: me }, raj] }, me), "@raj");

// Senders and list previews.
assert.equal(senderName(group, me, me), "You");
assert.equal(senderName(group, "u-raj", me), "@raj");
assert.equal(preview({ ...dm, last_body: "see you\nat 5", last_sender: "u-ana" }, me), "see you at 5");
assert.equal(preview({ ...dm, last_body: "ok", last_sender: me }, me), "You: ok");
assert.equal(preview({ ...group, last_body: "lab at 3", last_sender: "u-ana" }, me), "Ana: lab at 3");
assert.equal(preview({ ...group, last_body: null }, me), "Group created");

// Layout: a header per day, sender runs marked.
const now = new Date(2026, 9, 27, 12, 0);
const at = (d, h) => new Date(2026, 9, d, h).toISOString();
const rows = layoutMessages([
  { id: "1", sender: "u-ana", created_at: at(26, 9) },
  { id: "2", sender: "u-ana", created_at: at(26, 10) },
  { id: "3", sender: me, created_at: at(27, 9) },
  { id: "4", sender: me, created_at: at(27, 10) },
  { id: "5", sender: "u-ana", created_at: at(27, 11) },
], now);
assert.deepEqual(rows.map((r) => (r.type === "day" ? r.label : `${r.message.id}${r.first ? "*" : ""}`)),
  ["Yesterday", "1*", "2", "Today", "3*", "4", "5*"]);

console.log("chat: ok");
