-- Separate migration if DB already applied previous enum values
ALTER TYPE "ChatMessageType" ADD VALUE IF NOT EXISTS 'ALBUM';
