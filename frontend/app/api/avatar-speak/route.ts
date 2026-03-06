import { NextResponse } from 'next/server';

const BITHUMAN_AGENT_CODE = 'A46JXE7400';

export async function POST(request: Request) {
  try {
    const { text, roomId } = await request.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const apiSecret = process.env.BITHUMAN_API_SECRET;
    if (!apiSecret) {
      return NextResponse.json({ error: 'BitHuman not configured' }, { status: 500 });
    }

    const body: Record<string, string> = { message: text };
    if (roomId) body.room_id = roomId;

    const res = await fetch(`https://api.bithuman.ai/v1/agent/${BITHUMAN_AGENT_CODE}/speak`, {
      method: 'POST',
      headers: {
        'api-secret': apiSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[Avatar Speak] BitHuman error:', res.status, errorText);
      // 402 = out of credits
      if (res.status === 402) {
        return NextResponse.json({ error: 'Avatar session credits exhausted' }, { status: 402 });
      }
      // 429 = rate limited
      if (res.status === 429) {
        return NextResponse.json({ error: 'Rate limited — try again shortly' }, { status: 429 });
      }
      return NextResponse.json({ error: 'Avatar failed to speak' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Avatar Speak] Error:', error);
    return NextResponse.json({ error: 'Failed to send message to avatar' }, { status: 500 });
  }
}
