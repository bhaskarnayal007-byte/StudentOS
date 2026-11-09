// The mind-map tree behind a subject. Topics are a flat list in the store,
// { id, courseId, parentId, text, done, collapsed }, with parentId null for
// those directly under the subject. Plain JS so scripts/test-topics.mjs can
// import it without a bundler.

export const NODE_W = 196
export const NODE_H = 64

/** Ids of every topic below `id`, at any depth. */
export function descendants(topics, id) {
  const out = []
  const walk = parent => {
    for (const t of topics) {
      if (t.parentId === parent) {
        out.push(t.id)
        walk(t.id)
      }
    }
  }
  walk(id)
  return out
}

/** Every topic under `id` and how many of them are learned. */
export function progress(topics, id) {
  const ids = new Set(descendants(topics, id))
  const below = topics.filter(t => ids.has(t.id))
  return { done: below.filter(t => t.done).length, total: below.length }
}

export const INDENT = 22
const ROW_GAP = 10

// The wide layout's columns: never narrower than COL_MIN, compact rows.
const COL_MIN = 240
const COL_GAP = 16
const ROW_H = 44
const HEAD_H = 56
const ROW_GAP_WIDE = 6
const CARD_PAD = 10

/**
 * Wide screens: each top-level topic as a card holding its own indented
 * outline. No root card: the page header already names the subject. The cards
 * fill as many columns as `width` allows, each going into the shortest column,
 * so the map never runs off the side and grows down only a column's worth at
 * a time. A card's first row is its title (`head`), tall enough for two lines.
 *
 * Returns positions for every visible topic (with w and h), the
 * cards behind each branch, the edges inside branches, and the drawing's size.
 */
export function columns(topics, courseId, width) {
  const mine = topics.filter(t => t.courseId === courseId)
  const kids = parent => mine.filter(t => t.parentId === parent)
  const count = Math.max(1, Math.floor((width + COL_GAP) / (COL_MIN + COL_GAP)))
  const colW = Math.max(COL_MIN, (width - COL_GAP * (count - 1)) / count)
  const total = count * colW + (count - 1) * COL_GAP

  const nodes = []
  const edges = []
  const cards = []
  const bottoms = Array(count).fill(0)

  for (const branch of kids(null)) {
    const c = bottoms.indexOf(Math.min(...bottoms))
    const x0 = c * (colW + COL_GAP)
    const y0 = bottoms[c]
    let y = y0 + CARD_PAD
    const place = (topic, depth) => {
      const x = x0 + CARD_PAD + depth * INDENT
      const w = Math.max(120, colW - CARD_PAD * 2 - depth * INDENT)
      const h = depth ? ROW_H : HEAD_H
      nodes.push({ topic, x, y, w, h, head: !depth })
      y += h + ROW_GAP_WIDE
      for (const child of topic.collapsed ? [] : kids(topic.id)) {
        edges.push({ from: topic.id, to: child.id })
        place(child, depth + 1)
      }
    }
    place(branch, 0)
    const h = y - ROW_GAP_WIDE + CARD_PAD - y0
    cards.push({ id: branch.id, x: x0, y: y0, w: colW, h })
    bottoms[c] = y0 + h + COL_GAP
  }

  const height = cards.length ? Math.max(...bottoms) - COL_GAP : NODE_H
  return { nodes, edges, cards, width: total, height }
}

/**
 * The same tree as an indented outline, for phones: one topic per row in
 * reading order, each child indented under its parent. Nothing goes sideways,
 * so it reads top to bottom on a narrow screen. Nodes stretch to `width` (the
 * space available) minus their indent, and never narrower than `minW`.
 */
export function outline(topics, courseId, width, minW = 150) {
  const mine = topics.filter(t => t.courseId === courseId)
  const kids = parent => mine.filter(t => t.parentId === parent)
  const nodes = []
  const edges = []
  let widest = 0

  function place(topic, depth) {
    const id = topic ? topic.id : null
    const x = depth * INDENT
    const w = Math.max(minW, width - x)
    widest = Math.max(widest, x + w)
    nodes.push({ topic, x, y: nodes.length * (NODE_H + ROW_GAP), w, depth })
    for (const child of topic?.collapsed ? [] : kids(id)) {
      edges.push({ from: id, to: child.id })
      place(child, depth + 1)
    }
  }

  place(null, 0)

  return { nodes, edges, width: widest, height: nodes.length * (NODE_H + ROW_GAP) - ROW_GAP }
}
