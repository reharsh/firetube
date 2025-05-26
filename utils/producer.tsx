"use client";
import PreviewTab from "@/components/previewTab";
import { Button } from "@/components/ui/button";
import Loading from "@/components/ui/Loading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useWebcontainer from "@/hooks/useWebcontainer";
import createStructuredFiles from "@/lib/createStructuredFiles";
import { FileNode, parseXML, Step, StepType } from "@/lib/parseXML";
import { remotionPrePrompt } from "@/lib/prompts";
import { Code, Maximize2, MonitorPlay } from "lucide-react";
import { useEffect, useState } from "react";

export default function Producer () {

    const [steps, setsteps] = useState<Step[]>([]);
    const [loading, setLoading] = useState(false);
    const [files, setFiles] = useState<FileNode[]>([]);
    const { webcontainer, isBooted } = useWebcontainer();
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    async function buildSteps(title: string) {
      try{
        // for now uiprompts is only remotionPrePrompt so,
        const xml = remotionPrePrompt;
        const uiSteps = parseXML(xml);

        console.log("ui steps: ",uiSteps);

        setLoading(true);

        setsteps(uiSteps.map((x: Step) => ({
            ...x,
            status: 'pending'
        })));

        const stepResponse = await fetch(`http://localhost:3000/api/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title })
        });

        setLoading(false);
        
        const {artifact} = await stepResponse.json()
        console.log("got artifact: ",artifact);
        const parsedBuiltSteps = parseXML(artifact);
        console.log("these are parsed build steps: ",parsedBuiltSteps);

        setsteps( s => [...s,...parsedBuiltSteps.map(content => ({
          ...content,
          status: 'pending' as 'pending'
        }))] )

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
        buildSteps("World war 2");
    },[]);


    useEffect(() => {
      const mountFiles = async () => {
        console.log("mounting files: ",isBooted, webcontainer, files);
        const structuredFiles = await createStructuredFiles(files);
        if (isBooted && webcontainer) {
          console.log("WebContainer is booted, mounting files:", structuredFiles);
            webcontainer?.mount(structuredFiles)
            console.log("mounted files:", structuredFiles);
        }
      }
      mountFiles();
    },[webcontainer,files])

    return (
        <div className="w-full h-full flex flex-col bg-zinc-800 p-4">
            <h1>Producer</h1>
            <button onClick={() => buildSteps("googles gemini is agi?")}>
                Build sample title
            </button>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[55%] border-r border-border p-4">
          <Tabs defaultValue="preview" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="grid w-48 grid-cols-2">
                <TabsTrigger value="preview" className="flex items-center gap-2">
                  <MonitorPlay className="h-4 w-4" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="code" className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Code
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="preview" className="mt-0">
              <div className="relative w-full h-[calc(100vh-12rem)] bg-card rounded-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 z-10 bg-black/70 text-white hover:bg-black/80"
                  onClick={() => setIsPreviewOpen(true)}
                >
                  <Maximize2 className=" h-4 w-4" />
                </Button>
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
            </TabsContent>
          </Tabs>
        </div>

        </div>
        </div>
    );

}