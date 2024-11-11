import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  const id = await context.params.id;
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 });
  }
} 