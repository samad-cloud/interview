import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import mammoth from 'mammoth';

const RUBRIC_PROMPT = `Extract a structured technical interview rubric from this document.

Identify the competency dimensions and their scoring criteria. Reformat them using this exact structure for each dimension:

DIMENSION: [Name]
Description: [One sentence on what this assesses]
1-2/5 (Weak): [What a poor answer looks like]
3/5 (Solid): [What a decent answer looks like]
4-5/5 (Exceptional): [What an outstanding answer looks like]

If the document uses a different scoring scale (e.g. 1-4, percentages, labels), convert it to a 1-5 scale.
If the document doesn't have explicit level descriptors, infer reasonable ones from the criteria described.
Only include technical competencies — do not include soft skills or behavioural dimensions.
Output only the formatted rubric text, nothing else.`;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Please upload a PDF, Word document, or plain text file.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const bytes = await file.arrayBuffer();
    const isWord = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || file.type === 'application/msword';

    let result;

    if (isWord) {
      // Gemini doesn't support .docx as inline data — extract text first
      const { value: docText } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      result = await model.generateContent([RUBRIC_PROMPT, `\n\nDOCUMENT TEXT:\n${docText}`]);
    } else if (file.type === 'text/plain') {
      const docText = Buffer.from(bytes).toString('utf-8');
      result = await model.generateContent([RUBRIC_PROMPT, `\n\nDOCUMENT TEXT:\n${docText}`]);
    } else {
      // PDF — supported natively as inline data
      const base64 = Buffer.from(bytes).toString('base64');
      result = await model.generateContent([
        { inlineData: { mimeType: 'application/pdf', data: base64 } },
        RUBRIC_PROMPT,
      ]);
    }

    const rubric = result.response.text().trim();

    return NextResponse.json({ success: true, rubric });
  } catch (error) {
    console.error('parse-rubric error:', error);
    return NextResponse.json({ error: 'Failed to parse document' }, { status: 500 });
  }
}
