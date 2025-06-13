import { WebContainer } from "@webcontainer/api";
import JSZip from "jszip";

export const renderVideo = async (webcontainer: WebContainer, fileName: string = `export-${Date.now()}`) => {
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

  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/upload?fileName=${fileName}.zip&fileType=${zipBlob.type}`);

  if (!res.ok) {
    throw new Error(`Failed to get pre-signed URL: ${res.statusText}`);
  }

  const data = await res.json();

  const uploadResponse = await fetch(data.url, {
    method: "PUT",
    body: zipBlob
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to upload to S3: ${uploadResponse.status} ${uploadResponse.statusText}\n${errorText}`);
  }
  
  console.log('uploaded to s3: ', fileName)
  const renderResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/post-upload?fileName=${fileName}.zip`,{
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

  console.log('renderData: ', renderData)
  console.log('rendered video downloaded hurrayyy...: ', renderData.url)

  downloadVideo(renderData.url, fileName)
}


export const downloadVideo = (url: string, fileName: string) => {
  console.log('Starting download with URL:', url);
  console.log('File name:', fileName);

  fetch(url)
    .then(response => {
      console.log('Fetch response:', response);
      console.log('Response status:', response.status);
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
      }
      return response.blob();
    })
    .then(blob => {
      console.log('Received blob:', blob);
      console.log('Blob size:', blob.size);
      console.log('Blob type:', blob.type);
      
      // Create blob URL
      const blobUrl = window.URL.createObjectURL(blob);
      console.log('Created blob URL:', blobUrl);
      
      // Create temporary link
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `${fileName}.mp4`);
      
      // Programmatically click the link
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      console.log('Download initiated');
    })
    .catch(error => {
      console.error('Download failed:', error);
      alert('Failed to download file. Please try again.');
    });
}
