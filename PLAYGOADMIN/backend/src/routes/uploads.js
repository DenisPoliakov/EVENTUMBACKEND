import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const uploadDir = path.join(process.cwd(), 'public', 'uploads')
fs.mkdirSync(uploadDir, { recursive: true })

const imageExtensions = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
])

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${unique}${imageExtensions.get(file.mimetype)}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!imageExtensions.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'))
    }
    cb(null, true)
  },
})

const router = express.Router()

router.post(
  '/',
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (!err) return next()
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Image must not exceed 5 MB'
          : err.message || 'Invalid image'
      return res.status(400).json({ error: message })
    })
  },
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const url = `/uploads/${req.file.filename}`
    res.status(201).json({ url })
  },
)

export default router
