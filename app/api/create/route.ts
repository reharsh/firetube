import { BASE_PROMPT, getScriptWriterPrompt } from '@/lib/prompts';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function POST(req: Request) {
  const { title } = await req.json();
  
  const scriptPrompt = getScriptWriterPrompt(title);

  const {text} = await generateText({
    model: google('gemini-2.5-flash-preview-05-20'),
    messages: [
      { role: "system", content: BASE_PROMPT },
      { role: "user", content: scriptPrompt }
    ]
  });

  const response = await fetch(`${process.env.APP_URL}/api/artifact`, {
  method: "POST",
  body: JSON.stringify({ script: text }),
});

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create artifact: ${errorText}`);
  }
  const artifactResponse = await response.json();
  console.log(artifactResponse);

  return Response.json({ script: text, artifact: artifactResponse.text });
}