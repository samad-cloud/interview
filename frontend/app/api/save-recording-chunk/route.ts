import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';

const BUCKET = 'interview-recordings';
// S3 minimum part size (all parts except the last must be ≥ 5 MB)
const MIN_PART_BYTES = 5 * 1024 * 1024;

interface S3UploadState {
  uploadId:     string;
  finalKey:     string;
  mimeType:     string;
  parts:        { PartNumber: number; ETag: string }[];
  partNumber:   number;
  pendingFrom:  number; // first chunk index not yet in a completed part
  pendingBytes: number; // total bytes accumulated in the pending range
}

function makeS3Client(supabaseUrl: string, region: string): S3Client {
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
  return new S3Client({
    region,
    endpoint: `https://${projectRef}.supabase.co/storage/v1/s3`,
    credentials: {
      accessKeyId:     process.env.SUPABASE_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });
}

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const s3AccessKey = process.env.SUPABASE_S3_ACCESS_KEY_ID;
  const s3SecretKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY;
  const s3Region    = process.env.SUPABASE_S3_REGION || 'eu-west-2';

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ success: false, error: 'Server config error' }, { status: 500 });
  }

  try {
    const formData    = await req.formData();
    const candidateId = formData.get('candidateId') as string;
    const chunkIndex  = parseInt(formData.get('chunkIndex') as string, 10);
    const round       = formData.get('round') as string;
    const mimeType    = ((formData.get('mimeType') as string) || 'video/webm').split(';')[0].trim();
    const chunk       = formData.get('chunk') as File | null;

    if (!candidateId || isNaN(chunkIndex) || !round || !chunk) {
      console.error('[Recording] Save chunk — missing fields', { candidateId, chunkIndex, round, hasChunk: !!chunk });
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    }

    const chunkBuffer = await chunk.arrayBuffer();
    const sizeKB      = (chunkBuffer.byteLength / 1024).toFixed(1);
    const folder      = round === '3' ? 'round3' : round === '2' ? 'round2' : 'round1';
    const filePath    = `chunks/${folder}/${candidateId}/chunk_${chunkIndex}.webm`;
    const stateCol    = round === '3' ? 'round_3_s3_state' : round === '2' ? 'round_2_s3_state' : 'round_1_s3_state';

    console.log(`[Recording] Chunk ${chunkIndex} received — candidate ${candidateId} (Round ${round}), size: ${sizeKB}KB`);

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── 1. Save chunk to storage (always — backup for finalize fallback) ────────
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, new Uint8Array(chunkBuffer), { contentType: mimeType, upsert: true });

    if (storageError) {
      console.error(`[Recording] Chunk ${chunkIndex} storage FAILED — candidate ${candidateId}: ${storageError.message}`);
      return NextResponse.json({ success: false, error: storageError.message });
    }

    // ── 2. S3 multipart: accumulate and flush parts ─────────────────────────────
    // Skip silently if S3 creds not configured — finalize will fall back to buffered upload
    if (s3AccessKey && s3SecretKey) {
      try {
        // Load current state
        const { data: row } = await supabase
          .from('candidates')
          .select(stateCol)
          .eq('id', candidateId)
          .single();

        let state: S3UploadState | null = (row as Record<string, unknown> | null)?.[stateCol] as S3UploadState | null ?? null;
        const s3 = makeS3Client(supabaseUrl, s3Region);

        // Chunk 0: initiate the multipart upload
        if (!state) {
          const fileExt  = mimeType.includes('mp4') ? 'mp4' : 'webm';
          const finalKey = `${folder}/${candidateId}-${Date.now()}-final.${fileExt}`;
          const { UploadId } = await s3.send(new CreateMultipartUploadCommand({
            Bucket: BUCKET, Key: finalKey, ContentType: mimeType,
          }));
          if (!UploadId) throw new Error('S3 did not return an UploadId');
          console.log(`[Recording] Multipart upload initiated — candidate ${candidateId} (Round ${round}), key: ${finalKey}`);
          state = { uploadId: UploadId, finalKey, mimeType, parts: [], partNumber: 1, pendingFrom: 0, pendingBytes: 0 };
        }

        state.pendingBytes += chunkBuffer.byteLength;

        const pendingMB   = (state.pendingBytes / 1024 / 1024).toFixed(2);
        const thresholdMB = (MIN_PART_BYTES   / 1024 / 1024).toFixed(0);
        console.log(`[Recording] Multipart state — candidate ${candidateId} (Round ${round}): chunk ${chunkIndex}, parts completed: ${state.parts.length}, pending: ${pendingMB}MB / ${thresholdMB}MB threshold, uploadId: ${state.uploadId.slice(0, 8)}...`);

        // Flush a part once we've accumulated ≥ 5 MB
        if (state.pendingBytes >= MIN_PART_BYTES) {
          // Download all pending chunks (pendingFrom..chunkIndex-1) from storage and combine with current
          const pendingIndices = Array.from(
            { length: chunkIndex - state.pendingFrom },
            (_, j) => state!.pendingFrom + j
          );

          const previousBuffers = await Promise.all(
            pendingIndices.map(async (i) => {
              const { data, error } = await supabase.storage
                .from(BUCKET).download(`chunks/${folder}/${candidateId}/chunk_${i}.webm`);
              if (error || !data) throw new Error(`Failed to re-download chunk ${i} for part flush`);
              return new Uint8Array(await data.arrayBuffer());
            })
          );

          // Combine previous chunks + current chunk into one part body
          const partSize = previousBuffers.reduce((s, b) => s + b.byteLength, 0) + chunkBuffer.byteLength;
          const partBody = new Uint8Array(partSize);
          let offset = 0;
          for (const buf of previousBuffers) { partBody.set(buf, offset); offset += buf.byteLength; }
          partBody.set(new Uint8Array(chunkBuffer), offset);

          const { ETag } = await s3.send(new UploadPartCommand({
            Bucket: BUCKET, Key: state.finalKey, UploadId: state.uploadId,
            PartNumber: state.partNumber,
            Body: partBody,
          }));
          if (!ETag) throw new Error(`No ETag returned for part ${state.partNumber}`);

          console.log(`[Recording] Part ${state.partNumber} uploaded — candidate ${candidateId}, ${(partSize / 1024 / 1024).toFixed(2)} MB`);
          state.parts.push({ PartNumber: state.partNumber, ETag });
          state.partNumber++;
          state.pendingFrom  = chunkIndex + 1;
          state.pendingBytes = 0;
        }

        // Persist updated state
        await supabase.from('candidates').update({ [stateCol]: state }).eq('id', candidateId);

      } catch (s3Err) {
        // S3 failure must not fail the chunk save — log and abort the multipart upload
        const msg = s3Err instanceof Error ? s3Err.message : String(s3Err);
        console.error(`[Recording] S3 multipart error on chunk ${chunkIndex} — candidate ${candidateId}: ${msg}. Aborting multipart, finalize will fall back to buffered upload.`);

        // Best-effort abort + clear state so finalize uses the fallback path
        try {
          const { data: row } = await supabase.from('candidates').select(stateCol).eq('id', candidateId).single();
          const badState: S3UploadState | null = (row as Record<string, unknown> | null)?.[stateCol] as S3UploadState | null ?? null;
          if (badState?.uploadId) {
            const s3 = makeS3Client(supabaseUrl, s3Region);
            await s3.send(new AbortMultipartUploadCommand({
              Bucket: BUCKET, Key: badState.finalKey, UploadId: badState.uploadId,
            }));
          }
        } catch { /* ignore abort errors */ }
        await supabase.from('candidates').update({ [stateCol]: null }).eq('id', candidateId);
      }
    }

    console.log(`[Recording] Chunk ${chunkIndex} saved — candidate ${candidateId} (Round ${round})`);
    return NextResponse.json({ success: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Recording] Chunk upload exception: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
