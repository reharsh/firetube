import { WORK_DIR } from '@/lib/constants';
import { artifactInfoPrompt, remotionPrePrompt } from '@/lib/prompts';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';


export async function POST(req: Request) {
  const { script, messages, artifact } = await req.json();

  const artifactInfo = script && !artifact ? artifactInfoPrompt(WORK_DIR,script,artifact) : artifactInfoPrompt(WORK_DIR,artifact);

  console.log("messages: ",messages);

  let text = '';
  if(messages){
    // TODO: we can optimiz this in future by only asking to update the artifact as a system message
    const result = await generateText({
      model: google('gemini-2.5-flash-preview-05-20'),
      messages: [
        ...messages,
        { role: "user", content: `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${artifact}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n` },
        { role: "user", content: artifactInfo },
        {role: "user",content: "Please respond strictly following the <fireArtifact> format." },
      ],
      maxRetries: 3,
    });
    text = result.text;
  }
  else{
    const result = await generateText({
      model: google('gemini-2.5-flash-preview-05-20'),
      messages: [
        { role: "system", content: `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${remotionPrePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n` },
        { role: "system", content: artifactInfo },
        {role: "user",content: "Please respond strictly following the <fireArtifact> format." },
      ],
      maxRetries: 3,
    });
    text = result.text;
  }

  console.log("new artifact: ",text.slice(1,100));

  return Response.json({ text });
}
