import { BASE_PROMPT, getScriptWriterPrompt } from '@/lib/prompts';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function POST(req: Request) {
  const { title, messages } = await req.json();
  
  let text = '';

  if(title){
    const scriptPrompt = getScriptWriterPrompt(title);
    const result = await generateText({
      model: google('gemini-2.5-flash-preview-05-20'),
      messages: [
        { role: "system", content: BASE_PROMPT },
        { role: "user", content: scriptPrompt }
      ]
    });
    text = result.text;
  }
    const response = await fetch(`${process.env.APP_URL}/api/artifact`, {
      method: "POST",
      body: JSON.stringify({ script: text, messages }),
    });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create artifact: ${errorText}`);
  }
  const artifactResponse = await response.json();

  return Response.json({ script: text, artifact: artifactResponse.text });
}