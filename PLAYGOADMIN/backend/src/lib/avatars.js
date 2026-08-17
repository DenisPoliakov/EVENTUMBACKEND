import fs from 'fs'
import path from 'path'

import multer from 'multer'

const imageExtensions = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
])

export const avatarUploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
fs.mkdirSync(avatarUploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarUploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${unique}${imageExtensions.get(file.mimetype) || '.jpg'}`)
  },
})

export const avatarUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!imageExtensions.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'))
    }
    return cb(null, true)
  },
})

export const removeAvatarFile = (url) => {
  if (!url || typeof url !== 'string') return
  if (!url.startsWith('/uploads/avatars/') && !url.startsWith('/uploads/players/')) return
  const filePath = path.join(process.cwd(), 'public', path.normalize(url).replace(/^[/\\]+/, ''))
  fs.promises.unlink(filePath).catch(() => {})
}

export const toPublicAvatarUrl = (filename) => `/uploads/avatars/${filename}`
