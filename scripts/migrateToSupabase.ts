import { PrismaClient } from '@prisma/client';
import { createClient } from '@/utils/supabase/server';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { Database } from '@/utils/supabase/database.types';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient();

const idMap = new Map<string, string>();

async function generateEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

async function preMigrationChecks() {
  console.log('Running pre-migration checks...');
  
  // Check vector extension using raw query
  const { data: vectorEnabled, error: vectorError } = await supabase.rpc('check_vector_extension');
  
  if (vectorError) {
    console.error('Error checking vector extension:', vectorError);
    // Try alternative check
    const { data: extensions } = await supabase
      .from('pg_extension')
      .select('extname, schema')
      .eq('extname', 'vector')
      .single();

    if (!extensions) {
      throw new Error('Vector extension not found');
    }

    if (extensions.schema !== 'public') {
      // If vector is enabled but in wrong schema, we need to update it
      console.log('Vector extension found in wrong schema, attempting to update...');
      try {
        // Use raw SQL to alter the extension schema
        await supabase.rpc('alter_vector_schema');
        console.log('Successfully moved vector extension to public schema');
      } catch (alterError) {
        throw new Error(`Vector extension exists but not in public schema. Please run: ALTER EXTENSION vector SET SCHEMA public;`);
      }
    }
  }

  console.log('✅ Vector extension check passed');

  // Check if tables exist using raw query
  const { data: tables, error: tablesError } = await supabase.rpc('list_tables');
  
  if (tablesError) {
    throw new Error(`Failed to list tables: ${tablesError.message}`);
  }

  interface TableInfo {
    table_name: string;
  }

  const tableNames = tables?.map((t: TableInfo) => t.table_name) || [];
  
  const requiredTables = [
    'organizations', 'speakers', 'users', 'accounts', 'sessions',
    'following', 'quotes', 'quote_reactions', 'quote_reactions_users',
    'monitored_urls', 'quote_staging', 'comments', 'comment_reactions',
    'comment_reactions_users'
  ];

  const missingTables = requiredTables.filter(table => !tableNames.includes(table));
  if (missingTables.length) {
    throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
  }

  // Check OpenAI API access
  try {
    const testEmbedding = await generateEmbedding('test');
    if (!testEmbedding || !Array.isArray(testEmbedding)) {
      throw new Error('Invalid embedding response format');
    }
    console.log('✅ OpenAI API check passed');
  } catch (error) {
    console.error('OpenAI API check failed:', error);
    throw new Error('Failed to access OpenAI API for embeddings');
  }

  // Check database access with a simple query
  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);
    console.log('✅ Database access check passed');
  } catch (error) {
    console.error('Database access check failed:', error);
    throw new Error('Failed to access database');
  }

  console.log('✅ All pre-migration checks passed');
}

interface MigrationProgress {
  total: number;
  current: number;
  entity: string;
}

function logProgress({ total, current, entity }: MigrationProgress) {
  const percentage = Math.round((current / total) * 100);
  process.stdout.write(`\rMigrating ${entity}: ${current}/${total} (${percentage}%)`);
  if (current === total) {
    process.stdout.write('\n');
  }
}

async function migrate() {
  try {
    await preMigrationChecks();
    console.log('Starting migration...');
  
    // 1. Migrate Users first
    console.log('Migrating users...');
    const users = await prisma.user.findMany();
    for (const user of users) {
      const newId = uuidv4();
      idMap.set(user.id, newId);

      const { data, error } = await supabase.from('users').upsert({
        id: newId,
        name: user.name,
        username: user.username,
        email: user.email,
        email_verified: user.emailVerified?.toISOString() || null,
        image: user.image,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).select();

      if (error) {
        console.error(`Failed to migrate user ${user.id}:`, error);
        throw error;
      }
      console.log(`✓ Migrated user: ${user.email || user.id}`);
    }
    console.log(`✅ Migrated ${users.length} users`);

    // 2. Migrate Organizations
    console.log('Migrating organizations...');
    const organizations = await prisma.organization.findMany();
    for (const org of organizations) {
      const newId = uuidv4();
      idMap.set(org.id, newId);
      
      const { data, error } = await supabase.from('organizations').upsert({
        id: newId,
        name: org.name,
        logo_url: org.logoUrl,
        created_at: org.createdAt.toISOString(),
        updated_at: org.updatedAt.toISOString()
      }).select();

      if (error) {
        console.error(`Failed to migrate organization ${org.id}:`, error);
        throw error;
      }
      console.log(`✓ Migrated organization: ${org.name}`);
    }
    console.log(`✅ Migrated ${organizations.length} organizations`);

    // 3. Migrate Speakers (depends on organizations)
    console.log('Migrating speakers...');
    const speakers = await prisma.speaker.findMany();
    for (let i = 0; i < speakers.length; i++) {
      const speaker = speakers[i];
      logProgress({ total: speakers.length, current: i + 1, entity: 'speakers' });
      
      const newId = uuidv4();
      idMap.set(speaker.id, newId);

      const { data, error } = await supabase.from('speakers').upsert({
        id: newId,
        name: speaker.name,
        image_url: speaker.imageUrl,
        organization_id: speaker.organizationId ? idMap.get(speaker.organizationId) : null,
        created_at: speaker.createdAt.toISOString(),
        updated_at: speaker.updatedAt.toISOString()
      }).select();

      if (error) {
        console.error(`Failed to migrate speaker ${speaker.id}:`, error);
        throw error;
      }
    }
    console.log(`✅ Migrated ${speakers.length} speakers`);

    // 4. Migrate Accounts (depends on users)
    console.log('Migrating accounts...');
    const accounts = await prisma.account.findMany();
    for (const account of accounts) {
      const newId = uuidv4();
      const { data, error } = await supabase.from('accounts').upsert({
        id: newId,
        user_id: idMap.get(account.userId)!,
        type: account.type,
        provider: account.provider,
        provider_account_id: account.providerAccountId,
        refresh_token: account.refresh_token,
        access_token: account.access_token,
        expires_at: account.expires_at,
        token_type: account.token_type,
        scope: account.scope,
        id_token: account.id_token,
        session_state: account.session_state,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).select();

      if (error) {
        console.error(`Failed to migrate account ${account.id}:`, error);
        throw error;
      }
      console.log(`✓ Migrated account for provider: ${account.provider}`);
    }
    console.log(`✅ Migrated ${accounts.length} accounts`);

    // 5. Migrate Sessions (depends on users)
    console.log('Migrating sessions...');
    const sessions = await prisma.session.findMany();
    for (const session of sessions) {
      const newId = uuidv4();
      const { data, error } = await supabase.from('sessions').upsert({
        id: newId,
        session_token: session.sessionToken,
        user_id: idMap.get(session.userId)!,
        expires: session.expires.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).select();

      if (error) {
        console.error(`Failed to migrate session ${session.id}:`, error);
        throw error;
      }
      console.log(`✓ Migrated session: ${session.id}`);
    }
    console.log(`✅ Migrated ${sessions.length} sessions`);

    // 6. Migrate Monitored URLs
    console.log('Migrating monitored URLs...');
    const monitoredUrls = await prisma.monitoredURL.findMany();
    for (const url of monitoredUrls) {
      const newId = uuidv4();
      idMap.set(url.id, newId);

      const { data, error } = await supabase.from('monitored_urls').upsert({
        id: newId,
        url: url.url,
        logo_url: url.logoUrl,
        last_crawled_at: url.lastCrawledAt?.toISOString() || null,
        created_at: url.createdAt.toISOString(),
        updated_at: url.updatedAt.toISOString()
      }).select();

      if (error) {
        console.error(`Failed to migrate monitored URL ${url.id}:`, error);
        throw error;
      }
      console.log(`✓ Migrated monitored URL: ${url.url}`);
    }
    console.log(`✅ Migrated ${monitoredUrls.length} monitored URLs`);

    // 7. Migrate Quotes (depends on speakers)
    console.log('Migrating quotes...');
    const quotes = await prisma.savedQuote.findMany();
    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i];
      logProgress({ total: quotes.length, current: i + 1, entity: 'quotes' });
      
      const newId = uuidv4();
      idMap.set(quote.id, newId);

      // Generate embeddings
      const contentVector = await generateEmbedding(quote.rawQuoteText);
      const summaryVector = await generateEmbedding(quote.summary);

      const { data, error } = await supabase.from('quotes').upsert({
        id: newId,
        summary: quote.summary,
        raw_quote_text: quote.rawQuoteText,
        article_date: quote.articleDate.toISOString(),
        article_url: quote.articleUrl,
        article_headline: quote.articleHeadline,
        speaker_id: idMap.get(quote.speakerId)!,
        parent_monitored_url: quote.articleUrl,
        created_at: quote.createdAt.toISOString(),
        updated_at: quote.updatedAt.toISOString(),
        content_vector: contentVector,
        summary_vector: summaryVector
      }).select();

      if (error) {
        console.error(`Failed to migrate quote ${quote.id}:`, error);
        throw error;
      }
    }
    console.log(`✅ Migrated ${quotes.length} quotes`);

    // 8. Migrate Quote Reactions (depends on quotes and users)
    console.log('Migrating quote reactions...');
    const quoteReactions = await prisma.quoteReaction.findMany({
      include: { users: true }
    });
    
    for (const reaction of quoteReactions) {
      const newId = uuidv4();
      idMap.set(reaction.id, newId);

      // First create the reaction
      const { data, error: reactionError } = await supabase.from('quote_reactions').upsert({
        id: newId,
        emoji: reaction.emoji,
        quote_id: idMap.get(reaction.quoteId)!,
        created_at: reaction.createdAt.toISOString(),
        updated_at: reaction.updatedAt.toISOString()
      }).select();

      if (reactionError) {
        console.error(`Failed to migrate reaction ${reaction.id}:`, reactionError);
        throw reactionError;
      }

      // Then create the user associations
      for (const user of reaction.users) {
        const { error: userError } = await supabase.from('quote_reactions_users').upsert({
          quote_reaction_id: newId,
          user_id: idMap.get(user.id)!
        }).select();

        if (userError) {
          console.error(`Failed to migrate reaction user association:`, userError);
          throw userError;
        }
      }
      console.log(`✓ Migrated reaction: ${reaction.emoji} with ${reaction.users.length} users`);
    }
    console.log(`✅ Migrated ${quoteReactions.length} quote reactions`);

    // 9. Migrate Comments (depends on quotes and users)
    console.log('Migrating comments...');
    const comments = await prisma.comment.findMany();
    for (const comment of comments) {
      const newId = uuidv4();
      idMap.set(comment.id, newId);

      const { data, error } = await supabase.from('comments').upsert({
        id: newId,
        text: comment.text,
        quote_id: idMap.get(comment.quoteId)!,
        user_id: idMap.get(comment.userId)!,
        created_at: comment.createdAt.toISOString()
      }).select();

      if (error) {
        console.error(`Failed to migrate comment ${comment.id}:`, error);
        throw error;
      }
      console.log(`✓ Migrated comment from user: ${comment.userId}`);
    }
    console.log(`✅ Migrated ${comments.length} comments`);

    // 10. Migrate Comment Reactions (depends on comments and users)
    console.log('Migrating comment reactions...');
    const commentReactions = await prisma.commentReaction.findMany({
      include: { users: true }
    });

    for (const reaction of commentReactions) {
      const newId = uuidv4();
      idMap.set(reaction.id, newId);

      // First create the reaction
      const { data, error: reactionError } = await supabase.from('comment_reactions').upsert({
        id: newId,
        emoji: reaction.emoji,
        comment_id: idMap.get(reaction.commentId)!,
        created_at: reaction.createdAt.toISOString(),
        updated_at: reaction.updatedAt.toISOString()
      }).select();

      if (reactionError) {
        console.error(`Failed to migrate comment reaction ${reaction.id}:`, reactionError);
        throw reactionError;
      }

      // Then create the user associations
      for (const user of reaction.users) {
        const { error: userError } = await supabase.from('comment_reactions_users').upsert({
          comment_reaction_id: newId,
          user_id: idMap.get(user.id)!
        }).select();

        if (userError) {
          console.error(`Failed to migrate comment reaction user association:`, userError);
          throw userError;
        }
      }
      console.log(`✓ Migrated comment reaction: ${reaction.emoji} with ${reaction.users.length} users`);
    }
    console.log(`✅ Migrated ${commentReactions.length} comment reactions`);

    // 11. Migrate Following relationships (depends on users, speakers, and organizations)
    console.log('Migrating following relationships...');
    const following = await prisma.following.findMany();
    for (const follow of following) {
      const newId = uuidv4();
      const { data, error } = await supabase.from('following').upsert({
        id: newId,
        user_id: idMap.get(follow.userId)!,
        speaker_id: follow.speakerId ? idMap.get(follow.speakerId) : null,
        org_id: follow.orgId ? idMap.get(follow.orgId) : null,
        created_at: follow.createdAt.toISOString()
      }).select();

      if (error) {
        console.error(`Failed to migrate following relationship ${follow.id}:`, error);
        throw error;
      }
      console.log(`✓ Migrated following relationship for user: ${follow.userId}`);
    }
    console.log(`✅ Migrated ${following.length} following relationships`);

    // Run validations
    console.log('\nValidating migration...');
    const validation = await validateMigration();
    console.log('Migration validation results:', validation);

    await validateDataIntegrity();

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Add validation function
async function validateMigration() {
  const results = {
    organizations: {
      prisma: await prisma.organization.count(),
      supabase: await (await supabase.from('organizations').select('*', { count: 'exact' })).count
    },
    speakers: {
      prisma: await prisma.speaker.count(),
      supabase: await (await supabase.from('speakers').select('*', { count: 'exact' })).count
    },
    users: {
      prisma: await prisma.user.count(),
      supabase: await (await supabase.from('users').select('*', { count: 'exact' })).count
    },
    quotes: {
      prisma: await prisma.savedQuote.count(),
      supabase: await (await supabase.from('quotes').select('*', { count: 'exact' })).count
    },
    quoteReactions: {
      prisma: await prisma.quoteReaction.count(),
      supabase: await (await supabase.from('quote_reactions').select('*', { count: 'exact' })).count
    },
    comments: {
      prisma: await prisma.comment.count(),
      supabase: await (await supabase.from('comments').select('*', { count: 'exact' })).count
    },
    commentReactions: {
      prisma: await prisma.commentReaction.count(),
      supabase: await (await supabase.from('comment_reactions').select('*', { count: 'exact' })).count
    },
    following: {
      prisma: await prisma.following.count(),
      supabase: await (await supabase.from('following').select('*', { count: 'exact' })).count
    }
  };

  // Check for any mismatches
  const mismatches = Object.entries(results).filter(
    ([_, counts]) => counts.prisma !== counts.supabase
  );

  if (mismatches.length > 0) {
    console.warn('⚠️ Found count mismatches in:', mismatches);
  } else {
    console.log('✅ All record counts match between Prisma and Supabase');
  }

  return results;
}

async function validateDataIntegrity() {
  console.log('\nValidating data integrity...');

  // Check foreign key relationships
  const { data: quotes } = await supabase
    .from('quotes')
    .select('speaker_id');

  const { data: speakers } = await supabase
    .from('speakers')
    .select('id');

  interface Speaker {
    id: string;
  }

  interface Quote {
    speaker_id: string;
  }

  const speakerIds = new Set(speakers?.map((s: Speaker) => s.id));
  const orphanedQuotes = quotes?.filter((q: Quote) => !speakerIds.has(q.speaker_id));

  if (orphanedQuotes?.length) {
    console.error(`Found ${orphanedQuotes.length} quotes with invalid speaker_id`);
  }

  // Check vector embeddings
  const { data: quotesWithoutVectors } = await supabase
    .from('quotes')
    .select('id')
    .is('content_vector', null);

  if (quotesWithoutVectors?.length) {
    console.error(`Found ${quotesWithoutVectors.length} quotes without vector embeddings`);
  }

  console.log('✅ Data integrity validation complete');
}

// Run migration
migrate()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 