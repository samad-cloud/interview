-- Track in-progress S3 multipart upload state per round.
-- Allows save-recording-chunk to progressively upload parts during the interview
-- so finalize-recording only needs to complete the upload rather than re-assemble.
--
-- State shape (JSONB):
-- {
--   "uploadId":    string,               -- S3 multipart upload ID
--   "finalKey":    string,               -- destination object key in the bucket
--   "mimeType":    string,               -- e.g. "video/webm"
--   "parts":       [{PartNumber, ETag}], -- completed parts
--   "partNumber":  number,               -- next part number to use
--   "pendingFrom": number,               -- first chunk index not yet in a completed part
--   "pendingBytes": number               -- accumulated bytes in the pending range
-- }

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS round_1_s3_state JSONB,
  ADD COLUMN IF NOT EXISTS round_2_s3_state JSONB,
  ADD COLUMN IF NOT EXISTS round_3_s3_state JSONB;
