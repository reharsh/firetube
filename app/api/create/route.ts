import { BASE_PROMPT, getScriptWriterPrompt } from '@/lib/prompts';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function POST(req: Request) {
  const { title, messages, artifact } = await req.json();
  
  let script = '';

  if(title){
    const scriptPrompt = getScriptWriterPrompt(title);
    const result = await generateText({
      model: google(process.env.GEMINI_MODEL as string),
      messages: [
        { role: "system", content: BASE_PROMPT },
        { role: "user", content: scriptPrompt }
      ]
    });
    script = result.text;
  }
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/artifact`, {
      method: "POST",
      body: JSON.stringify({ script, messages, artifact }),
    });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create artifact: ${errorText}`);
  }
  const artifactResponse = await response.json();

  return Response.json({ script, artifact: artifactResponse.text });
}