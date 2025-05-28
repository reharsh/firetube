import { getImagesURLArray } from '@/utils/image_extracter';

export async function POST(req: Request) {
  const { titles } = await req.json();
  
  const image_queries = titles.split(",")

  const images = await getImagesURLArray(image_queries)

  return Response.json({ images });
}