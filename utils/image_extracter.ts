async function extractImageWithDuck(query: string): Promise<string | Error> {
  try {
    // Step 1: Get the vqd token
    const res = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`);
    const html = await res.text();
    const vqdMatch = html.match(/vqd="([\d-]+)"/);
    if (!vqdMatch) throw new Error('vqd token not found');
    const vqd = vqdMatch[1];

    // Step 2: Build query parameters
    const params = new URLSearchParams({
      q: query,
      vqd,
      o: 'json',
      f: '',
      p: '1',
      l: 'us-en',
    });

    // Step 3: Fetch image results
    const res2 = await fetch(`https://duckduckgo.com/i.js?${params.toString()}`, {
      method: 'GET',
      headers: {
        'authority': 'duckduckgo.com',
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'sec-fetch-dest': 'empty',
        'x-requested-with': 'XMLHttpRequest',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'referer': 'https://duckduckgo.com/',
        'accept-language': 'en-US,en;q=0.9',
      },
    });

    const response = await res2.json();
    const image = response.results.filter((img: any)=> img.height && img.height < 800).map((img: any)=> img.image)[0]; // adjust type as needed
    console.log(image);
    return image;
  } catch (err: any) {
    return new Error(`Error fetching image: ${err.message}`);
  }
}


export async function getImagesURLArray(image_queries: string[]): Promise<string[]> {
  try{
    const results = await Promise.all(image_queries.map(query => extractImageWithDuck(query)));
    const images = results.filter((res): res is string => typeof res === "string");
    console.log(images);
    return images;
  }
  catch(err){
    console.error(err);
    return [];
  }
}
