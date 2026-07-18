export const runtime = 'nodejs';

export async function GET() {
  const key = process.env.GEMINI_API_KEY || '';
  return Response.json({ key });
}
