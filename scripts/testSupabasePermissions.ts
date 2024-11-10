import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Database } from '../lib/database.types';

dotenv.config();

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testPermissions() {
  console.log('Testing Supabase permissions...');

  try {
    // 1. Test simple insert
    const { data: org, error: insertError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: 'Test Organization',
        logo_url: null
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Insert test failed: ${insertError.message}`);
    }
    console.log('✅ Insert test passed');

    // 2. Test update
    const { error: updateError } = await supabaseAdmin
      .from('organizations')
      .update({ name: 'Updated Test Organization' })
      .eq('id', org.id);

    if (updateError) {
      throw new Error(`Update test failed: ${updateError.message}`);
    }
    console.log('✅ Update test passed');

    // 3. Test delete
    const { error: deleteError } = await supabaseAdmin
      .from('organizations')
      .delete()
      .eq('id', org.id);

    if (deleteError) {
      throw new Error(`Delete test failed: ${deleteError.message}`);
    }
    console.log('✅ Delete test passed');

    console.log('✅ All permission tests passed!');
  } catch (error) {
    console.error('❌ Permission test failed:', error);
  }
}

testPermissions(); 