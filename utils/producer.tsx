"use client";
import PreviewTab from "@/components/previewTab";
import { Button } from "@/components/ui/button";
import Loading from "@/components/ui/Loading";
import { Textarea } from "@/components/ui/textarea";
import useWebcontainer from "@/hooks/useWebcontainer";
import createStructuredFiles from "@/lib/createStructuredFiles";
import { FileNode, parseXML, Step, StepType } from "@/lib/parseXML";
import { remotionPrePrompt } from "@/lib/prompts";
import { cn } from "@/lib/utils";
import useTitleStore from "@/store/title";
import { ArrowUpIcon, Hammer, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { renderVideo } from "./renderVideo";

export default function Producer () {

    const [steps, setsteps] = useState<Step[]>([]);
    const [loading, setLoading] = useState(false);
    const [files, setFiles] = useState<FileNode[]>([]);
    const { webcontainer, isBooted } = useWebcontainer();
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const { title } = useTitleStore();
    const [value, setValue] = useState("");
    const [currentArtifact, setCurrentArtifact] = useState<string>('');
    const [messages, setMessages] = useState<any[]>([]);
    const [structuredFiles, setStructuredFiles] = useState({})
    const [isRenderLoading, setIsRenderLoading] = useState(false);

    async function buildSteps(title?: string, messages?: any[]) {
      try{
        let stepResponse: Response;
        if(!title){
          console.log("sending messages: ", messages);
          stepResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ messages, artifact: currentArtifact })
          });
          console.log("artifact: ",currentArtifact.slice(0,100));
        }
        else{
          setMessages([{role: 'user', content: title}]);
            // for now uiprompts is only remotionPrePrompt so,
            const xml = remotionPrePrompt;
            // build some files first without getting artifact from server (package.json, remotion.config.ts, etc)
            // this preprompt gives llm some good idea about the project structure and files to build.
            const preSteps = parseXML(xml);

            console.log("pre steps: ", preSteps);

            setLoading(true);

            setsteps(preSteps.map((x: Step) => ({
                ...x,
                status: 'pending'
            })));

            stepResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ title })
            }); 
        }

        setLoading(false);

        const {artifact} = await stepResponse.json()
        setCurrentArtifact(artifact);
        const assistantMessage = artifact.match(/([\s\S]*?)<fireArtifact[^>]*>/)?.[1] || '';
        console.log("assistant message: ", assistantMessage);
        setMessages([...(messages || []), {role: 'assistant', content: assistantMessage}]);
        console.log("messages: ", messages);
        const parsedBuiltSteps = parseXML(artifact);
        console.log("parsed build steps: ",parsedBuiltSteps);

        setsteps(parsedBuiltSteps.map(content => ({
          ...content,
          status: 'pending'
        })))

        // setLlmMessages([...prompts,prompt].map(content => ({
        //   role: 'user',
        //   content
        // })))

        // setLlmMessages(x => [...x,{role: 'assistant',content: buildSteps}])
      }
      catch(e){
      }finally{
        setLoading(false);
      }

    }

        function giveFileStructure() {
        let updatedFiles: FileNode[] = [...files];
        let updateHappened:boolean = false;
        setLoading(true);
        steps.filter((step) => step.status === 'pending').forEach((step) => {
          updateHappened = true;
          step.status = 'processing';
          if (step.type == StepType.CreateFile) {
            let parsedPath = step.path?.split('/') ?? [];
            let currentFolderName = ''; // 'src'
            let currentFolder = ''; // ''
            
            let lastFolderIndex = -1;
            let theOneToAddIn = updatedFiles;
            let toCheckIn=updatedFiles;
            while (parsedPath.length){
              currentFolderName = parsedPath[0]; // 'src'
              currentFolder =  `${currentFolder}/${parsedPath[0]}`; // '/src'
              const folderIndex = toCheckIn.findIndex((file) => file.path === currentFolder);
              parsedPath = parsedPath.slice(1);
              if (folderIndex === -1) {
                if (!parsedPath.length){
                  theOneToAddIn.push({
                    name: currentFolderName,
                    type: 'file',
                    path: currentFolder,
                    content: step.content
                  })
                  break;
                }
                theOneToAddIn.push({
                  name: currentFolderName,
                  type: 'folder',
                  path: currentFolder,
                  children: []
                })
                lastFolderIndex = theOneToAddIn.length - 1;
                theOneToAddIn = theOneToAddIn[lastFolderIndex].children!;
                
              } else {
                if (!parsedPath.length){
                  toCheckIn[folderIndex].content = step.content;
                  break;
                }
                theOneToAddIn = toCheckIn[folderIndex].children!;
                toCheckIn = toCheckIn[folderIndex].children!;
              }
            }
          } else if (step.type == StepType.RunScript){
            executeCommands(step.content!);
          }
          step.status = 'completed';
          console.log("step completed: ",step.title);
        })
        setLoading(false);
        if (updateHappened){
          setFiles(updatedFiles);
          setsteps(steps => steps.map((s: Step) => {
            return {
              ...s,
              status: "completed"
            }
            
          }))
        }
    }
    
    async function executeCommands(command:string) {
      try {
        const args = command?.split('&&');
        if (!args) return;
        for (const arg of args) {
          const cmdArgs = arg.trim().split(' ');
          const process = await webcontainer?.spawn(cmdArgs[0], cmdArgs.slice(1));
          console.log(`Executing command: ${arg}`);
          await process?.exit;
        }
      } catch (error) {
        console.error(`Error executing command: ${command}`, error);
      }
    }

    useEffect(() => {
      giveFileStructure();
    },[steps,files]);

    useEffect(() => {
      buildSteps(title);
    },[]);

    useEffect(() => {
      const mountFiles = async () => {
        const strFiles = await createStructuredFiles(files);
        setStructuredFiles(strFiles)
        if (isBooted && webcontainer) {
            webcontainer?.mount(structuredFiles)
        }
      }
      mountFiles();
    },[webcontainer,files])

    return (
        <div className="w-full h-full flex flex-col bg-black text-white p-4">
          {isRenderLoading && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <button onClick={() => setIsRenderLoading(false)} className="absolute top-4 right-4">
                <XIcon className="w-4 h-4" />
              </button>
              <div className="bg-neutral-900/80 rounded-2xl p-8 flex flex-col items-center gap-6 border border-neutral-800 shadow-2xl">
                <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="flex flex-col items-center gap-2">
                  <h3 className="text-2xl font-semibold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                    Creating Your Video
                  </h3>
                  <p className="text-neutral-400 text-center max-w-sm">
                    Hold tight! We're crafting your Fireship-style video. This might take a minute...
                  </p>
                </div>
              </div>
            </div>
          )}
          <header className="flex items-center justify-between p-4 border-b border-neutral-800">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">Firetube</h1>
              <div className="flex items-center gap-2">
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size='default' 
                className={cn(
                  "relative",
                  isRenderLoading 
                    ? "bg-blue-500/50 hover:bg-blue-500/50 cursor-not-allowed" 
                    : "bg-blue-500 hover:bg-blue-500/90 cursor-pointer"
                )}
                disabled={isRenderLoading}
                onClick={async () => {
                  if (isBooted && webcontainer) {
                    setIsRenderLoading(true);
                    console.log(`here's your str files: `, structuredFiles)
                    await renderVideo(webcontainer);
                    console.log('finally rendered video from main, HURRAY!')
                    setIsRenderLoading(false);
                  }
                }}
              >
                {isRenderLoading ? (
                  <>
                    <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm rounded-md flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    </div>
                    <span className="opacity-50">Rendering...</span>
                  </>
                ) : (
                  <>
                    <Hammer className="w-4 h-4" />
                    <span>Render</span>
                  </>
                )}
              </Button>
            </div>
          </header>
      <div className="flex flex-1 md:flex-row flex-col px-4 pt-4">
        <div className="md:w-[45%] w-full">
          <div className="w-full flex flex-col gap-y-3 border border-neutral-800 rounded-lg h-[calc(100vh-12rem)] overflow-scroll">
            {
              messages.map((message,index)=>{
                return (
                  <div key={index}>
                    {message.role === 'user' ? (
                      <div className="flex gap-2 items-center p-2 justify-end">
                        <div className="text-sm bg-zinc-800 px-3 py-2 rounded-lg">{message.content}</div>
                        <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
                        <div className="text-sm text-zinc-200 px-3 py-2 rounded-lg">{message.content.slice(0,200)}</div>
                      </div>
                )
              }
              </div>
              )
            })}
          </div>
          <div className="relative bg-neutral-900 rounded-xl border border-neutral-800">
                        <Textarea
                            value={value}
                            onChange={(e)=>{
                              setValue(e.target.value);
                            }}
                            placeholder="Make some more edits..."
                            className={cn(
                                "w-full px-4 py-3",
                                "resize-none",
                                "bg-transparent",
                                "border-none",
                                "text-white text-sm",
                                "focus:outline-none",
                                "focus-visible:ring-0 focus-visible:ring-offset-0",
                                "placeholder:text-neutral-500 placeholder:text-sm",
                                "min-h-[60px]"
                            )}
                            style={{
                                overflow: "hidden",
                            }}
                        />

                    <div className="flex w-full p-3">
                        <div className="flex items-center gap-2 absolute right-3 bottom-3">
                            <button
                                onClick={async ()=>{
                                  const newMessages = [...messages.filter((message:any) => message.role === 'user').map((message:any) => ({role: 'user', content: message.content})), {role: 'user', content: value}];
                                  setMessages(newMessages);
                                  buildSteps(undefined, newMessages);
                                }}
                                type="button"
                                className={cn(
                                    "px-1.5 py-1.5 rounded-lg text-sm transition-colors border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 flex items-center justify-between gap-1",
                                    value.trim()
                                        ? "bg-white text-black"
                                        : "text-zinc-400"
                                )}
                            >
                                <ArrowUpIcon
                                    className={cn(
                                        "w-4 h-4",
                                        value.trim()
                                            ? "text-black"
                                            : "text-zinc-400"
                                    )}
                                />
                                <span className="sr-only">Send</span>
                            </button>
                        </div>
                    </div>
                </div>
        </div>
        <div className="w-[55%] border-r border-border p-4">
        <div className="relative w-full h-full bg-card rounded-lg">
                <div className="w-full h-full flex items-center justify-center">
                  {loading ? (
                    <Loading />
                  ) : !previewUrl ? (
                    <PreviewTab webcontainer={webcontainer!} setPreviewUrl={setPreviewUrl} />
                  ) : (
                    <iframe width="100%" height="100%" src={previewUrl} />
                  )}
                </div>
              </div>
        </div>

        </div>
        </div>
    );

}