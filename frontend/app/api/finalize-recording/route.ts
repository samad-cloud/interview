import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';

// S3 multipart: all parts except the last must be ≥ 5 MB
const MIN_PART_BYTES = 5 * 1024 * 1024;
const BUCKET = 'interview-recordings';

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
  const s3Region   = process.env.SUPABASE_S3_REGION || 'eu-west-2';

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Recording] Finalize — missing Supabase env vars');
    return NextResponse.json({ success: false, error: 'Server config error' }, { status: 500 });
  }
  if (!s3AccessKey || !s3SecretKey) {
    console.error('[Recording] Finalize — missing S3 credentials, falling back to buffered upload');
  }

  try {
    const { candidateId, round, chunkCount: rawChunkCount, mimeType: rawMime } = await req.json();
    const mimeType = (rawMime || 'video/webm').split(';')[0].trim();
    const fileExt  = mimeType.includes('mp4') ? 'mp4' : 'webm';

    if (!candidateId || !round) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const folder = round === 3 ? 'round3' : round === 2 ? 'round2' : 'round1';

    // ── Auto-detect chunk count ────────────────────────────────────────────────
    let chunkCount: number = typeof rawChunkCount === 'number' && rawChunkCount > 0 ? rawChunkCount : 0;
    if (chunkCount === 0) {
      const { data: fileList, error: listError } = await supabase.storage
        .from(BUCKET)
        .list(`chunks/${folder}/${candidateId}`, { limit: 1000 });
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

    const timestamp = Date.now();
    const finalKey  = `${folder}/${candidateId}-${timestamp}-final.${fileExt}`;
    let publicUrl: string;
    let validCount = 0;
    let totalBytes = 0;

    if (s3AccessKey && s3SecretKey) {
      // ── Path A: S3 multipart streaming — O(5 MB) peak memory ─────────────────
      const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
      const s3Endpoint = `https://${projectRef}.supabase.co/storage/v1/s3`;

      const s3 = new S3Client({
        region: s3Region,
        endpoint: s3Endpoint,
        credentials: { accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey },
        forcePathStyle: true,
      });

      // Initiate multipart upload
      const { UploadId } = await s3.send(new CreateMultipartUploadCommand({
        Bucket: BUCKET,
        Key: finalKey,
        ContentType: mimeType,
      }));

      if (!UploadId) throw new Error('S3 did not return an UploadId');
      console.log(`[Recording] S3 multipart upload initiated — UploadId: ${UploadId}`);

      const completedParts: { PartNumber: number; ETag: string }[] = [];
      let partNumber = 1;
      let partChunks: Uint8Array[] = [];
      let partSize   = 0;

      const flushPart = async () => {
        const body = mergeBuffers(partChunks, partSize);
        partChunks = [];
        partSize   = 0;
        const { ETag } = await s3.send(new UploadPartCommand({
          Bucket: BUCKET, Key: finalKey, UploadId,
          PartNumber: partNumber,
          Body: body,
        }));
        if (!ETag) throw new Error(`No ETag returned for part ${partNumber}`);
        completedParts.push({ PartNumber: partNumber, ETag });
        console.log(`[Recording] Uploaded part ${partNumber} (${(body.byteLength / 1024 / 1024).toFixed(2)} MB) — candidate ${candidateId}`);
        partNumber++;
      };

      try {
        for (let i = 0; i < chunkCount; i++) {
          const path = `chunks/${folder}/${candidateId}/chunk_${i}.webm`;
          const { data, error } = await supabase.storage.from(BUCKET).download(path);
          if (error || !data) {
            console.warn(`[Recording] Chunk ${i} missing — candidate ${candidateId}, skipping`);
            continue;
          }
          const buf = new Uint8Array(await data.arrayBuffer());
          partChunks.push(buf);
          partSize   += buf.byteLength;
          totalBytes += buf.byteLength;
          validCount++;

          // Upload accumulated data as a part once it hits the 5 MB minimum
          if (partSize >= MIN_PART_BYTES) await flushPart();
        }

        // Final part — can be any size (including < 5 MB)
        if (partSize > 0) await flushPart();

        if (completedParts.length === 0) {
          await s3.send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: finalKey, UploadId }));
          return NextResponse.json({ success: false, error: 'No valid chunks to assemble' });
        }

        await s3.send(new CompleteMultipartUploadCommand({
          Bucket: BUCKET, Key: finalKey, UploadId,
          MultipartUpload: { Parts: completedParts },
        }));
        console.log(`[Recording] S3 multipart complete — ${completedParts.length} parts, ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

      } catch (partErr) {
        // Abort the incomplete multipart upload to avoid orphaned storage charges
        await s3.send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: finalKey, UploadId })).catch(() => {});
        throw partErr;
      }

      publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${finalKey}`;

    } else {
      // ── Path B: fallback buffered upload (no S3 creds) ────────────────────────
      console.warn('[Recording] S3 credentials not set — using buffered upload (may OOM for large recordings)');
      const chunkBuffers: (ArrayBuffer | null)[] = new Array(chunkCount).fill(null);

      for (let batchStart = 0; batchStart < chunkCount; batchStart += 10) {
        const batchEnd = Math.min(batchStart + 10, chunkCount);
        const results = await Promise.all(
          Array.from({ length: batchEnd - batchStart }, async (_, j) => {
            const i = batchStart + j;
            const { data, error } = await supabase.storage
              .from(BUCKET).download(`chunks/${folder}/${candidateId}/chunk_${i}.webm`);
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

      const { error: uploadError } = await supabase.storage
        .from(BUCKET).upload(finalKey, assembled, { contentType: mimeType, upsert: false });
      if (uploadError) {
        console.error(`[Recording] Buffered upload FAILED — candidate ${candidateId}: ${uploadError.message}`);
        return NextResponse.json({ success: false, error: uploadError.message });
      }
      publicUrl = supabase.storage.from(BUCKET).getPublicUrl(finalKey).data.publicUrl;
    }

    console.log(`[Recording] Downloaded ${validCount}/${chunkCount} chunks — candidate ${candidateId} (Round ${round})`);

    if (!publicUrl) {
      return NextResponse.json({ success: false, error: 'Failed to get public URL' });
    }

    // ── Save URL to DB ─────────────────────────────────────────────────────────
    const videoColumn = round === 3 ? 'round_3_recording_url' : round === 2 ? 'round_2_video_url' : 'video_url';
    const { error: dbError } = await supabase
      .from('candidates').update({ [videoColumn]: publicUrl }).eq('id', candidateId);

    if (dbError) {
      console.error(`[Recording] DB update FAILED — candidate ${candidateId}: ${dbError.message}`);
      return NextResponse.json({ success: false, error: dbError.message });
    }

    const sizeMB = (totalBytes / 1024 / 1024).toFixed(2);
    console.log(`[Recording] Finalized — candidate ${candidateId} (Round ${round}), ${sizeMB} MB, ${validCount}/${chunkCount} chunks, url: ${publicUrl}`);
    return NextResponse.json({ success: true, url: publicUrl });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Recording] Finalize exception — ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
