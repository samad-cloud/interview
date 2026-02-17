import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'DEEPGRAM_API_KEY not configured' },
        { status: 500 }
      );
    }
    // Amercan Women Aurora = aura-2-aurora-en
    // British Man: aura-2-draco-en
    // British Woman: aura-2-pandora-en
    // Call Deepgram Aura TTS API (male voice)
    const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-orion-en', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram TTS error:', errorText);
      return NextResponse.json(
        { error: 'TTS generation failed' },
        { status: 500 }
      );
    }

    // Get the audio buffer
    const audioBuffer = await response.arrayBuffer();
    
    // Return the audio as a response
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('TTS error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
