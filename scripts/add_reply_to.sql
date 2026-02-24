-- Add reply_to column to messages table for WhatsApp-style message replies
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES messages(id);
