export interface Step {
    title: string;
    description: string;
    status: 'pending' | 'processing' | 'completed';
    type: StepType;
    content?: string;
    path?: string;
}

export enum StepType {
  CreateFile,
  CreateFolder,
  EditFile,
  DeleteFile,
  RunScript
}

export type FileNode = {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[]; // Only folders will have children
  content?: string; // Only files will have contents
};

export function parseXML(response: string): Step[] {
    // Extract the XML content between <boltArtifact> tags
    const xmlMatch = response.match(/<fireArtifact[^>]*>([\s\S]*?)<\/fireArtifact>/);
    
    if (!xmlMatch) {
      return [];
    }
  
    const xmlContent = xmlMatch[1];
    const steps: Step[] = [];

    // Extract artifact title
    const titleMatch = response.match(/title="([^"]*)"/);
    const artifactTitle = titleMatch ? titleMatch[1] : 'artifact title';
  
    // Add initial artifact step
    steps.push({
      title: artifactTitle,
      description: '',
      type: StepType.CreateFolder,
      status: 'pending'
    });
  
    // Regular expression to find boltAction elements
    const actionRegex = /<fireAction\s+type="([^"]*)"(?:\s+filePath="([^"]*)")?>([\s\S]*?)<\/fireAction>/g;
    
    let match;
    while ((match = actionRegex.exec(xmlContent)) !== null) {
      const [, type, filePath, content] = match;
  
      if (type === 'file') {
        // File creation step
        steps.push({
          title: `Create ${filePath || 'file'}`,
          description: '',
          type: StepType.CreateFile,
          status: 'pending',
          content: content.trim(),
          path: filePath
        });
      } else if (type === 'shell') {
        // Shell command step
        steps.push({
          title: 'Run command',
          description: '',
          type: StepType.RunScript,
          status: 'pending',
          content: content.trim()
        });
      }
    }
  
    return steps;
  }
  