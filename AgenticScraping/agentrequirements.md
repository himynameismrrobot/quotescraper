# Swarm Agent Requirements

## System Overview
The system will use OpenAI's Swarm library to create a coordinated group of AI agents that work together to monitor news sources, extract quotes, validate them, and manage duplicates using vector similarity. The system will run on a 24-hour cycle and integrate with Supabase for data storage and vector similarity searches.

## Agent Definitions

### Agent 1: URL Crawler
Purpose: Monitor parent URLs and extract article links
Inputs:
- List of monitored URLs from database
- Last crawl timestamp for each URL
Outputs:
- List of article URLs with headlines
- Updated crawl timestamps
Required Capabilities:
- Markdown parsing (Jina AI output)
- URL validation
- Headline extraction
- Timestamp management

### Agent 2: Article Filter
Purpose: Filter out already processed articles
Inputs:
- List of article URLs/headlines from Agent 1
- Access to database of existing quotes and their source articles
Outputs:
- Filtered list of new article URLs/headlines
Required Capabilities:
- Database querying
- String matching for headlines
- Deduplication logic

### Agent 3: Quote Extractor
Purpose: Extract quotes from new articles
Inputs:
- Filtered article URLs from Agent 2
Outputs:
- Structured quote data including:
  - Speaker name
  - Quote text
  - Quote summary
  - Article metadata
Required Capabilities:
- Text extraction
- Quote identification
- Speaker attribution
- Context preservation

### Agent 4: Quote Validator
Purpose: Validate extracted quotes
Inputs:
- Raw extracted quotes from Agent 3
Outputs:
- Validated quotes
- Rejection reasons for invalid quotes
Required Capabilities:
- Quote validation rules
- Author text vs quoted text differentiation
- Context analysis
- Confidence scoring

### Agent 5: Similarity Checker
Purpose: Manage duplicate quotes and merge sources
Inputs:
- Validated quotes from Agent 4
- Access to vector database of existing quotes
Outputs:
- New unique quotes for insertion
- Updated existing quotes with new sources
Required Capabilities:
- Vector similarity comparison
- Quote merging logic
- Source management
- Database write operations

## Supabase Migration Requirements

### Database Schema Changes
1. Convert existing Prisma schema to Supabase
2. Add vector storage capabilities for quotes
3. Maintain existing relationships and constraints
4. Add new fields for vector storage

### Vector Storage
1. Enable pgvector extension in Supabase
2. Add vector embedding storage for quotes
3. Implement similarity search functions
4. Set up vector indexing

### API Changes
1. Replace Prisma client with Supabase client
2. Update all database queries
3. Implement vector similarity queries
4. Update authentication flow

## Open Questions

1. Agent Coordination:
- How should agents communicate failure states?
    - Agents should log errors to a database table so we can review them later.
    - Agents should also log their outputs to the database so we can review them later.
- Should agents run sequentially or in parallel where possible?
    - Agents 1 & 2 should run sequentially
    - Agents 3, 4, & 5 should run in parallel
- What retry mechanisms should be implemented?
    - Agents should retry 3 times with a delay of 1 minute between each retry.
    - After 3 retries, the agent should log an error

2. Vector Implementation:
- What embedding model should we use for quote vectors?
    - We should use the OpenAI Embeddings API
    - We should use the text-embedding-3-small model
    - We should also allow the user to configure this in the admin panel
- What similarity threshold determines a quote match?
    - We should use cosine similarity
    - The threshold should be 0.85
    - We should also allow the user to configure this in the admin panel
- Should we store vectors for both raw quotes and summaries?
    - Yes, we should store vectors for both raw quotes and summaries
    - We should also allow the user to configure this in the admin panel
- How often should we update the vector database?
    - We should update the vector database every 24 hours

3. Quote Management
- How should we handle duplicate quotes?
    - The Agents should mostly only add new quotes to the database. But if they do add a duplicate the Similarity Checker should handle de-duping.
- How should we handle quotes that are very similar but not exact duplicates?
    - If the cosine similarity is above 0.85 then we should delete the new quote. If it's below 0.85 then we should add the new quote and leave the old one as-is.
- How should we handle quotes that are not valid?
    - We should delete these from the Staged Quotes table

4. Performance:
- What is the expected volume of articles per 24h cycle?
    - We should expect to process 1000 articles per day
- Should we implement rate limiting per news source?
    - No, we should not implement rate limiting per news source
- Do we need queue management for high volume periods?
    - No, we do not need queue management for high volume periods

5. Data Management:
- How long should we retain unmatched vectors?
- Should we implement soft deletes for quotes?
    - No, we should not implement soft deletes for quotes
- How should we handle quote updates vs new versions?
    - There should never be an update to a quote itself. We may add a new source but we'll never change the quote text.

6. Error Handling:
- How should we handle partial agent failures?
    - We should log the error and move on to the next agent if possible.
- What logging level is needed for debugging?
    - We should use the debug level for most logging
- Should we implement manual override capabilities?
    - No, we can just make the saved quotes editable from the admin dashboard.

7. Monitoring:
- What metrics should we track for agent performance?
    - We should track the number of articles processed per day  
    - We should track the number of new quotes saved/published per day
    - We should track the number of invalid quotes rejected per day
    - We should track the number of new quotes detected as duplicates per day and thus rejected
- How do we monitor vector similarity accuracy?
    - We should run a daily check to see if any of the quotes in the database are duplicates of each other.
- What alerts should be set up for system health?
    - We should send an alert if any agent fails to run for more than 1 hour

## Migration Strategy Questions

1. Data Migration:
- Should we migrate all historical data or start fresh?
    - We should migrate all historical data
- How do we handle in-flight data during migration?
     - There will be no in-flight data
- What is the rollback strategy?
    - We should rollback to the previous day's data if something goes wrong

2. Deployment:
- Should we implement a phased migration?
    - No, we should not implement a phased migration
    - We should migrate the data in one go
- How do we handle the transition period?
    - There will be no transition period, the app is not in production yet
- What is the validation strategy for migrated data?
    - We should validate the migrated data by running the agents manually once

## Next Steps
1. Review and answer open questions
2. Prioritize agent development order
3. Define success metrics for each agent
4. Create test datasets for agent validation
5. Design monitoring and alerting system
6. Develop migration timeline

## Agent Development Priority Order

1. Agent 1: URL Crawler
   - Most independent agent
   - Core functionality needed by all other agents
   - Can be tested in isolation
   - Reuses existing crawler logic

2. Agent 2: Article Filter
   - Depends only on Agent 1 output
   - Simple database comparison logic
   - Critical for efficiency of later agents

3. Agent 4: Quote Validator
   - Independent from Agent 5
   - Needed before similarity checking
   - Ensures data quality early
   - Reduces load on vector database

4. Agent 3: Quote Extractor
   - Can run in parallel with Agent 4
   - Reuses existing extraction logic
   - High impact on system value

5. Agent 5: Similarity Checker
   - Most complex agent
   - Depends on vector database setup
   - Requires validated quotes
   - Final step in pipeline

## Success Metrics

1. Agent 1: URL Crawler
   - 95%+ accuracy in headline extraction
   - < 5% false positives for article detection
   - 100% URL validation accuracy
   - < 1min processing time per monitored URL

2. Agent 2: Article Filter
   - 100% accuracy in duplicate detection
   - < 100ms response time per article
   - Zero false negatives (missed duplicates)

3. Agent 3: Quote Extractor
   - 90%+ accuracy in quote extraction
   - 95%+ accuracy in speaker attribution
   - < 30sec processing time per article

4. Agent 4: Quote Validator
   - 95%+ accuracy in quote validation
   - < 5% false positives
   - < 1% false negatives
   - < 5sec processing time per quote

5. Agent 5: Similarity Checker
   - 90%+ accuracy in similarity detection
   - < 1% false merges
   - < 5% missed similarities
   - < 1sec processing time per comparison

## Test Dataset Requirements

1. Development Dataset
   - 100 monitored URLs
   - Mix of news sources
   - Known duplicate articles
   - Various quote formats
   - Edge cases for each agent

2. Validation Dataset
   - 50 different monitored URLs
   - Previously unseen sources
   - Known similar quotes
   - Complex quote structures
   - Performance test cases

3. Production Dataset
   - Current production URLs
   - Historical quotes
   - Known duplicates
   - Performance benchmarks

## Monitoring System Design

1. Agent Health Monitoring
   - Agent status (active/inactive)
   - Processing times
   - Error rates
   - Queue lengths

2. Data Quality Monitoring
   - Extraction accuracy
   - Validation rates
   - Similarity match rates
   - Vector quality metrics

3. System Performance
   - Database load
   - API response times
   - Vector search performance
   - Memory usage

4. Alerting Rules
   - Agent failures > 1 hour
   - Error rates > 10%
   - Processing delays > 30min
   - Unusual pattern detection

## Migration Timeline

1. Week 1: Setup & Infrastructure
   - Set up Supabase
   - Enable vector extensions
   - Create new schemas

2. Week 2: Data Migration
   - Migrate existing data
   - Generate vectors
   - Validate migration

3. Week 3-4: Agent Development
   - Develop agents in priority order
   - Unit testing
   - Integration testing

4. Week 5: Testing & Validation
   - End-to-end testing
   - Performance testing
   - Monitoring setup

5. Week 6: Deployment
   - Production deployment
   - Monitoring activation
   - Performance tuning