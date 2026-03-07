import { NextResponse } from 'next/server';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';

const MAX_CONCURRENT_ROUND3 = 4;

export async function POST(request: Request) {
  try {
    const { candidateId, candidateName, roomName, systemPrompt } = await request.json();

    if (!candidateId || !roomName) {
      return NextResponse.json({ error: 'Missing candidateId or roomName' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });
    }

    // Check concurrent Round 3 capacity
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { count } = await supabase
        .from('candidates')
        .select('id', { count: 'exact', head: true })
        .eq('round_3_status', 'IN_PROGRESS');

      if ((count ?? 0) >= MAX_CONCURRENT_ROUND3) {
        return NextResponse.json(
          { error: 'All interview slots are currently in use. Please try again in a few minutes.' },
          { status: 429 }
        );
      }
    }

    // Create the room with the system prompt as metadata so the agent reads it
    const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
    try {
      await roomService.createRoom({
        name: roomName,
        metadata: JSON.stringify({ system_prompt: systemPrompt || '', candidate_name: candidateName || '' }),
        emptyTimeout: 300, // close room after 5 min if empty
        maxParticipants: 5,
      });
    } catch {
      // Room may already exist — that's fine
    }

    // Generate candidate access token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: `candidate-${candidateId}`,
      name: candidateName || 'Candidate',
      ttl: '2h',
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    return NextResponse.json({ token, url: livekitUrl, roomName });
  } catch (error) {
    console.error('[LiveKit Token] Error:', error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
