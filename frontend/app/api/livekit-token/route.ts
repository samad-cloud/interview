import { NextResponse } from 'next/server';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

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
