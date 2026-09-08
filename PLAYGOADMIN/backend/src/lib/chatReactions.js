export const CHAT_REACTION_MAX_PER_USER = 3
export const CHAT_REACTION_EMOJI_MAX_CHARS = 32

/**
 * Один стандартный Unicode-эмодзи (включая ZWJ/skin-tone sequences).
 * Без кастомных sticker-id — iOS/Android рисуют системным шрифтом одинаковый код.
 */
export const normalizeReactionEmoji = (raw) => {
  const value = String(raw ?? '')
    .normalize('NFC')
    .trim()
  if (!value || value.length > CHAT_REACTION_EMOJI_MAX_CHARS) return null
  if (/\s/.test(value)) return null

  let graphemes
  try {
    graphemes = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(value)].map(
      (item) => item.segment,
    )
  } catch {
    graphemes = [...value]
  }
  if (graphemes.length !== 1) return null

  const emoji = graphemes[0]
  try {
    const hasEmoji =
      /\p{Extended_Pictographic}/u.test(emoji) ||
      /\p{Emoji_Presentation}/u.test(emoji) ||
      (/\p{Emoji}/u.test(emoji) && /[\uFE0F\u20E3]/u.test(emoji))
    if (!hasEmoji) return null
  } catch {
    // Node без Unicode property escapes — грубый fallback
    if (/^[\w.,;:!?\-@#$%^&*()[\]{}<>/\\|+=~`"']+$/u.test(emoji)) return null
  }

  return emoji
}
