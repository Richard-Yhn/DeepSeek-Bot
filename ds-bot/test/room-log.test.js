import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ROOM_LOG_DEFAULT, ROOM_LOG_KEPT, roomLogPage } from '../src/host/room-log.js'

const room = (count, extra = {}) => ({
  seq: count,
  log: Array.from({ length: count }, (_, index) => ({
    seq: index + 1,
    who: index % 2 === 0 ? 'User' : 'Bot',
    text: `line ${index + 1}`,
  })),
  ...extra,
})

test('the newest page comes back when no cursor is given', () => {
  const page = roomLogPage(room(30))
  assert.equal(page.lines.length, ROOM_LOG_DEFAULT)
  assert.equal(page.lines[0].text, 'line 11')
  assert.equal(page.lines.at(-1).text, 'line 30')
  assert.deepEqual(page.cursor, { before: 11 })
})

test('a whole log shorter than a page has no cursor', () => {
  const page = roomLogPage(room(5))
  assert.equal(page.lines.length, 5)
  assert.equal(page.cursor, null)
  assert.equal(page.kept, 5)
  assert.equal(page.seq, 5)
})

test('paging back by seq walks to the start and stops', () => {
  const first = roomLogPage(room(5), { limit: 2 })
  assert.deepEqual(first.lines.map(line => line.text), ['line 4', 'line 5'])
  assert.deepEqual(first.cursor, { before: 4 })

  const second = roomLogPage(room(5), { limit: 2, before: first.cursor.before })
  assert.deepEqual(second.lines.map(line => line.text), ['line 2', 'line 3'])
  assert.deepEqual(second.cursor, { before: 2 })

  const third = roomLogPage(room(5), { limit: 2, before: second.cursor.before })
  assert.deepEqual(third.lines.map(line => line.text), ['line 1'])
  assert.equal(third.cursor, null)
})

test('the limit is clamped to what a host keeps', () => {
  assert.equal(roomLogPage(room(30), { limit: 999 }).lines.length, 30)
  assert.equal(roomLogPage(room(30), { limit: 0 }).limit, 1)
  assert.equal(roomLogPage(room(30), { limit: -5 }).lines.length, 1)
  assert.equal(roomLogPage(room(30), { limit: 'big' }).limit, ROOM_LOG_DEFAULT)
  assert.equal(roomLogPage(room(ROOM_LOG_KEPT), { limit: 999 }).lines.length, ROOM_LOG_KEPT)
})

test('a cut line keeps its length and the head it was stored with', () => {
  const page = roomLogPage({
    seq: 1,
    log: [{ seq: 1, who: 'Bot', text: 'head…', length: 9000 }],
  })
  const line = page.lines[0]
  assert.equal(line.text, 'head…')
  assert.equal(line.length, 9000)
})

test('a line carries only the fields it has', () => {
  const page = roomLogPage({
    seq: 2,
    log: [
      { seq: 1, who: 'User', text: 'plain' },
      { seq: 2, who: 'Lookup', botId: 'bot-1', kind: 'lookup', text: '', files: [{ name: 'a.png' }] },
      { seq: 3, who: 'Files', botId: 'bot-2', text: 'two', files: [] },
    ],
  })
  const [plain, lookup, emptyFiles] = page.lines
  assert.deepEqual(Object.keys(plain), ['seq', 'who', 'text'])
  assert.equal(lookup.kind, 'lookup')
  assert.equal(lookup.botId, 'bot-1')
  assert.deepEqual(lookup.files, [{ name: 'a.png' }])
  assert.equal(emptyFiles.files, undefined)
})

test('a room with no log answers with an empty page', () => {
  const page = roomLogPage({ seq: 0 })
  assert.deepEqual(page.lines, [])
  assert.equal(page.cursor, null)
  assert.equal(page.kept, 0)
  assert.equal(page.limit, ROOM_LOG_DEFAULT)
})

test('an unknown room does not throw', () => {
  const page = roomLogPage(undefined)
  assert.deepEqual(page.lines, [])
  assert.equal(page.seq, 0)
})

test('a cursor past the newest line still answers the newest page', () => {
  const page = roomLogPage(room(10), { before: 999 })
  assert.equal(page.lines.at(-1).text, 'line 10')
  assert.equal(page.cursor, null)
})
