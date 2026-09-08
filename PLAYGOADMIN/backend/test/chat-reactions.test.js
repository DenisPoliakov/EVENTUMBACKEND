import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeReactionEmoji } from '../src/lib/chatReactions.js'

test('normalizeReactionEmoji accepts common unicode emoji', () => {
  assert.equal(normalizeReactionEmoji('🔥'), '🔥')
  assert.equal(normalizeReactionEmoji('👍'), '👍')
  assert.equal(normalizeReactionEmoji('❤️'), '❤️')
  assert.equal(normalizeReactionEmoji(' 😂 '), '😂')
})

test('normalizeReactionEmoji rejects non-emoji', () => {
  assert.equal(normalizeReactionEmoji('abc'), null)
  assert.equal(normalizeReactionEmoji('🔥👍'), null)
  assert.equal(normalizeReactionEmoji(''), null)
  assert.equal(normalizeReactionEmoji('12'), null)
})
