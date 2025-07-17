import { WebContainer } from "@webcontainer/api";
import JSZip from "jszip";

export const renderVideo = async (webcontainer: WebContainer, fileName: string = `export-${Date.now()}`) => {
  console.log('[renderVideo] Start', { fileName });
  const zip = new JSZip();

  async function addDirToZip(currentPath: string, zipFolder: JSZip) {
    console.log('[addDirToZip] Enter', { currentPath });
    const entries = await webcontainer.fs.readdir(currentPath, { withFileTypes: true });
    console.log('[addDirToZip] Entries', { currentPath, entries });
    for (const entry of entries) {
      const fullPath = `${currentPath}/${entry.name}`;
      console.log('[addDirToZip] Processing entry', { entry, fullPath });

      if (entry.isDirectory()) {
        const newFolder = zipFolder.folder(entry.name);  
        if (newFolder) {
          console.log('[addDirToZip] Recursing into directory', { fullPath });
          await addDirToZip(fullPath, newFolder);
        } else {
          console.warn('[addDirToZip] Failed to create folder in zip', { entryName: entry.name });
        }
      } else {
        try {
          const fileData = await webcontainer.fs.readFile(fullPath);
          zipFolder.file(entry.name, fileData);
          console.log('[addDirToZip] Added file to zip', { fullPath });
        } catch (err) {
          console.error('[addDirToZip] Failed to read file', { fullPath, err });
        }
      }
    }
    console.log('[addDirToZip] Exit', { currentPath });
  }

  try {
    await addDirToZip('/', zip);
    console.log('[renderVideo] Directory added to zip');
  } catch (err) {
    console.error('[renderVideo] Error adding directory to zip', err);
    throw err;
  }

  let zipBlob;
  try {
    zipBlob = await zip.generateAsync({ type: 'blob' });
    console.log('[renderVideo] Zip generated', { zipBlob });
  } catch (err) {
    console.error('[renderVideo] Error generating zip', err);
    throw err;
  }

  let res;
  try {
    const uploadUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/upload?fileName=${fileName}.zip&fileType=${zipBlob.type}`;
    console.log('[renderVideo] Fetching pre-signed URL', { uploadUrl });
    res = await fetch(uploadUrl);
    console.log('[renderVideo] Pre-signed URL response', { status: res.status });
  } catch (err) {
    console.error('[renderVideo] Error fetching pre-signed URL', err);
    throw err;
  }

  if (!res.ok) {
    console.error('[renderVideo] Failed to get pre-signed URL', { status: res.status, statusText: res.statusText });
    throw new Error(`Failed to get pre-signed URL: ${res.statusText}`);
  }

  let data;
  try {
    data = await res.json();
    console.log('[renderVideo] Pre-signed URL data', data);
  } catch (err) {
    console.error('[renderVideo] Error parsing pre-signed URL response', err);
    throw err;
  }

  let uploadResponse;
  try {
    console.log('[renderVideo] Uploading zip to S3', { url: data.url });
    uploadResponse = await fetch(data.url, {
      method: "PUT",
      body: zipBlob
    });
    console.log('[renderVideo] S3 upload response', { status: uploadResponse.status });
  } catch (err) {
    console.error('[renderVideo] Error uploading to S3', err);
    throw err;
  }

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error('[renderVideo] Failed to upload to S3', { status: uploadResponse.status, statusText: uploadResponse.statusText, errorText });
    throw new Error(`Failed to upload to S3: ${uploadResponse.status} ${uploadResponse.statusText}\n${errorText}`);
  }
  
  console.log('[renderVideo] Uploaded to S3', { fileName });
  let renderResponse;
  try {
    const postUploadUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/post-upload?fileName=${fileName}.zip`;
    console.log('[renderVideo] Triggering render', { postUploadUrl });
    renderResponse = await fetch(postUploadUrl,{
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: data.url
      })
    });
    console.log('[renderVideo] Render response', { status: renderResponse.status });
  } catch (err) {
    console.error('[renderVideo] Error triggering render', err);
    throw err;
  }

  if(!renderResponse.ok) {
    console.error('[renderVideo] Failed to render video', { status: renderResponse.status, statusText: renderResponse.statusText });
    throw new Error(`Failed to render video: ${renderResponse.statusText}`);
  }

  let renderData;
  try {
    renderData = await renderResponse.json();
    console.log('[renderVideo] Render data', renderData);
  } catch (err) {
    console.error('[renderVideo] Error parsing render response', err);
    throw err;
  }

  console.log('[renderVideo] Rendered video downloaded hurrayyy...', { url: renderData.url });

  downloadVideo(renderData.url, fileName)
  console.log('[renderVideo] downloadVideo called');
}


export const downloadVideo = (url: string, fileName: string) => {
  console.log('[downloadVideo] Start', { url, fileName });

  fetch(url)
    .then(response => {
      console.log('[downloadVideo] Fetch response', { response, status: response.status });
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
      }
      return response.blob();
    })
    .then(blob => {
      console.log('[downloadVideo] Received blob', { blob, size: blob.size, type: blob.type });
      // Create blob URL
      const blobUrl = window.URL.createObjectURL(blob);
      console.log('[downloadVideo] Created blob URL', { blobUrl });
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
      console.log('[downloadVideo] Download initiated');
    })
    .catch(error => {
      console.error('[downloadVideo] Download failed', error);
      alert('Failed to download file. Please try again.');
    });
}
