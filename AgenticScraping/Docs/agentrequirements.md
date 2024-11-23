# Swarm Agent Requirements

## System Overview
The system will use LangChains' LangGraph library to create a coordinated group of AI agents that work together to monitor news sources, extract quotes, validate them, and manage duplicates using vector similarity. The system will run on a 24-hour cycle and integrate with Supabase for data storage and vector similarity searches.

## Graph Workflow Definition

### Step 1: Scrape Headlines from Monitored URLs
Purpose: Monitor parent URLs and extract article links
Inputs:
- List of monitored URLs from database
- Last crawl timestamp for each URL
Tools:
- OpenAI
- Supabase
Processing Steps:
- Markdown from JinaAI version of Parent URL sent to OpenAI
- OpenAI returns list of article URLs and their headlines
Outputs:
- List of article headlines and their URLs
Required Capabilities:
- Markdown parsing (Jina AI output)
- URL validation
- Headline extraction
- Timestamp management

- Use same OpenAI prompt from lib/crawler.ts file (function findHeadlinesWithQuotes)


### Step 2: Filter Out Already Processed Articles
Purpose: Filter out already processed articles
Inputs:
- List of article URLs/headlines from Step 1
Tools:
- Supabase
Processing Steps
- Filter out already processed articles from list by comparing with headlines already in Supabase saved quotes table (i.e., if count of headline in list from Step 1 that are also in the saved quotes table is greater than 0, remove them from the list)
Outputs:
- Filtered list of net new article URLs/headlines
Required Capabilities:
- Database querying
- String matching for headlines


### Step 3: Scrape Quotes from Filtered Articles
Purpose: Extract quotes from new articles
Inputs:
- Filtered article URLs from Step 2
Tools:
- OpenAI
- Supabase
Processing Steps:
- Markdown from JinaAI version of article URL sent to OpenAI
- OpenAI returns structured quote data
- Save quote data to Supabase staged quotes table
- Update crawl tiemstamps for parent URLs
Outputs:
- Structured quote data including:
  - Speaker name
  - Quote text
  - Quote summary
  - Article URL
  - Article date
  - Article headline
  - Parent URL
Required Capabilities:
- Text extraction
- Quote identification
- Speaker attribution
- Context preservation

- Use same OpenAI prompt from lib/crawler.ts file (function extractQuotesFromArticle)

### Step 4: Validate Extracted Quotes
Purpose: Validate extracted quotes
Inputs:
- Raw extracted quotes from Step 3 (stored in staged quotes table)
Tools:
- Supabase
- OpenAI
Processing Steps:
- Pass quotes and current date to OpenAI
- OpenAI will reference quote validation rules to return a binary yes or no for each quote to flag if it is valid or not (respectively) along with the rest of the quote's metadata that was passed in.
- If a quote is not valid, it should be deleted from the staged quotes table
- If a quote is valid, it should remain in the quotes table as-is
- It will also update the article date if it is older than 30 days when it passes this back
Outputs:
- Reduced set of quotes in the staged quotes table that are all valid
Required Capabilities:
- Quote validation rules
- Author text vs quoted text differentiation
- Context analysis
- Confidence scoring

Quote Validation Rules
- Author text vs quoted text differentiation: ensure the raw quote text only contains the words spoken by the speaker and not the text written by the author of the article
- Ensure speakers are those associated with organizations and not random other entities such as fans
- Ensure the article date is not from over 30 days ago, if it is replace with the current date

### Step 5: Roll-Up and De-Dupe Quotes
Purpose: Manage duplicate quotes and merge sources
Inputs:
- Valid staged quotes from Step 4
- Vectors of raw quote text in the saved quotes table
Tools:
- Supabase
- OpenAI
Processing Steps:
- Pass staged quotes to OpenAI embedding model to get vectors for raw quote text
- Save this vector to Supabase in the staged quotes table
- Compare this vector to vectors of existing quotes in the quotes table to determine if it is similar enough to be deleted or merged with an existing quote
- If similar enough, and the quote in the saved table has the same parent URL, delete the staged quote
If similar enough, and the quote in the saved table has a different parent URL, merge the staged quote with the existing quote by linking an addition article URL / headline to the existing quote in the saved quotes table
Outputs:
- Updated set of saved quotes - net new quotes added, and existing quotes updated to have more sources if any staged quotes were determiend to be similar enough
Required Capabilities:
- Vector similarity comparison
- Quote merging logic
- Source management
- Database write operations

### Step 6: Manually Accept Staged Quotes from New Speakers (not in the graph)
- After Steps 1-5 above are run, there will be some quotes that cannot be saved automatically to the saved quotes table as we don't have the speaker in the database yet.
- The Admin will review these quotes and if the speaker is valid, use the existing flow on the new quotes page to save the quote while also adding the speaker to the database.

## Admin Dashboard UI Requirements
- New Agents Page will be added so that existing admin dashboard pages are not modified
- Graph state will be streamed here so the user can see track the progress of the agents
- User will be able modify the following parameters used by LangGraph:
  - Headilne Extraction Prompt
  - Quote Extraction Prompt
  - Quote Validation Rules
  - Vector Similarity Threshold
  - Vector Similarity Model
  - Frequency of Agent Runs
  - Ability to manually trigger agent runs and stop existing runs
  - Ability to re-initiate regular scheduled runs if existing run stopped or failed

## Anti-Goals
- Make sure not to break any of the existing features for manually triggering crawls and accepting / rejecting staged quotes

## Supabase Migration Requirements (DONE)

### Database Schema Changes (DONE)
1. Convert existing Prisma schema to Supabase
2. Add vector storage capabilities for quotes
3. Maintain existing relationships and constraints
4. Add new fields for vector storage

### Vector Storage (DONE)
1. Enable pgvector extension in Supabase
2. Add vector embedding storage for quotes
3. Implement similarity search functions
4. Set up vector indexing

### API Changes (DONE)
1. Replace Prisma client with Supabase client
2. Update all database queries
3. Implement vector similarity queries
4. Update authentication flow


## Success Metrics

1. Step 1: Scrape Headlines from Monitored URLs
   - 95%+ accuracy in headline extraction
   - < 5% false positives for article detection
   - 100% URL validation accuracy
   - < 1min processing time per monitored URL

2. Step 2: Filter Out Already Processed Articles
   - 100% accuracy in duplicate detection
   - < 100ms response time per article
   - Zero false negatives (missed duplicates)

3. Step 3: Scrape Quotes from Filtered Articles
   - 90%+ accuracy in quote extraction
   - 95%+ accuracy in speaker attribution
   - < 30sec processing time per article

4. Step 4: Validate Extracted Quotes
   - 95%+ accuracy in quote validation
   - < 5% false positives
   - < 1% false negatives
   - < 5sec processing time per quote

5. Step 5: Roll-Up and De-Dupe Quotes
   - 90%+ accuracy in similarity detection
   - < 1% false merges
   - < 5% missed similarities
   - < 1sec processing time per comparison



## Project Plan

1. Week 1: Setup & Infrastructure (DONE)
   - Set up Supabase
   - Enable vector extensions
   - Create new schemas

2. Week 2: Data Migration  (DONE)
   - Migrate existing data
   - Generate vectors
   - Validate migration

3. Week 3-4: LangGraph Development
   - Develop graph node by node
   - Unit testing
   - Integration testing

5. Week 6: Deployment
   - Production deployment
   - Monitoring activation
   - Performance tuning



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



## Brief Summary of LangGraph steps
Scrape Headlines from Monitored URLs
Filter Out Already Processed Articles
Scrape Quotes from Filtered Articles
Validate Extracted Quotes
Roll-Up and De-Dupe Quotes


# Cascade's Questions and my answers
1
- Lets continue using supabase
- Let's use the same schema so we avoid a migration. We can always optimize later.
2
- Yes, please suggest what you think would be thes most efficient way to parallelize the flow, especially considering the various ways we can do this using LangGraph's builtin capabilities
- Again I'd defer to your recommendation in terms of how to parallelize, making sure that we accoutn for throughput limits with OpenAI
3.
- Ignore these requiremetns and let's just use the built-in error handling that the LangGraph documentation goes over. Also, if we connect to my LangChain account I'll be able to review all the traces for the run there so no need to create this functionality
4. 
- I think integrating into the agent workflow makes the most sense
- It should be configurable but there should only be one threshold we use for all quotes. There should be a way to configure this via the Agents tab of the Admin Dashboard
5. 
- Let me know what makes most sense to you. Since we already have a Javascript application taht this is launching from within I assumed it would simplify development to use the javascript implementation. What would we miss out on by not using the python implmementation?
- What do you suggest in tersm of standalone service vs. integrated with my web application? At the end of the day, all I want is my staged quotes table and saved quotes table to get updated by thsi LangGraph flow. If it's a separate app that we create that does that, I'm fine with that but have a slight prefererence to have everything in one place. I could be persuaded otehrwise if there's good reasons to.
6. 
- No need for rate limiting right now
- A simple cron job might suffice. Ideally I have some control over the scheduling of runs and ability to manually start/end runs from the UI.

# Cascade's Plan of Action

1. Technology Stack & Integration:
- I recommend sticking with TypeScript/JavaScript using LangGraph.js since:
    - It integrates seamlessly with your existing Next.js application
    - We can reuse existing Supabase client configurations and types
    - The core LangGraph features we need (state management, parallel execution, checkpointing) are available in both implementations
- I suggest implementing this as part of your existing web application rather than a standalone service because:
    - Simpler deployment and maintenance
    - Direct access to existing database connections and configurations
    - Easier integration with your admin UI for manual controls

2. Agent Workflow Architecture: Let me propose an optimized workflow using LangGraph's features:

graph TD
    A[Start] --> B[Headlines Agent]
    B --> C[Filter Agent]
    C --> D[Parallel Processing]
    D --> |Fan Out| E1[Quote Extraction]
    D --> |Fan Out| E2[Quote Extraction]
    D --> |Fan Out| E3[Quote Extraction]
    E1 --> F[Quote Validation]
    E2 --> F
    E3 --> F
    F --> G[De-duplication]
    G --> H[Database Update]

3. Key features:

Use LangGraph's fan-out capabilities for parallel quote extraction
Implement backpressure to manage OpenAI throughput
Use checkpointing for resumability and manual control
Integrate with LangSmith for monitoring and debugging
Implementation Plan: Let me break down how we'll implement this:

4. Create a new LangGraph workflow module:

/lib/agents/
  ├── graph/
  │   ├── state.ts        # Graph state definitions
  │   ├── nodes/          # Individual agent implementations
  │   └── workflow.ts     # Main graph configuration
  └── admin/
      └── controls.ts     # Manual control interface

Add admin UI controls for:
- Manual start/stop
- Run frequency configuration
- Similarity threshold settings
- Run status monitoring

# Casecade Implementation progress
I've implemented the core components of the LangGraph-based quote scraping workflow. Here's what I've created:

1. State Management (state.ts):
- Defined the graph state structure using LangGraph's Annotation system
- Created interfaces for Articles and Quotes
- Added configuration options for similarity threshold and parallel processing
2. Agent Nodes:
- headlines.ts: Implements the headline scraping agent using JinaAI and OpenAI
- filter.ts: Filters out already processed articles using Supabase queries
3. Workflow Configuration (workflow.ts):
- Created the main workflow graph connecting the agents
- Added state persistence using MemorySaver
- Implemented workflow initialization and execution functions
4. API Integration (Updated route.ts):
- Modified the existing API route to use the new LangGraph workflow
- Added streaming support for real-time updates
- Improved error handling and status reporting

5. Quote Extraction Node (quote-extraction.ts):
- Implements parallel processing using LangGraph's fan-out capability
- Uses JinaAI for markdown extraction
- Processes articles in configurable batch sizes
- Extracts quotes with speaker attribution and context
6. Quote Validation Node (quote-validation.ts):
- Validates quotes against quality criteria
- Filters out invalid quotes
- Provides detailed validation feedback
- Uses GPT-4 for accurate validation
7. Deduplication Node (deduplication.ts):
- Uses OpenAI's text-embedding-3-small model
- Implements cosine similarity comparison
- Configurable similarity threshold
- Efficiently handles vector comparisons
8. Updated Workflow (workflow.ts):
- Integrates all nodes in a coherent flow
- Implements parallel processing for quote extraction
- Maintains state throughout the workflow
- Provides comprehensive progress tracking

The workflow now follows this sequence:
- Headlines extraction (sequential)
- Article filtering (sequential)
- Quote extraction (parallel)
- Quote validation (sequential)
- Deduplication (sequential)


I've now implemented the database storage functionality and enhanced the admin UI. Here's what's been added:

9. Database Storage Node (storage.ts):
- Saves validated quotes to the staged_quotes table
- Handles database errors gracefully
- Maintains proper data structure for Supabase
10. Enhanced Admin UI (AgentsManagement.tsx):
- Added three main tabs:
    - Control: Start/stop agents and configure automatic runs
    - Settings: Adjust similarity threshold and parallel processing
    - Logs: Real-time monitoring of agent progress
- New features:
    - Automatic run scheduling with configurable frequency
    - Similarity threshold slider (0.5-1.0)
    - Parallel extraction control (1-10)
    - Persistent settings using localStorage
    - Real-time status updates
11. Updated Workflow (workflow.ts):
- Added storage node to the workflow
- Improved state management
- Enhanced error handling

The workflow now follows this complete sequence:
- Headlines extraction
- Article filtering
- Parallel quote extraction
- Quote validation
- Deduplication
- Database storage


I've now implemented both the automated scheduling and pause/resume functionality. Here's what's been added:

12. Scheduler Service (scheduler.ts):
- Singleton service for managing automated runs
- Configurable run frequency
- Persistent configuration storage in Supabase
- Automatic rescheduling after runs
- Error handling and logging
13. Workflow Manager (in workflow.ts):
- Added pause/resume functionality using NodeInterrupt
- Thread ID tracking for workflow state
- Interrupt handlers for all nodes
- State management for workflow status
14. Enhanced UI Controls (in AgentsManagement.tsx):
- Added Pause/Resume button for running workflows
- Integrated scheduler controls
- Real-time status updates
- Improved error handling and logging

The workflow now supports:
- Manual start/stop
- Pause/resume during execution
- Automated scheduling with configurable frequency
- Persistent configuration storage
- Real-time status monitoring