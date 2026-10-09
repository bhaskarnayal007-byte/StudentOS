// The mind-map tree behind a subject. Topics are a flat list in the store,
// { id, courseId, parentId, text, done, collapsed }, with parentId null for
// those directly under the subject. Plain JS so scripts/test-topics.mjs can
// import it without a bundler.

export const NODE_W = 196
export const NODE_H = 64
const GAP_X = 20
const GAP_Y = 56

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

/**
 * A tidy top-down tree. Each visible leaf takes the next column; a parent sits
 * centred over its first and last child. A collapsed topic counts as a leaf.
 * The subject itself is the root, with id null.
 *
 * Returns positions for the root and every visible topic, plus the edges and
 * the size of the whole drawing.
 */
export function layout(topics, courseId) {
  const mine = topics.filter(t => t.courseId === courseId)
  const kids = parent => mine.filter(t => t.parentId === parent)
  const nodes = []
  const edges = []
  let column = 0
  let deepest = 0

  function place(topic, depth) {
    const id = topic ? topic.id : null
    const children = topic?.collapsed ? [] : kids(id)
    deepest = Math.max(deepest, depth)

    let x
    if (children.length === 0) {
      x = column++ * (NODE_W + GAP_X)
    } else {
      const xs = children.map(child => place(child, depth + 1))
      x = (xs[0] + xs[xs.length - 1]) / 2
    }
    const y = depth * (NODE_H + GAP_Y)
    nodes.push({ topic, x, y })
    for (const child of children) edges.push({ from: id, to: child.id })
    return x
  }

  place(null, 0)

  return {
    nodes,
    edges,
    width: Math.max(1, column) * (NODE_W + GAP_X) - GAP_X,
    height: (deepest + 1) * (NODE_H + GAP_Y) - GAP_Y,
  }
}
