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
        // Test parameters for the similarity search
        const params = {
            query_embedding: [0.1, 0.2, 0.3], // Example embedding vector
            match_threshold: 0.5,
            match_count: 5
        };

        // Call the RPC function
        const { data, error } = await supabase.rpc('find_most_similar_quote', params);

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
