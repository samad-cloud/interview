import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';


export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer service role key (bypasses RLS) — falls back to anon key
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Recording] Finalize — missing Supabase env vars');
    return NextResponse.json({ success: false, error: 'Server config error' }, { status: 500 });
  }

  try {
    const { candidateId, round, chunkCount: rawChunkCount, mimeType: rawMime } = await req.json();
    // Strip codec specifier — Supabase only accepts base MIME types (e.g. video/webm not video/webm;codecs=vp9)
    const mimeType = (rawMime || 'video/webm').split(';')[0].trim();
    const fileExt  = mimeType.includes('mp4') ? 'mp4' : 'webm';

    if (!candidateId || !round) {
      console.error('[Recording] Finalize — missing fields', { candidateId, round });
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const folder = round === 3 ? 'round3' : round === 2 ? 'round2' : 'round1';

    // Auto-detect chunk count from storage if not provided (e.g. manual stitch from dashboard)
    let chunkCount: number = typeof rawChunkCount === 'number' && rawChunkCount > 0 ? rawChunkCount : 0;
    if (chunkCount === 0) {
      const { data: fileList, error: listError } = await supabase.storage
        .from('interview-recordings')
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
      console.error(`[Recording] Finalize — no chunks found — candidate ${candidateId} (Round ${round})`);
      return NextResponse.json({ success: false, error: 'No chunks found in storage' });
    }

    console.log(`[Recording] Finalize started — candidate ${candidateId} (Round ${round}), expecting ${chunkCount} chunks`);

    // Download chunks in sequential batches to avoid holding all blobs in memory at once.
    // Each chunk's ArrayBuffer is written into the assembled buffer immediately and released,
    // keeping peak RAM close to (total video size + one batch of blobs) rather than 3× total.
    const BATCH_SIZE = 10;
    const chunkSizes: number[] = [];
    // First pass: download sequentially in batches, accumulate per-chunk sizes
    const chunkBuffers: (ArrayBuffer | null)[] = new Array(chunkCount).fill(null);
    let downloadedCount = 0;

    for (let batchStart = 0; batchStart < chunkCount; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, chunkCount);
      const batchResults = await Promise.all(
        Array.from({ length: batchEnd - batchStart }, async (_, j) => {
          const i = batchStart + j;
          const path = `chunks/${folder}/${candidateId}/chunk_${i}.webm`;
          const { data, error } = await supabase.storage
            .from('interview-recordings')
            .download(path);
          if (error || !data) {
            const reason = error ? (error.message || JSON.stringify(error)) : 'no data';
            console.warn(`[Recording] Chunk ${i} download failed — candidate ${candidateId}: ${reason}`);
            return { index: i, buffer: null };
          }
          const buffer = await data.arrayBuffer();
          return { index: i, buffer };
        })
      );
      for (const r of batchResults) {
        if (r.buffer) {
          chunkBuffers[r.index] = r.buffer;
          downloadedCount++;
        }
      }
    }

    const validCount = chunkBuffers.filter(b => b !== null).length;
    console.log(`[Recording] Downloaded ${validCount}/${chunkCount} chunks — candidate ${candidateId} (Round ${round})`);

    if (validCount === 0) {
      console.error(`[Recording] No chunks available — candidate ${candidateId} (Round ${round})`);
      return NextResponse.json({ success: false, error: 'No chunks found in storage' });
    }

    // Calculate total size then assemble, releasing each chunk buffer immediately after copying
    const totalBytes = chunkBuffers.reduce((sum, b) => sum + (b ? b.byteLength : 0), 0);
    const assembled = new Uint8Array(totalBytes);
    let offset = 0;
    for (let i = 0; i < chunkBuffers.length; i++) {
      const buf = chunkBuffers[i];
      if (buf) {
        assembled.set(new Uint8Array(buf), offset);
        offset += buf.byteLength;
        chunkBuffers[i] = null; // release reference — allow GC before next chunk
      }
    }

    const sizeMB = (totalBytes / 1024 / 1024).toFixed(2);
    const uploadStart = Date.now();
    console.log(`[Recording] Assembled ${sizeMB}MB from ${validCount} chunks — candidate ${candidateId}, uploading final file`);

    // Upload the assembled final file
    const timestamp = Date.now();
    const finalPath = `${folder}/${candidateId}-${timestamp}-final.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('interview-recordings')
      .upload(finalPath, assembled, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error(`[Recording] Final upload FAILED — candidate ${candidateId} (Round ${round}): ${uploadError.message}`);
      return NextResponse.json({ success: false, error: uploadError.message });
    }
    console.log(`[Recording] Upload complete — candidate ${candidateId}, ${sizeMB}MB in ${((Date.now() - uploadStart) / 1000).toFixed(1)}s`);

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('interview-recordings')
      .getPublicUrl(finalPath);

    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) {
      console.error(`[Recording] Could not get public URL — candidate ${candidateId}`);
      return NextResponse.json({ success: false, error: 'Failed to get public URL' });
    }

    // Update the DB column
    const videoColumn = round === 3 ? 'round_3_recording_url' : round === 2 ? 'round_2_video_url' : 'video_url';
    const { error: dbError } = await supabase
      .from('candidates')
      .update({ [videoColumn]: publicUrl })
      .eq('id', candidateId);

    if (dbError) {
      console.error(`[Recording] DB update FAILED — candidate ${candidateId} (Round ${round}): ${dbError.message}`);
      return NextResponse.json({ success: false, error: dbError.message });
    }

    console.log(`[Recording] Finalized — candidate ${candidateId} (Round ${round}), ${sizeMB}MB, ${validCount}/${chunkCount} chunks, url: ${publicUrl}`);
    return NextResponse.json({ success: true, url: publicUrl });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Recording] Finalize exception — ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
