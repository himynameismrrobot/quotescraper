import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface Follow {
  speaker_id: string;
  organization_id: string;
}

async function checkMoreQuotesExist(supabase: any, offset: number, tab: string, limit: number): Promise<boolean> {
  try {
    // Get authenticated user for 'following' tab
    let userId = null;
    if (tab === 'following') {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return false;
      userId = session.user.id;
    }

    // Check for quotes beyond the current offset
    let query = supabase
      .from('quotes')
      .select('id')
      .order('created_at', { ascending: false })
      .range(offset, offset + 1);

    // Add conditions for the 'following' tab
    if (tab === 'following' && userId) {
      // Get both speaker and organization follows
      const { data: follows } = await supabase
        .from('follows')
        .select('speaker_id, organization_id')
        .eq('follower_id', userId);

      if (!follows || follows.length === 0) {
        return false;
      }

      const speakerIds = follows
        .filter((f: Follow) => f.speaker_id)
        .map((f: Follow) => f.speaker_id);
      
      const orgIds = follows
        .filter((f: Follow) => f.organization_id)
        .map((f: Follow) => f.organization_id);

      // Build the filter condition using OR instead of AND
      query = query.or(`
        speaker_id.in.(${speakerIds.length ? speakerIds.join(',') : 'null'}),
        speaker.organization_id.in.(${orgIds.length ? orgIds.join(',') : 'null'})
      `);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error checking for more quotes:', error);
      return true; // Assume there are more on error
    }

    // If we got any data back, there are more quotes
    return data && data.length > 0;

  } catch (error) {
    console.error('Error in checkMoreQuotesExist:', error);
    return true; // Assume there are more quotes on error to prevent breaking infinite scroll
  }
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  
  // Initialize Supabase client within request context
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name) {
          const cookie = cookieStore.get(name);
          return cookie?.value;
        },
      },
    }
  );

  const { searchParams } = new URL(request.url);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const tab = searchParams.get('tab') || 'all';
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  try {
    const hasMore = await checkMoreQuotesExist(supabase, offset, tab, limit);
    return NextResponse.json({ hasMore });
  } catch (error) {
    console.error('Error checking for more quotes:', error);
    return NextResponse.json({ hasMore: true }, { status: 500 });
  }
} 