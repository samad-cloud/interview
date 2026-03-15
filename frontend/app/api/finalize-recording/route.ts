import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';

const BUCKET = 'interview-recordings';

interface S3UploadState {
  uploadId:     string;
  finalKey:     string;
  mimeType:     string;
  parts:        { PartNumber: number; ETag: string }[];
  partNumber:   number;
  pendingFrom:  number;
  pendingBytes: number;
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

function mergeBuffers(parts: Uint8Array[], totalSize: number): Uint8Array {
  const out = new Uint8Array(totalSize);
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.byteLength; }
  return out;
}

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const s3AccessKey = process.env.SUPABASE_S3_ACCESS_KEY_ID;
  const s3SecretKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY;
  const s3Region    = process.env.SUPABASE_S3_REGION || 'eu-west-2';

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Recording] Finalize — missing Supabase env vars');
    return NextResponse.json({ success: false, error: 'Server config error' }, { status: 500 });
  }

  try {
    const { candidateId, round, chunkCount: rawChunkCount, mimeType: rawMime } = await req.json();
    const mimeType = (rawMime || 'video/webm').split(';')[0].trim();
    const fileExt  = mimeType.includes('mp4') ? 'mp4' : 'webm';

    if (!candidateId || !round) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    }

    const supabase  = createClient(supabaseUrl, supabaseKey);
    const folder    = round === 3 ? 'round3' : round === 2 ? 'round2' : 'round1';
    const stateCol  = round === 3 ? 'round_3_s3_state' : round === 2 ? 'round_2_s3_state' : 'round_1_s3_state';
    const videoCol  = round === 3 ? 'round_3_recording_url' : round === 2 ? 'round_2_video_url' : 'video_url';

    // ── Auto-detect chunk count (needed for both paths) ───────────────────────
    let chunkCount: number = typeof rawChunkCount === 'number' && rawChunkCount > 0 ? rawChunkCount : 0;
    if (chunkCount === 0) {
      const { data: fileList, error: listError } = await supabase.storage
        .from(BUCKET).list(`chunks/${folder}/${candidateId}`, { limit: 1000 });
      if (listError || !fileList || fileList.length === 0) {
        console.error(`[Recording] Finalize — could not list chunks for candidate ${candidateId} (Round ${round})`);
        return NextResponse.json({ success: false, error: 'No chunks found in storage' });
      }
      const indices = fileList
        .map(f => { const m = f.name.match(/^chunk_(\d+)\./); return m ? parseInt(m[1]) : -1; })
        .filter(i => i >= 0);
      chunkCount = indices.length > 0 ? Math.max(...indices) + 1 : 0;
      console.log(`[Recording] Auto-detected ${chunkCount} chunks (indices: ${indices.sort((a,b)=>a-b).join(',')}) — candidate ${candidateId} (Round ${round})`);
    }

    if (chunkCount === 0) {
      return NextResponse.json({ success: false, error: 'No chunks found in storage' });
    }

    console.log(`[Recording] Finalize started — candidate ${candidateId} (Round ${round}), expecting ${chunkCount} chunks`);

    // ── Load S3 multipart state ───────────────────────────────────────────────
    const { data: row } = await supabase
      .from('candidates').select(stateCol).eq('id', candidateId).single();
    const s3State: S3UploadState | null = (row as Record<string, unknown> | null)?.[stateCol] as S3UploadState | null ?? null;

    let publicUrl: string;
    let validCount = 0;
    let totalBytes = 0;

    if (s3State && s3AccessKey && s3SecretKey) {
      // ── Path A: complete the in-progress multipart upload ─────────────────
      console.log(`[Recording] Completing multipart upload — candidate ${candidateId}, ${s3State.parts.length} parts already uploaded, pending from chunk ${s3State.pendingFrom}`);

      const s3 = makeS3Client(supabaseUrl, s3Region);

      try {
        // Download remaining pending chunks and upload as the final part
        const pendingIndices = Array.from(
          { length: chunkCount - s3State.pendingFrom },
          (_, j) => s3State.pendingFrom + j
        );

        const pendingBuffers: Uint8Array[] = [];
        for (const i of pendingIndices) {
          const { data, error } = await supabase.storage
            .from(BUCKET).download(`chunks/${folder}/${candidateId}/chunk_${i}.webm`);
          if (error || !data) {
            console.warn(`[Recording] Pending chunk ${i} missing — candidate ${candidateId}, skipping`);
            continue;
          }
          const buf = new Uint8Array(await data.arrayBuffer());
          pendingBuffers.push(buf);
          totalBytes += buf.byteLength;
          validCount++;
        }

        // Also count bytes already uploaded in completed parts
        // (we don't have the exact byte count, but log what we can)
        const completedParts = [...s3State.parts];

        if (pendingBuffers.length > 0) {
          const pendingSize = pendingBuffers.reduce((s, b) => s + b.byteLength, 0);
          const finalBody   = mergeBuffers(pendingBuffers, pendingSize);
          const { ETag } = await s3.send(new UploadPartCommand({
            Bucket: BUCKET, Key: s3State.finalKey, UploadId: s3State.uploadId,
            PartNumber: s3State.partNumber,
            Body: finalBody,
          }));
          if (!ETag) throw new Error(`No ETag for final part ${s3State.partNumber}`);
          completedParts.push({ PartNumber: s3State.partNumber, ETag });
          console.log(`[Recording] Final part ${s3State.partNumber} uploaded — ${(pendingSize / 1024 / 1024).toFixed(2)} MB`);
        }

        if (completedParts.length === 0) {
          await s3.send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: s3State.finalKey, UploadId: s3State.uploadId }));
          return NextResponse.json({ success: false, error: 'No valid chunks to assemble' });
        }

        await s3.send(new CompleteMultipartUploadCommand({
          Bucket: BUCKET, Key: s3State.finalKey, UploadId: s3State.uploadId,
          MultipartUpload: { Parts: completedParts },
        }));

        console.log(`[Recording] Multipart complete — candidate ${candidateId}, ${completedParts.length} total parts`);
        publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${s3State.finalKey}`;

        // Clear the state now that we're done
        await supabase.from('candidates').update({ [stateCol]: null }).eq('id', candidateId);

      } catch (partErr) {
        await s3.send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: s3State.finalKey, UploadId: s3State.uploadId })).catch(() => {});
        await supabase.from('candidates').update({ [stateCol]: null }).eq('id', candidateId);
        throw partErr;
      }

    } else {
      // ── Path B: no multipart state — full batched download + upload ─────────
      if (s3State) console.warn('[Recording] S3 state present but credentials missing — falling back to buffered upload');

      const timestamp = Date.now();
      const finalKey  = `${folder}/${candidateId}-${timestamp}-final.${fileExt}`;

      if (s3AccessKey && s3SecretKey) {
        // S3 creds available but no state (e.g. manual stitch from dashboard) — use streaming multipart
        const s3 = makeS3Client(supabaseUrl, s3Region);
        const { UploadId } = await s3.send(new CreateMultipartUploadCommand({
          Bucket: BUCKET, Key: finalKey, ContentType: mimeType,
        }));
        if (!UploadId) throw new Error('S3 did not return an UploadId');

        const MIN_PART_BYTES = 5 * 1024 * 1024;
        const completedParts: { PartNumber: number; ETag: string }[] = [];
        let partNumber = 1;
        let partChunks: Uint8Array[] = [];
        let partSize   = 0;

        const flushPart = async () => {
          const body = mergeBuffers(partChunks, partSize);
          partChunks = []; partSize = 0;
          const { ETag } = await s3.send(new UploadPartCommand({
            Bucket: BUCKET, Key: finalKey, UploadId: UploadId!,
            PartNumber: partNumber, Body: body,
          }));
          if (!ETag) throw new Error(`No ETag for part ${partNumber}`);
          completedParts.push({ PartNumber: partNumber, ETag });
          console.log(`[Recording] Uploaded part ${partNumber} (${(body.byteLength/1024/1024).toFixed(2)} MB) — candidate ${candidateId}`);
          partNumber++;
        };

        try {
          for (let i = 0; i < chunkCount; i++) {
            const { data, error } = await supabase.storage.from(BUCKET).download(`chunks/${folder}/${candidateId}/chunk_${i}.webm`);
            if (error || !data) { console.warn(`[Recording] Chunk ${i} missing — skipping`); continue; }
            const buf = new Uint8Array(await data.arrayBuffer());
            partChunks.push(buf); partSize += buf.byteLength; totalBytes += buf.byteLength; validCount++;
            if (partSize >= MIN_PART_BYTES) await flushPart();
          }
          if (partSize > 0) await flushPart();
          if (completedParts.length === 0) {
            await s3.send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: finalKey, UploadId: UploadId! }));
            return NextResponse.json({ success: false, error: 'No valid chunks to assemble' });
          }
          await s3.send(new CompleteMultipartUploadCommand({
            Bucket: BUCKET, Key: finalKey, UploadId: UploadId!,
            MultipartUpload: { Parts: completedParts },
          }));
          publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${finalKey}`;
        } catch (err) {
          await s3.send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: finalKey, UploadId: UploadId! })).catch(() => {});
          throw err;
        }

      } else {
        // Last resort: fully buffered upload (no S3 creds at all)
        console.warn('[Recording] No S3 credentials — using fully buffered upload (may OOM for large recordings)');
        const chunkBuffers: (ArrayBuffer | null)[] = new Array(chunkCount).fill(null);
        for (let batchStart = 0; batchStart < chunkCount; batchStart += 10) {
          const batchEnd = Math.min(batchStart + 10, chunkCount);
          const results = await Promise.all(
            Array.from({ length: batchEnd - batchStart }, async (_, j) => {
              const i = batchStart + j;
              const { data, error } = await supabase.storage.from(BUCKET).download(`chunks/${folder}/${candidateId}/chunk_${i}.webm`);
              if (error || !data) return { index: i, buffer: null };
              return { index: i, buffer: await data.arrayBuffer() };
            })
          );
          for (const r of results) { if (r.buffer) { chunkBuffers[r.index] = r.buffer; validCount++; } }
        }
        totalBytes = chunkBuffers.reduce((s, b) => s + (b ? b.byteLength : 0), 0);
        const assembled = new Uint8Array(totalBytes);
        let offset = 0;
        for (let i = 0; i < chunkBuffers.length; i++) {
          const buf = chunkBuffers[i];
          if (buf) { assembled.set(new Uint8Array(buf), offset); offset += buf.byteLength; chunkBuffers[i] = null; }
        }
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(finalKey, assembled, { contentType: mimeType, upsert: false });
        if (uploadError) {
          console.error(`[Recording] Buffered upload FAILED — candidate ${candidateId}: ${uploadError.message}`);
          return NextResponse.json({ success: false, error: uploadError.message });
        }
        publicUrl = supabase.storage.from(BUCKET).getPublicUrl(finalKey).data.publicUrl;
      }
    }

    if (!publicUrl) {
      return NextResponse.json({ success: false, error: 'Failed to get public URL' });
    }

    // ── Save URL to DB ─────────────────────────────────────────────────────────
    const { error: dbError } = await supabase
      .from('candidates').update({ [videoCol]: publicUrl }).eq('id', candidateId);
    if (dbError) {
      console.error(`[Recording] DB update FAILED — candidate ${candidateId}: ${dbError.message}`);
      return NextResponse.json({ success: false, error: dbError.message });
    }

    const sizeMB = (totalBytes / 1024 / 1024).toFixed(2);
    console.log(`[Recording] Finalized — candidate ${candidateId} (Round ${round}), ~${sizeMB} MB pending, ${validCount} pending chunks, url: ${publicUrl}`);
    return NextResponse.json({ success: true, url: publicUrl });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Recording] Finalize exception — ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

