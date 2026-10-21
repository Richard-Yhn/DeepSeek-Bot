// One page of a room's kept lines, for a client that draws the group chat itself.
//
// `state` carries only the last line of each room as `preview` — channel.js strips
// `log` out of every room — so a window that is not this one has had no way to read
// back what a room said. The lines here are the same ones the members read: newest
// last, at most ROOM_LOG_KEPT of them, a long one marked `length` with its whole text
// kept beside the state file (`file-text` still fetches that).

export const ROOM_LOG_KEPT = 60
export const ROOM_LOG_DEFAULT = 20

const LIMIT_MIN = 1
const LIMIT_MAX = ROOM_LOG_KEPT

// A line the way `state.rooms[].log` holds it, minus the host's own bookkeeping:
// `length` only when the text was cut, `files` only when the post carried any.
const wireLine = (line) => ({
  seq: line.seq,
  who: String(line.who ?? ''),
  ...(line.botId === undefined ? {} : { botId: line.botId }),
  ...(line.kind === undefined ? {} : { kind: line.kind }),
  ...(line.length === undefined ? {} : { length: line.length }),
  ...(Array.isArray(line.files) && line.files.length > 0 ? { files: line.files } : {}),
  text: typeof line.text === 'string' ? line.text : '',
})

const clamp = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return ROOM_LOG_DEFAULT
  return Math.min(Math.max(Math.trunc(number), LIMIT_MIN), LIMIT_MAX)
}

// `before` is the seq of the oldest line the caller already holds; the page that comes
// back is the newest `limit` lines older than it. `cursor` is null once nothing older is
// left — either the log was read to its start, or the host has dropped those lines (it
// keeps ROOM_LOG_KEPT, which `kept` reports).
export const roomLogPage = (room, cursor = {}) => {
  const log = Array.isArray(room?.log) ? room.log : []
  const limit = clamp(cursor?.limit)
  const before = Number.isInteger(cursor?.before) ? cursor.before : undefined
  const older = before === undefined ? log : log.filter(line => line.seq < before)
  const page = older.slice(-limit)
  const more = older.length > page.length
  return {
    seq: typeof room?.seq === 'number' ? room.seq : 0,
    kept: log.length,
    limit,
    lines: page.map(wireLine),
    cursor: more && page.length > 0 ? { before: page[0].seq } : null,
  }
}
