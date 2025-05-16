import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { prompt } = await req.json();
  console.log('Prompt:', prompt);

  const result = streamText({
    model: google('gemini-1.5-flash'),
    prompt,
  });

  return result.toDataStreamResponse();
}