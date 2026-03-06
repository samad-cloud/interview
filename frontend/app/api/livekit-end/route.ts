import { NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';

export async function POST(request: Request) {
  try {
    const { roomName } = await request.json();
    if (!roomName) return NextResponse.json({ error: 'Missing roomName' }, { status: 400 });

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });
    }

    const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
    await roomService.deleteRoom(roomName);
    console.log(`[LiveKit] Room deleted: ${roomName}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    // Room may already be gone — not a fatal error
    console.warn('[LiveKit] Room delete failed (may already be gone):', error);
    return NextResponse.json({ success: true });
  }
}
