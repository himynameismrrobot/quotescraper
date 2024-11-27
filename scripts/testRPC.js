const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');
const { resolve } = require('path');

// Load environment variables from .env file
config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuoteSimilarity() {
    try {
        // Test quote to check similarity
        const testQuote = {
            quote: "This is a test quote",
            speaker: "Test Speaker",
            context: "Test context",
            article_url: "https://test.com",
            article_date: "2024-01-01"
        };

        // Call the RPC function
        const { data, error } = await supabase.rpc('check_quote_similarity', {
            new_quote: testQuote
        });

        if (error) {
            console.error('Error calling RPC function:', error);
            return;
        }

        console.log('RPC function result:', data);
    } catch (error) {
        console.error('Error:', error);
    }
}

// Run the test
testQuoteSimilarity();
