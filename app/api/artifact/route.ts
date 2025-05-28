import { WORK_DIR } from '@/lib/constants';
import { artifactInfoPrompt, remotionPrePrompt } from '@/lib/prompts';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';


export async function POST(req: Request) {
  const { script } = await req.json();
  
  const {text} = await generateText({
    model: google('gemini-2.5-flash-preview-05-20'),
    messages: [
      { role: "system", content: `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${remotionPrePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n` },
      { role: "system", content: artifactInfoPrompt(WORK_DIR,script) },
      {role: "user",content: "Please respond strictly following the <fireArtifact> format." },
    ],
    maxRetries: 3,
  });

  return Response.json({ text });
}
