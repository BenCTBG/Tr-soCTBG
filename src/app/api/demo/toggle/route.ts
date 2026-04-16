import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const demoMode = cookieStore.get('demoMode')?.value === 'true';

  return Response.json({ data: { demoMode } });
}

export async function POST(request: Request) {
  const body = await request.json();
  const enable = Boolean(body.enable);

  const cookieStore = await cookies();

  if (enable) {
    cookieStore.set('demoMode', 'true', {
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
      sameSite: 'lax',
    });
  } else {
    cookieStore.delete('demoMode');
  }

  return Response.json({ data: { demoMode: enable } });
}
