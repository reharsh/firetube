import { DirEnt, WebContainer } from "@webcontainer/api";
import { mkdir, writeFile } from "fs/promises";
import { dirname } from "path";
import JSZip from "jszip";

export const renderVideo = async (webcontainer: WebContainer, fileName: string = `export-${Date.now()}.zip`) => {
  const zip = new JSZip();

  async function addDirToZip(currentPath: string, zipFolder: JSZip) {
    const entries = await webcontainer.fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = `${currentPath}/${entry.name}`;

      if (entry.isDirectory()) {
        const newFolder = zipFolder.folder(entry.name);  
        if (newFolder) {
          await addDirToZip(fullPath, newFolder);
        }
      } else {
        const fileData = await webcontainer.fs.readFile(fullPath);
        zipFolder.file(entry.name, fileData);
      }
    }
  }

  await addDirToZip('/', zip);

  const zipBlob = await zip.generateAsync({ type: 'blob' });

  console.log("backend url: ", process.env.NEXT_PUBLIC_BACKEND_URL)
  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/upload?fileName=${fileName}&fileType=${zipBlob.type}`);

  if (!res.ok) {
    throw new Error(`Failed to get pre-signed URL: ${res.statusText}`);
  }

  const data = await res.json();

  console.log("Got pre-signed URL:", data.url);

  const uploadResponse = await fetch(data.url, {
    method: "PUT",
    body: zipBlob
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to upload to S3: ${uploadResponse.status} ${uploadResponse.statusText}\n${errorText}`);
  }
  
  console.log('uploaded to s3: ', fileName)
  const renderResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/render?fileName=${fileName}`,{
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: data.url
    })
  });

  if(!renderResponse.ok) {
    throw new Error(`Failed to render video: ${renderResponse.statusText}`);
  }

  const renderData = await renderResponse.json();

  console.log('rendered video downloaded hurrayyy...: ', renderData)
  return fileName;
}
