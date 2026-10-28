import assert from 'node:assert/strict'
import test from 'node:test'

import { slugify } from '../src/lib/slugify.ts'

test('slugify транслитерирует кириллицу в латиницу', () => {
  assert.equal(slugify('Привет мир'), 'privet-mir')
  assert.equal(slugify('Ёж'), 'ezh')
  assert.equal(slugify('Щука'), 'schuka')
})

test('slugify подставляет fallback для пустой строки', () => {
  assert.equal(slugify('   '), 'item')
  assert.equal(slugify('---', 'club'), 'club')
})
