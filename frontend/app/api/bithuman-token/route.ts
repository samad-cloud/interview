import { NextResponse } from 'next/server';

const BITHUMAN_AGENT_ID = 'A46JXE7400';

export async function POST(request: Request) {
  try {
    const { candidateId } = await request.json();

    if (!candidateId) {
      return NextResponse.json({ error: 'Missing candidateId' }, { status: 400 });
    }

    const apiSecret = process.env.BITHUMAN_API_SECRET;
    if (!apiSecret) {
      return NextResponse.json({ error: 'BitHuman not configured' }, { status: 500 });
    }

    const res = await fetch('https://api.bithuman.ai/v1/embed-tokens/request', {
      method: 'POST',
      headers: {
        'api-secret': apiSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: BITHUMAN_AGENT_ID,
        fingerprint: String(candidateId),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[BitHuman Token] API error:', res.status, text);
      return NextResponse.json({ error: 'Failed to get avatar token' }, { status: 502 });
    }

    const data = await res.json();
    const token = data?.data?.token;
    const sid = data?.data?.sid;

    if (!token) {
      console.error('[BitHuman Token] No token in response:', data);
      return NextResponse.json({ error: 'No token returned' }, { status: 502 });
    }

    return NextResponse.json({ token, sid, agentId: BITHUMAN_AGENT_ID });
  } catch (error) {
    console.error('[BitHuman Token] Error:', error);
    return NextResponse.json({ error: 'Failed to generate avatar token' }, { status: 500 });
  }
}
