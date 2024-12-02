import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END, START, Annotation, Send } from "@langchain/langgraph";
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import puppeteer from 'puppeteer';
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from './logger';

// Optional, add tracing in LangSmith
// process.env.LANGCHAIN_API_KEY = "ls__..."
// process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "true";
//process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "true";
//process.env.LANGCHAIN_TRACING_V2 = "true";
//process.env.LANGCHAIN_PROJECT = "Branching: LangGraphJS";

// Load environment variables from .env file
config({ path: resolve(__dirname, '../.env') });

// Add Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Add Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// OpenAI Model Initialization
 
const gpt4omodel = new ChatOpenAI({
    model: "gpt-4o-mini",
    maxConcurrency: 10
});

const quoteValidationModel = new ChatOpenAI({
    model: "ft:gpt-4o-mini-2024-07-18:personal::AVXTE2Zu",
});

const openai = new OpenAI();

// Add OpenAI embedding model
const embeddingModel = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Configuration object
const CONFIG = {
    SIMILARITY: {
        THRESHOLD: parseFloat(process.env.QUOTE_SIMILARITY_THRESHOLD || '-0.90'),
        MODEL: process.env.QUOTE_EMBEDDING_MODEL || 'text-embedding-3-small',
        DIMENSIONS: parseInt(process.env.QUOTE_EMBEDDING_DIMENSIONS || '1536')
    }
} as const;

// Function to get embedding for a quote
const getQuoteEmbedding = async (quote: string): Promise<number[]> => {
    const response = await embeddingModel.embeddings.create({
        model: CONFIG.SIMILARITY.MODEL,
        input: quote,
        dimensions: CONFIG.SIMILARITY.DIMENSIONS
    });
    return response.data[0].embedding;
};

// Helper for tracking OpenAI calls
let activeRequests = new Set<string>();

// Add semaphore for concurrency control
const maxConcurrentRequests = 5;
let currentActiveRequests = 0;
let totalArticlesToProcess = 0;
const requestQueue: (() => Promise<void>)[] = [];

const logOpenAICall = (action: 'start' | 'end', functionName: string, modelName: string, url: string, details?: any) => {
    const requestId = `${functionName}-${url}`;
    if (action === 'start') {
        activeRequests.add(requestId);
    } else {
        activeRequests.delete(requestId);
        if (details?.error) {
            logger.error(`Error in ${functionName}: ${details.error}`);
        }
    }
};

// Gemini Schema for getting structured output from the LLM
const quoteExtractionSchema = {
    type: SchemaType.OBJECT,
    properties: {
        quotes: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    article_date: {
                        type: SchemaType.STRING,
                        description: "The article date in YYYY-MM-DD format"
                    },
                    speaker: {
                        type: SchemaType.STRING,
                        description: "Name of the person who the quote is attributed to"
                    },
                    quote_raw: {
                        type: SchemaType.STRING,
                        description: "The raw quote text from the article"
                    },
                    quote_summary: {
                        type: SchemaType.STRING,
                        description: "A concise version of the quote"
                    }
                },
                required: ["speaker", "quote_raw", "quote_summary", "article_date"]
            }
        }
    }
};

// Create Gemini model instance with schema
const geminiModel = genAI.getGenerativeModel({
    model: "gemini-1.5-pro-latest",
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: quoteExtractionSchema,
    }
});


//Get Jina Markdown Helper Function
async function getJinaMarkdown(url: string): Promise<string> {
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    console.log(`Fetching markdown from: ${jinaUrl}`);
    
    try {
        const response = await fetch(jinaUrl, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${process.env.JINA_API_KEY}`,
                "Accept": "text/event-stream",
                "X-Remove-Selector": "header, footer, nav, .ad, .advertisement, .social-share, .comments-section, .related-articles, aside, .subscription-prompt, .newsletter-signup, .cookie-notice, .breaking-news-banner",
                "X-Wait-For-Selector": "article, .article-body, .article-content, .story-body, main, .main-content",
                "X-Return-Format": "markdown",
                "X-Timeout": "20"
            }
        });

        if (!response.ok) {
            console.error(`Failed to fetch markdown: ${response.status} ${response.statusText}`);
            return "";
        }

        const markdown = await response.text();
        return markdown;
    } catch (error) {
        console.error("Error fetching markdown:", error);
        return "";
    }
}

// Helper Function for retrying if rate limited
const withRetry = async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 10,
    initialDelayMs: number = 5000  // Start with 5 seconds
): Promise<T> => {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            // More comprehensive rate limit detection
            const isRateLimit = 
                error.message?.toLowerCase().includes('rate limit') ||
                error.message?.toLowerCase().includes('429') ||
                error.message?.toLowerCase().includes('too many requests') ||
                error.message?.toLowerCase().includes('quota exceeded') ||
                error.status === 429 ||
                error.code === 'rate_limit_exceeded';

            // Check for other retryable errors
            const isRetryableError = 
                error.message?.toLowerCase().includes('timeout') ||
                error.message?.toLowerCase().includes('network') ||
                error.message?.toLowerCase().includes('connection') ||
                error.message?.toLowerCase().includes('econnreset') ||
                error.code === 'ECONNRESET' ||
                error.code === 'ETIMEDOUT';

            const shouldRetry = isRateLimit || isRetryableError;

            if (!shouldRetry && attempt === maxRetries - 1) {
                console.error('Non-retryable error encountered:', error);
                throw error;
            }

            // More aggressive backoff with additional random delay
            const baseDelay = initialDelayMs * Math.pow(2, attempt); // Use power of 2
            const jitter = baseDelay * (Math.random() * 0.5); // Up to 50% jitter
            const delayMs = baseDelay + jitter;
            
            // Better logging
            console.log(`\nRetry attempt ${attempt + 1}/${maxRetries}`);
            console.log(`Error type: ${isRateLimit ? 'Rate limit' : isRetryableError ? 'Network error' : 'Unknown error'}`);
            console.log(`Error message: ${error.message}`);
            console.log(`Waiting ${Math.round(delayMs/1000)} seconds before next attempt...`);
            
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    console.error('Max retries reached. Last error:', lastError);
    throw lastError;
};

async function saveGraphResults(
    modelType: 'openai' | 'gemini',
    state: typeof OverallState.State
): Promise<void> {
    const outputDir = resolve('/Users/mitenmistry/Documents/Apps/QuoteScraper/AgenticScraping/quote_outputs');
    
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}.json`;
    
    const output = {
        model: modelType,
        timestamp: new Date().toISOString(),
        parent_urls: state.parent_monitored_urls,
        quotes: state.quotes,
    };

    writeFileSync(
        join(outputDir, filename),
        JSON.stringify(output, null, 2)
    );
    
    console.log(`Graph results saved to: ${outputDir}/${filename}`);
}

// Define prompts we will use
const headlineExtractionPrompt = `
    #Instructions
    Analyze the following Markdown and only extract the news article headlines. Don't extract any random links. 
    Return a JSON array of objects with 'parent_url','article_url', and 'headline' properties for all news article headlines that you find. 
    Respond ONLY with the JSON array, no other text or formatting.
    Only include headlines and URLs for articles from the main body of the webpage's markdown.
    Make sure you do not manipulate the article URL or headline in any way.

    Important: Look for article URLs in markdown-style link formats like:
    [Headline Text](https://www.example.com/article-url)
    The URL should be extracted from inside the parentheses ().

    Preserve parent_url exactly as provided here: {parent_url}

    #Parent URL Markdown
    {parent_url_markdown}

    
    #EXPECTED OUTPUT
    [
        {
            "parent_monitored_url": "<parent_monitored_url>",
            "article_url": "<article_url>",
            "article_headline": "<article_headline>",
        }
    `;

const articleExtractionPrompt = `Below is a markdown version of a news article from a website. 

    Isolate the article text and article date from the rest of the markdown. 
    Structure this data per the data model shown below in your response.
    Make sure to preserve the parent_monitored_url, article_url, and article_headline exactly as provided.

    # Article Metadata
    parent_monitored_url: {parent_monitored_url}
    article_url: {article_url}
    article_headline: {article_headline}
    
    # Expected Output Format
    {
        "parent_monitored_url": "{parent_monitored_url}",
        "article_url": "{article_url}",
        "article_headline": "{article_headline}",
        "article_text": "The complete article text including all paragraphs, subheadings, and quotes. Keep all relevant content that could contain quotes.",
        "article_date": "YYYY-MM-DD",
        "publishedTime": "YYYY-MM-DDTHH:MM:SSZ" // Optional ISO 8601 timestamp if found
    }

    #Instructions
    1. Extract and clean the main article text:
        • KEEP all article paragraphs, subheadings, and quotes
        • KEEP any text that could contain relevant quotes from people
        • ONLY remove:
          - Navigation menus
          - Advertisements
          - Social media buttons
          - Comments sections
          - Related articles links
          - Copyright notices
          - Cookie/privacy notices
    
    2. For the article date:
        • Extract the article date in YYYY-MM-DD format
        • Use the date provided within the article text, if available.
        • If not found, check the article URL for a potential date.
        • If no date is available in the text or URL, use the current date: {today_date}.
        • If you find a full timestamp, include it in publishedTime field.

    #Article Markdown
    {article_url_markdown}`;

const quoteExtractionPrompt = `Extract all quotes from the provided article. Take your time to do this.
    
    #Instructions
    ## RAW QUOTE SELECTION:
    - Only extract quotes from named individuals who are central to the story
    - Never extract quotes from the article author, news publication, or other unnamed speakers
    - If a quote lacks context to be fully understood, provide a brief contextual note in brackets at the start of the quote, but keep this note concise and don't write "Context:"
    - If no quotes are found, double check to make sure you didn't miss anything. If you're certain there are no quotes, return an empty JSON array.

    ## RAW QUOTE COMPOSITION:
    - If a quote is split across the article, combine the segments into one cohesive quote, but only if they pertain to the same topic.
    - Exclude any non quote text (e.g.,  "speaking after the match", "in a 2020 interview", "told Sky Sports")

    ## SUMMARY QUOTE COMPOSITION:
    - For each quote, generate a more concise version written in the first person from the speaker's perspective.
    
    ## ARTICLE DATE EXTRACTION:
    - Extract the article date in YYYY-MM-DD format
    - Use the date provided within the article text, if available.
    - If not found, check the article URL for a potential date.
    - If no date is available in the text or URL, use the current date: {today_date}.

    ## QUOTE VALIDATION:
    - Review your work, make sure you have not extracted any quotes from the article author, news publication, or other unnamed speakers

	## Article Metadat to include in output
    Make sure to preserve the article metadata exactly as provided below.

    ## Article Metadata
    parent_monitored_url: {parent_monitored_url}
    article_url: {article_url}
    article_headline: {article_headline}
    
    ## Expected Output Format
    {
        "article_metadata": {
            "parent_monitored_url": The parent_monitored_url provided above,
            "article_url": The article_url provided above,
            "headline": The article headline provided above,
            "article_text": The article text, provided below,
            "article_date": You will extract this using the instructions above
        },
        "quotes": [
            {
                "speaker_name": "Name of person quoted",
                "raw_quote_text": "The exact quote from the text",
                "summary": "A concise version of the quote"
            }
        ]
    }
    
# START OF ARTICLE TEXT

{article_text}

# END OF ARTICLE TEXT`;


const quoteValidationPrompt = `Assess the validity of the quotes in the quote object below.
    Return a JSON object with the same array of quotes but with two additional properties on each quote: is_valid and invalid_reason.
    Invalid quotes should have is_valid set to false and an invalid_reason.
    Valid quotes should have is_valid set to true. invalid_reason should be empty.
    Use the article text to help you determine whether the quote is valid or not.
    
    # Article Metadata 
    parent_monitored_url: {parent_monitored_url}
    article_url: {article_url}
    article_headline: {article_headline}
    
    # Article Text
    {article_text}

    
    # Quotes from article
    {quotes_to_validate}
    
    # A quote is only valid if...
    - The raw quote text only contains context in parentheses if helpful and the words spoken by a named speaker. Text written by the author of the article should never be included.
    - The summary is written in the first person
    - The speaker_name is the actual name of a person rather than something ambiguous (i.e., it cannot be the news publication, article author, or other unnamed speakers (e.g., fans, spokespersons, etc.))
    
    # Expected Output Format
    {
    "quotes": [
        {
        "speaker_name": "Speaker's Name",
        "id": "Quote ID",
        "raw_quote_text": "The exact quote text",
        "summary": "First-person summary",
        "is_valid": true,
        "invalid_reason": ""
        }
        // ... more quotes
    ]
    }`;


// Zod schemas for the graph state
const Quote = z.object({
    id: z.string().optional(),
    speaker_name: z.string(),
    raw_quote_text: z.string(),
    summary: z.string(),
    similar_to_quote_id: z.string().optional(),
    similar_to_staged_quote_id: z.string().optional(), // Add similar_to_staged_quote_id
    similarity_score: z.number().optional(),
    is_valid: z.boolean().optional(),
    invalid_reason: z.string().optional()
});

const Quotes = z.array(z.object({  // Define Quotes as an array of objects
    article_metadata: z.object({
        parent_monitored_url: z.string(),
        article_url: z.string(),
        article_date: z.string(),
        article_headline: z.string(),
        article_text: z.string()
    }),
    quotes: z.array(Quote),
    status: z.string().optional()
}));


// Zod schemas for getting structured output from the LLM
const Headlines = z.object({
    headlines: z.array(z.object({
        parent_monitored_url: z.string(),
        article_url: z.string(),
        article_headline: z.string()
    }))
});

const Article = z.object({
    parent_monitored_url: z.string(),
    article_url: z.string(),
    article_headline: z.string(),
    article_text: z.string(),
    article_date: z.string().optional(), // Make article_date optional
    publishedTime: z.string().optional() // Allow publishedTime as an alternative
});

const ExtractedQuotes = z.object({
    article_metadata: z.object({
        parent_monitored_url: z.string(),
        article_url: z.string(),
        article_headline: z.string(),
        article_text: z.string(),
        article_date: z.string()
    }),
    quotes: z.array(z.object({
        speaker_name: z.string(),
        raw_quote_text: z.string(),
        summary: z.string(),
        id: z.string().optional()
    }))
});

const QuoteValidation = z.object({
    speaker_name: z.string(),
    id: z.string(),
    raw_quote_text: z.string(),
    summary: z.string(),
    is_valid: z.boolean(),
    invalid_reason: z.string().optional()
});


/* Graph components: define the components that will make up the graph */

const OverallState = Annotation.Root({
    parent_monitored_urls: Annotation<string[]>({
        initial: []
    }),
    quotes: Annotation<z.infer<typeof Quotes>>({
        initial: [],
        reducer: (state, update) => {
            // Create a shallow copy of the existing state to avoid mutation
            const updatedState = [...state];

            update.forEach(newArticle => {
                const existingArticleIndex = updatedState.findIndex(
                    article => article.article_metadata.article_url === newArticle.article_metadata.article_url
                );

                if (existingArticleIndex !== -1) {
                    const existingArticle = updatedState[existingArticleIndex];

                    // Merge article metadata
                    const mergedArticleMetadata = {
                        ...existingArticle.article_metadata,
                        ...newArticle.article_metadata
                    };

                    // Merge quotes without duplicates and combine data
                    const mergedQuotes = mergeQuotes(existingArticle.quotes, newArticle.quotes);

                    // Merge status: prefer new status if provided
                    const mergedStatus = newArticle.status || existingArticle.status;

                    // Update the existing article entry
                    updatedState[existingArticleIndex] = {
                        article_metadata: mergedArticleMetadata,
                        quotes: mergedQuotes,
                        status: mergedStatus
                    };
                } else {
                    // Add new article to the state
                    updatedState.push(newArticle);
                }
            });

            return updatedState;
        }
    })
});

// Helper function to merge quotes arrays without duplicates
const mergeQuotes = (existingQuotes: any[], newQuotes: any[]) => {
    const mergedQuotes = [...existingQuotes];
    
    newQuotes.forEach(newQuote => {
        // Find existing quote by ID
        const existingQuoteIndex = mergedQuotes.findIndex(
            existingQuote => existingQuote.id === newQuote.id
        );

        if (existingQuoteIndex !== -1) {
            const existingQuote = mergedQuotes[existingQuoteIndex];
            
            // Update based on which fields are present in newQuote
            mergedQuotes[existingQuoteIndex] = {
                ...existingQuote,
                // Update validation fields if present
                ...(newQuote.is_valid !== undefined && {
                    raw_quote_text: newQuote.raw_quote_text,
                    speaker_name: newQuote.speaker_name,
                    summary: newQuote.summary,
                    is_valid: newQuote.is_valid,
                    invalid_reason: newQuote.invalid_reason
                }),
                // Update similarity fields if present
                ...(newQuote.similarity_score !== undefined && {
                    similar_to_quote_id: newQuote.similar_to_quote_id,
                    similar_to_staged_quote_id: newQuote.similar_to_staged_quote_id, // Add similar_to_staged_quote_id
                    similarity_score: newQuote.similarity_score
                })
            };
        } else {
            // Add new quote
            mergedQuotes.push(newQuote);
        }
    });

    return mergedQuotes;
};

// Interface for mapping over parent URLs to extract headlines / article URLs
interface ParentURLState {
    parent_monitored_url: string;
}

//Interface mapping over article URLs to extract article text
interface ArticleMarkdownState {
    parent_monitored_url: string;
    article_url: string;
    article_headline: string;
}

// Interface for mapping over article text to extract quotes
interface ArticleState {
    article_metadata: {
        parent_monitored_url: string;
        article_url: string;
        article_text: string;
        article_headline: string;
        article_date: string;
    }
    today_date: string;
}

// Interface for mapping over initially extracted quotes to validate them
interface QuoteValidationState {
    quote_object: {
        article_metadata: {
            parent_monitored_url: string;
            article_url: string;
            article_date: string;
            article_headline: string;
            article_text: string;
        };
        quotes: Array<{
            speaker_name: string;
            raw_quote_text: string;
            summary: string;
            similar_to_quote_id?: string;
            similar_to_staged_quote_id?: string; // Add similar_to_staged_quote_id
            similarity_score?: number;
            is_valid?: boolean;
            invalid_reason?: string;
            id?: string;
        }>;
    };
    today_date: string;
}


// Function to fetch parent URLs as first node
const fetchParentURLs = async (
    state: typeof OverallState.State
): Promise<Partial<typeof OverallState.State>> => {
    const { data: parent_monitored_urls, error } = await supabase
        .from('monitored_urls')
        .select('url');

    if (error) {
        throw new Error(`Failed to fetch parent URLs: ${error.message}`);
    }

    return {
        parent_monitored_urls: parent_monitored_urls.map(row => row.url)
    };
};

// Hardcoded list of additional URLs to process
const additionalUrls = [
    {
        parent_monitored_url: "https://www.bbc.com/sport/football/teams/manchester-united",
        article_url: "https://www.bbc.com/sport/football/teams/manchester-united",
        article_headline: "BBC Manchester United Homepage"
    }
    // Add more URLs here as needed
];

// Function to check if article URL has already been processed
const checkExistingArticleUrl = async (article_url: string): Promise<boolean> => {
    // Check quotes table
    const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('article_url')
        .eq('article_url', article_url)
        .limit(1);
    
    if (quotesError) {
        console.error('Error checking quotes table:', quotesError);
        return false;
    }

    // Check quote_staging table
    const { data: stagedData, error: stagedError } = await supabase
        .from('quote_staging')
        .select('article_url')
        .eq('article_url', article_url)
        .limit(1);
    
    if (stagedError) {
        console.error('Error checking quote_staging table:', stagedError);
        return false;
    }

    // Check articles table
    const { data: articlesData, error: articlesError } = await supabase
        .from('articles')
        .select('article_url')
        .eq('article_url', article_url)
        .limit(1);
    
    if (articlesError) {
        console.error('Error checking articles table:', articlesError);
        return false;
    }
    
    // Return true if URL exists in any table
    return (quotesData && quotesData.length > 0) || 
           (stagedData && stagedData.length > 0) || 
           (articlesData && articlesData.length > 0);
};

// Function to extract headlines as second node
const extractHeadlines = async (
    state: ParentURLState
): Promise<Partial<typeof OverallState.State>> => {
    console.log("\nProcessing headlines for:", state.parent_monitored_url);
    
    return new Promise((resolve) => {
        const operation = async () => {
            // Get markdown from jina.ai
            const markdown = await getJinaMarkdown(state.parent_monitored_url);
            if (!markdown) {
                console.log(`No markdown content found for ${state.parent_monitored_url}`);
                resolve({ quotes: [] });
                return;
            }

            const prompt = headlineExtractionPrompt
                .replace("{parent_url_markdown}", markdown)
                .replace("{parent_monitored_url}", state.parent_monitored_url);

            try {
                const completion = await openai.beta.chat.completions.parse({
                    model: "gpt-4o-mini",
                    messages: [{ role: "user", content: prompt }],
                    response_format: zodResponseFormat(Headlines, "headlines")
                });

                const response = completion.choices[0].message.parsed;
                
                // Extract domain from parent monitored URL
                const parentDomain = new URL(state.parent_monitored_url).hostname.replace('www.', '');
                
                // Filter headlines to only include those from the same domain
                const validHeadlines = response.headlines.filter(headline => {
                    try {
                        const articleDomain = new URL(headline.article_url).hostname.replace('www.', '');
                        return articleDomain === parentDomain;
                    } catch {
                        return false;
                    }
                });

                // Filter out headlines that already exist in quotes table
                const newHeadlines = [];
                for (const headline of validHeadlines) {
                    const exists = await checkExistingArticleUrl(headline.article_url);
                    if (!exists) {
                        newHeadlines.push(headline);
                    }
                }

                console.log(`Found ${validHeadlines.length} valid headlines, ${validHeadlines.length - newHeadlines.length} already processed from ${state.parent_monitored_url}`);
                
                // Combine extracted headlines with hardcoded URLs
                const combinedHeadlines = [...newHeadlines];
                
                // Only add additional URLs if we're processing the main parent URL
                if (state.parent_monitored_url === additionalUrls[0]?.parent_monitored_url) {
                    // Always include all hardcoded URLs without filtering
                    combinedHeadlines.push(...additionalUrls);
                    console.log(`Added ${additionalUrls.length} hardcoded URLs`);
                }
                
                // Add this log here
                console.log(`Total new articles to process: ${combinedHeadlines.length} from ${state.parent_monitored_url}`);
                
                // Transform headlines into quotes structure
                const quotes = combinedHeadlines.map(headline => ({
                    article_metadata: {
                        parent_monitored_url: state.parent_monitored_url,
                        article_url: headline.article_url,
                        article_headline: headline.article_headline,
                        article_text: "", // Will be populated later
                        article_date: "", // Will be populated later
                    },
                    quotes: [], // Empty array to be populated later
                }));
                
                resolve({ quotes });
            } catch (error) {
                console.error("Failed to extract headlines:", error);
                resolve({ quotes: [] });
            }
        };

        requestQueue.push(operation);
        processQueue();
    });
};

const processQueue = async () => {
    while (requestQueue.length > 0 && currentActiveRequests < maxConcurrentRequests) {
        const nextRequest = requestQueue.shift();
        if (nextRequest) {
            currentActiveRequests++;
            try {
                await nextRequest();
            } finally {
                currentActiveRequests--;
                processQueue();
            }
        }
    }
};

// Function to extract article text
const extractArticleText = async (
    state: ArticleMarkdownState
): Promise<Partial<typeof OverallState.State>> => {
    const executeRequest = async () => {
        const today_date = new Date().toISOString().split('T')[0];  // Get today's date in YYYY-MM-DD format
        
        try {
            const markdown = await getJinaMarkdown(state.article_url);
            
            // Validate markdown content
            if (!markdown || typeof markdown !== 'string') {
                console.error(`No valid markdown content found for ${state.article_url}`);
                return createErrorState(state, today_date, 'No valid markdown content found');
            }

            // Log markdown content length for debugging
            console.log(`Retrieved markdown content for ${state.article_headline}, length: ${markdown.length} characters`);
            if (markdown.length < 100) {
                console.warn("Markdown content seems too short, might be missing content");
                console.log("Markdown content:", markdown);
                return createErrorState(state, today_date, 'Markdown content too short');
            }
            
            // Format the prompt with the actual values
            const prompt = articleExtractionPrompt
                .replace("{article_url_markdown}", markdown)
                .replace("{parent_monitored_url}", state.parent_monitored_url)
                .replace("{article_url}", state.article_url)
                .replace("{article_headline}", state.article_headline)
                .replace("{today_date}", today_date);

            logOpenAICall('start', 'extractArticleText', 'gpt-4o-mini', state.article_url, {
                function_name: 'extractArticleText',
                model: 'gpt-4o-mini',
                url: state.article_url,
                prompt: prompt
            });

            // Log the request
            logger.logOpenAICall({
                function_name: 'extractArticleText',
                model: 'gpt-4o-mini',
                url: state.article_url,
                prompt: prompt
            });

            const completion = await openai.beta.chat.completions.parse({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                response_format: zodResponseFormat(Article, "article")
            });

            const response = completion.choices[0].message.parsed;

            // Validate article text
            if (!response.article_text || typeof response.article_text !== 'string') {
                console.error("Extracted article text is missing or invalid type");
                return createErrorState(state, today_date, 'Article text missing or invalid');
            }

            if (response.article_text.length < 100) {
                console.warn("Extracted article text is too short");
                return createErrorState(state, today_date, 'Extracted article text too short');
            }

            // Log successful extraction
            console.log(`Successfully extracted article text for ${state.article_headline}, length: ${response.article_text.length} characters`);

            // Save article data to the database with retry logic
            const saveArticleData = async () => {
                const articleData = {
                    parent_monitored_url: state.parent_monitored_url,
                    article_url: state.article_url,
                    article_date: new Date(response.article_date || response.publishedTime || today_date),
                    headline: state.article_headline,
                    article_text: response.article_text,
                    total_quotes: 0, // Will be updated later in extractQuotes
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                const { error } = await supabase
                    .from('articles')
                    .upsert(articleData, {
                        onConflict: 'article_url'
                    });

                if (error) throw error;

                // Verify the save was successful
                const { data: verifyData, error: verifyError } = await supabase
                    .from('articles')
                    .select('article_url, article_text, headline')
                    .eq('article_url', state.article_url)
                    .single();

                if (verifyError) throw verifyError;

                // Check if the data was saved correctly
                if (!verifyData || verifyData.article_text !== response.article_text) {
                    throw new Error('Article data verification failed: Data mismatch or missing');
                }

                console.log(`Successfully saved and verified article data for: ${state.article_headline}`);
            };

            try {
                await withRetry(
                    saveArticleData,
                    3,  // maxRetries for database operations
                    1000 // initialDelayMs
                );
            } catch (error) {
                console.error("Error saving article data after retries:", error);
                logger.logError({
                    function_name: 'extractArticleText',
                    error: error,
                    article_metadata: {
                        parent_monitored_url: state.parent_monitored_url,
                        article_url: state.article_url,
                        article_headline: state.article_headline
                    }
                });

                // Track failed article saves for later retry
                await supabase
                    .from('failed_operations')
                    .insert({
                        operation_type: 'article_save',
                        article_url: state.article_url,
                        article_headline: state.article_headline,
                        error_message: error.message,
                        retry_count: 0,
                        status: 'pending',
                        metadata: {
                            parent_monitored_url: state.parent_monitored_url,
                            article_text: response.article_text,
                            article_date: response.article_date || response.publishedTime || today_date,
                            total_quotes: 0
                        },
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .single();

                // Also log to error_logs for monitoring
                await supabase
                    .from('error_logs')
                    .insert({
                        error_type: 'article_save_failure',
                        error_message: error.message,
                        article_url: state.article_url,
                        stack_trace: error.stack,
                        metadata: {
                            parent_monitored_url: state.parent_monitored_url,
                            article_headline: state.article_headline,
                            retry_attempts: 3,
                            article_date: response.article_date || response.publishedTime || today_date
                        },
                        created_at: new Date().toISOString()
                    })
                    .single();
            }

            // Wait for all database operations to complete
            await Promise.all([
                // Update article quote count
                updateArticleQuoteCount(state.article_url, 0),
                
                // Save all quotes to staging
                Promise.all((response.quotes || []).map(async (quote) => {
                    if (!quote) return null;
                    
                    const { data: stagedQuote, error: stagingError } = await supabase
                        .from('quote_staging')
                        .insert({
                            parent_monitored_url: state.parent_monitored_url,
                            article_url: state.article_url,
                            article_headline: state.article_headline,
                            article_date: today_date,
                            raw_quote_text: quote.raw_quote_text,
                            speaker_name: quote.speaker_name,
                            summary: quote.summary,
                            similar_to_quote_id: null,
                            similar_to_staged_quote_id: null, // Add similar_to_staged_quote_id
                            similarity_score: null,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        })
                        .select('id')
                        .single();

                    if (stagingError) {
                        console.error('Error saving quote to staging:', stagingError);
                        quote.id = null;
                        return quote;
                    }

                    // Store the staging ID in the quote state
                    quote.id = stagedQuote.id;
                    return quote;
                }))
            ]);

            // Return successful state with article text and metadata
            return {
                quotes: [{
                    article_metadata: {
                        parent_monitored_url: state.parent_monitored_url,
                        article_url: state.article_url,
                        article_headline: state.article_headline,
                        article_text: response.article_text,
                        article_date: response.article_date || response.publishedTime || today_date
                    },
                    quotes: response.quotes || [],
                    status: 'articleTextExtracted'
                }]
            };

        } catch (error) {
            console.error(`Error in extractArticleText for ${state.article_url}:`, error);
            return createErrorState(state, today_date, error.message);
        }
    };

    return new Promise((resolve) => {
        requestQueue.push(async () => {
            const result = await executeRequest();
            resolve(result);
        });
        processQueue();
    });
};

// Helper function to create error state with consistent structure
const createErrorState = (state: ArticleMarkdownState, today_date: string, errorMessage: string) => {
    console.error(`Error for ${state.article_url}: ${errorMessage}`);
    return {
        quotes: [{
            article_metadata: {
                parent_monitored_url: state.parent_monitored_url,
                article_url: state.article_url,
                article_headline: state.article_headline,
                article_text: '',
                article_date: today_date
            },
            quotes: [],
            status: 'error',
            error: errorMessage
        }]
    };
};

// Gemini quote extraction function
const extractQuotesWithGemini = async (
    state: ArticleState
): Promise<Partial<typeof OverallState.State>> => {
    console.log("\nExtracting quotes with Gemini from article:", state.article_metadata.article_headline);
    
    const prompt = quoteExtractionPrompt
        .replace("{parent_monitored_url}", state.article_metadata.parent_monitored_url)
        .replace("{article_url}", state.article_metadata.article_url)
        .replace("{article_headline}", state.article_metadata.article_headline)
        .replace("{article_text}", state.article_metadata.article_text)
        .replace("{today_date}", state.today_date);
        
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await withRetry(() => model.generateContent(prompt));
    const response = JSON.parse(result.response.text());
        
    console.log(`Found ${response.quotes.length} quotes in article: ${state.article_metadata.article_headline}`);
    
    return { 
        quotes: [{
            article_metadata: {
                parent_monitored_url: state.article_metadata.parent_monitored_url,
                article_url: state.article_metadata.article_url,
                article_headline: state.article_metadata.article_headline,
                article_text: state.article_metadata.article_text,
                article_date: state.today_date
            },
            quotes: response.quotes
        }]
    };
};

// Function to extract quotes
const extractQuotes = async (
    state: ArticleState
): Promise<Partial<typeof OverallState.State>> => {
    return new Promise((resolve) => {
        const operation = async () => {
            try {
                // Define prompt first using the template
                const prompt = quoteExtractionPrompt
                    .replace("{parent_monitored_url}", state.article_metadata.parent_monitored_url)
                    .replace("{article_url}", state.article_metadata.article_url)
                    .replace("{article_headline}", state.article_metadata.article_headline)
                    .replace("{article_text}", state.article_metadata.article_text)
                    .replace("{today_date}", state.today_date);

                const completion = await openai.beta.chat.completions.parse({
                    model: "gpt-4o-mini",
                    messages: [{ role: "user", content: prompt }],
                    response_format: zodResponseFormat(ExtractedQuotes, "quotes")
                });

                const response = completion.choices[0].message.parsed;

                console.log(`Extracted ${response.quotes.length} quotes from article: ${state.article_metadata.article_headline}`);

                // Wait for all database operations to complete
                await Promise.all([
                    // Update article quote count
                    updateArticleQuoteCount(state.article_metadata.article_url, response.quotes.length),
                    
                    // Save all quotes to staging
                    Promise.all(response.quotes.map(async (quote) => {
                        const { data: stagedQuote, error: stagingError } = await supabase
                            .from('quote_staging')
                            .insert({
                                parent_monitored_url: state.article_metadata.parent_monitored_url,
                                article_url: state.article_metadata.article_url,
                                article_headline: state.article_metadata.article_headline,
                                article_date: state.today_date,
                                raw_quote_text: quote.raw_quote_text,
                                speaker_name: quote.speaker_name,
                                summary: quote.summary,
                                similar_to_quote_id: null,
                                similar_to_staged_quote_id: null, // Add similar_to_staged_quote_id
                                similarity_score: null,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            })
                            .select('id')
                            .single();

                        if (stagingError) {
                            console.error('Error saving quote to staging:', stagingError);
                            quote.id = null;
                            return quote;
                        }

                        // Store the staging ID in the quote state
                        quote.id = stagedQuote.id;
                        return quote;
                    }))
                ]);

                // Only after database operations complete, update state
                resolve({ 
                    quotes: [{
                        article_metadata: {
                            parent_monitored_url: state.article_metadata.parent_monitored_url,
                            article_url: state.article_metadata.article_url,
                            article_headline: state.article_metadata.article_headline,
                            article_text: state.article_metadata.article_text,
                            article_date: state.today_date
                        },
                        quotes: response.quotes,
                        status: 'quotesExtracted'
                    }]
                });
            } catch (error) {
                // Log any validation errors
                logger.logOpenAICall({
                    function_name: 'extractQuotes',
                    model: 'gpt-4o-mini',
                    url: state.article_metadata.article_url,
                    prompt: prompt,
                    error: error
                });

                console.error("Error in extractQuotes for article:", state.article_metadata.article_headline);
                console.error(error);
                
                // Return empty quotes array on error to allow processing to continue
                resolve({ 
                    quotes: [{  // Return array with one object
                        article_metadata: {
                            parent_monitored_url: state.article_metadata.parent_monitored_url,
                            article_url: state.article_metadata.article_url,
                            article_headline: state.article_metadata.article_headline,
                            article_text: state.article_metadata.article_text,
                            article_date: state.today_date
                        },
                        quotes: []
                    }]
                });
            }
        };

        requestQueue.push(operation);
        processQueue();
    });
};

// Function to update just the quote count for an article
async function updateArticleQuoteCount(articleUrl: string, quoteCount: number) {
    try {
        const { error } = await supabase
            .from('articles')
            .update({ total_quotes: quoteCount })
            .eq('article_url', articleUrl);

        if (error) {
            logger.error(`Error updating quote count: ${error.message}`);
            throw error;
        }
    } catch (error) {
        logger.error(`Error in updateArticleQuoteCount: ${error}`);
        throw error;
    }
}

// Function to check quote similarity
const checkQuoteSimilarity = async (
    state: QuoteValidationState
): Promise<Partial<typeof OverallState.State>> => {
    const { quotes, article_metadata } = state.quote_object;

    if (!quotes || quotes.length === 0) {
        return { quotes: [] };
    }

    console.log(`Starting similarity check for ${quotes.length} quotes from article: ${article_metadata.article_headline}`);

    // Track quotes that need processing
    let quotesToProcess = quotes.map(quote => ({
        ...quote,
        embedding: null,
        hasEmbedding: false,
        hasSimilarityData: false
    }));

    // Step 1: Generate embeddings for all quotes in batch
    console.log("Generating embeddings for all quotes...");
    for (const quote of quotesToProcess) {
        if (!quote.hasEmbedding) {
            try {
                quote.embedding = await withRetry(async () => {
                    return await getQuoteEmbedding(quote.raw_quote_text);
                    });
                    quote.hasEmbedding = true;
                console.log(`Generated embedding for quote: "${quote.raw_quote_text.substring(0, 50)}..."`);
            } catch (error) {
                console.error("Failed to generate embedding after retries:", {
                    error,
                    quote: quote.raw_quote_text.substring(0, 100),
                    speaker: quote.speaker_name
                });
            }
        }
    }

    // Step 2: Process similarity for all quotes with embeddings
    console.log("Processing similarity for all quotes with embeddings...");
    for (const quote of quotesToProcess) {
        if (quote.hasEmbedding && !quote.hasSimilarityData) {
            try {
                const result = await withRetry(async () => {
                    // Find most similar quote
                    const { data: similarQuotes, error: rpcError } = await supabase.rpc(
                        'find_most_similar_quote',
                        {
                            query_embedding: quote.embedding,
                            match_count: 1
                        }
                    );

                    if (rpcError) throw rpcError;

                    const mostSimilarQuote = similarQuotes?.[0];
                    const similarityData = {
                        content_vector: quote.embedding,
                        similar_to_quote_id: mostSimilarQuote?.similar_to_quote_id || null,
                        similar_to_staged_quote_id: mostSimilarQuote?.similar_to_staged_quote_id || null,
                        similarity_score: mostSimilarQuote?.similarity_score || null,
                        updated_at: new Date().toISOString()
                    };

                    // Update database
                    const { error: updateError } = await supabase
                        .from('quote_staging')
                        .update(similarityData)
                        .eq('id', quote.id);

                    if (updateError) throw updateError;

                    return similarityData;
                });

                // Update quote with similarity data
                quote.similar_to_quote_id = result.similar_to_quote_id;
                quote.similar_to_staged_quote_id = result.similar_to_staged_quote_id;
                quote.similarity_score = result.similarity_score;
                quote.hasSimilarityData = true;

                console.log(`Processed similarity for quote: "${quote.raw_quote_text.substring(0, 50)}..."`);
            } catch (error) {
                console.error("Failed to process similarity:", {
                    quote: quote.raw_quote_text.substring(0, 50),
                    error
                });
            }
        }
    }

    // Step 3: Check if any quotes still need processing
    const incompleteQuotes = quotesToProcess.filter(
        q => !q.hasEmbedding || !q.hasSimilarityData
    );

    if (incompleteQuotes.length > 0) {
        console.error(`Failed to process ${incompleteQuotes.length}/${quotes.length} quotes from ${article_metadata.article_headline}`);

        // Log failed quotes
        await Promise.all(incompleteQuotes.map(quote => 
            supabase.from('failed_operations').insert({
                operation_type: 'quote_similarity',
                article_url: article_metadata.article_url,
                article_headline: article_metadata.article_headline,
                raw_quote_text: quote.raw_quote_text,
                speaker_name: quote.speaker_name,
                error_message: !quote.hasEmbedding ? 
                    'Failed to generate embedding' : 
                    'Failed to process similarity data',
                retry_count: 3,
                status: 'failed',
                metadata: {
                    parent_monitored_url: article_metadata.parent_monitored_url,
                    article_date: article_metadata.article_date,
                    has_embedding: quote.hasEmbedding,
                    has_similarity: quote.hasSimilarityData
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
        ));

        // Return error state
        throw new Error(`Failed to process ${incompleteQuotes.length} quotes after retries`);
    }

    // Step 4: Return processed quotes
    console.log(`Successfully processed all ${quotes.length} quotes from article: ${article_metadata.article_headline}`);
    
        // Return state update with processed quotes and their verified similarity data
    return {
        quotes: [{
            article_metadata,
            quotes: quotesToProcess.map(quote => ({
                ...quote,
                similar_to_quote_id: quote.similar_to_quote_id,
                similar_to_staged_quote_id: quote.similar_to_staged_quote_id,
                similarity_score: quote.similarity_score
            })),
            status: 'quoteSimilarityChecked'
        }]
    };
};

// Function to validate quotes
const validateQuotes = async (
    state: QuoteValidationState
): Promise<Partial<typeof OverallState.State>> => {
    return new Promise((resolve) => {
        const operation = async () => {
            try {
                // Format quotes for validation
                const quotesForValidation = state.quote_object.quotes.map(quote => ({
                    speaker_name: quote.speaker_name,
                    raw_quote_text: quote.raw_quote_text,
                    summary: quote.summary,
                    id: quote.id,
                    is_valid: undefined,  // This will be filled by the validation
                    invalid_reason: undefined // This will be filled by the validation
                }));

                const prompt = quoteValidationPrompt
                    .replace("{quotes_to_validate}", JSON.stringify(quotesForValidation, null, 2))
                    .replace("{article_text}", state.quote_object.article_metadata.article_text)
                    .replace("{parent_monitored_url}", state.quote_object.article_metadata.parent_monitored_url)
                    .replace("{article_url}", state.quote_object.article_metadata.article_url)
                    .replace("{article_headline}", state.quote_object.article_metadata.article_headline);

                // Add detailed logging
                console.log("\nValidation Prompt Details:");
                console.log("Article:", state.quote_object.article_metadata.article_headline);
                console.log("Number of quotes to validate:", quotesForValidation.length);
                console.log("Quotes being validated:", JSON.stringify(quotesForValidation, null, 2));

                // Log the validation request
                logger.logOpenAICall({
                    function_name: 'validateQuotes',
                    model: 'gpt-4o-mini',
                    url: state.quote_object.article_metadata.article_url,
                    prompt: prompt
                });

                logOpenAICall('start', 'validateQuotes', 'gpt-4o-mini', state.quote_object.article_metadata.article_url);
                
                const completion = await openai.beta.chat.completions.parse({
                    model: "gpt-4o-mini",
                    messages: [{ role: "user", content: prompt }],
                    response_format: zodResponseFormat(z.object({
                        quotes: z.array(QuoteValidation)
                    }), "quotes")
                });

                const validatedQuotes = completion.choices[0].message.parsed.quotes;

                // Log the validated quotes
                console.log('Validated Quotes from LLM:', JSON.stringify(validatedQuotes, null, 2));

                // Merge validation results with original quotes to preserve all data
                const updatedQuotes = await Promise.all(state.quote_object.quotes.map(async (quote) => {
                    const validationResult = validatedQuotes.find(
                        vq => vq.raw_quote_text === quote.raw_quote_text && 
                             vq.speaker_name === quote.speaker_name
                    );

                    // Ensure validation data has default values if missing
                    const isValid = validationResult?.is_valid ?? false;
                    const invalidReason = validationResult?.invalid_reason || null;

                    // Update database with validation data
                    try {
                        const { data, error } = await supabase
                            .from('quote_staging')
                            .update({
                                is_valid: isValid,
                                invalid_reason: invalidReason,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', quote.id)
                            .select();

                        if (error) {
                            console.error(`Failed to update quote ${quote.id} in database:`, error);
                            throw error;
                        }

                        console.log(`Successfully updated quote ${quote.id} validation status`);
                        
                        // Return updated quote with validation data
                        return {
                            ...quote,
                            is_valid: isValid,
                            invalid_reason: invalidReason
                        };
                    } catch (error) {
                        console.error(`Error updating quote ${quote.id}:`, error);
                        // Return quote with failed validation on error
                        return {
                            ...quote,
                            is_valid: false,
                            invalid_reason: "Database update failed"
                        };
                    }
                }));

                console.log(`Validated ${validatedQuotes.length} quotes from: ${state.quote_object.article_metadata.article_headline}`);

                // Return complete quote objects in state with validation data
                resolve({
                    quotes: [{
                        article_metadata: state.quote_object.article_metadata,
                        quotes: updatedQuotes,
                        status: 'quotesValidated'
                    }]
                });
            } catch (error) {
                console.error("Error in validateQuotes:", error);
                // On error, return original quotes without validation but preserve existing data
                resolve({
                    quotes: [{
                        article_metadata: state.quote_object.article_metadata,
                        quotes: state.quote_object.quotes.map(quote => ({
                            ...quote,
                            is_valid: false,
                            invalid_reason: "Validation failed: " + error.message
                        }))
                    }]
                });
            }
        };

        requestQueue.push(operation);
        processQueue();
    });
};

// Function to check if speaker exists in speakers table
const checkSpeakerExists = async (speaker: string): Promise<{exists: boolean, id?: string}> => {
    const { data, error } = await supabase
        .from('speakers')
        .select('id')
        .ilike('name', speaker)
        .limit(1);
    
    if (error) {
        console.error('Error checking speaker:', error);
        return {exists: false};
    }
    
    return {
        exists: data && data.length > 0,
        id: data && data.length > 0 ? data[0].id : undefined
    };
};

// Function to move quote from staged to saved
const moveQuoteToSaved = async (quote: any, articleMetadata: any, speakerId: string) => {
    const { error: insertError } = await supabase
        .from('quotes')
        .insert({
            speaker_id: speakerId,
            raw_quote_text: quote.raw_quote_text,
            summary: quote.summary,
            article_url: articleMetadata.article_url,
            article_date: articleMetadata.article_date,
            parent_monitored_url: articleMetadata.parent_monitored_url,
            article_headline: articleMetadata.article_headline,
            content_vector: quote.content_vector,
            similar_to_quote_id: quote.similar_to_quote_id,
            similarity_score: quote.similarity_score,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

    if (insertError) {
        console.error('Error inserting quote:', insertError);
        return false;
    }

    // Delete from quote_staging
    const { error: deleteError } = await supabase
        .from('quote_staging')
        .delete()
        .eq('raw_quote_text', quote.raw_quote_text)
        .eq('speaker_name', quote.speaker_name);

    if (deleteError) {
        console.error('Error deleting staged quote:', deleteError);
        return false;
    }

    return true;
};

// Function to process validated quotes
const processValidatedQuotes = async (
    state: QuoteValidationState
): Promise<Partial<typeof OverallState.State>> => {
    const quotesObject = state.quote_object;
    const quotes = quotesObject.quotes;
    const article_metadata = quotesObject.article_metadata;

    try {
        // Process all quotes and wait for all operations to complete
        const processedQuotes = await Promise.all(quotes.map(async (quote) => {
            try {
                // Only check speakers for valid quotes
                if (quote.is_valid) {
                    const {exists, id} = await checkSpeakerExists(quote.speaker_name);
                    
                    if (exists && id) {
                        // Wait for move operation to complete
                        const moved = await moveQuoteToSaved(quote, article_metadata, id);
                        if (moved) {
                            console.log(`Quote from ${quote.speaker_name} moved to saved quotes`);
                        }
                    } else {
                        console.log(`Valid quote from ${quote.speaker_name} remains in staged (speaker not in database)`);
                    }
                } else {
                    console.log(`Invalid quote from ${quote.speaker_name} remains in staged for review`);
                }

                return quote;
            } catch (error) {
                console.error("Error processing quote:", error);
                return quote;
            }
        }));

        // Only after all database operations complete, update state
        return {
            quotes: [{
                article_metadata,
                quotes: processedQuotes,
                status: 'quotesPublished'  // Add status on success too
            }]
        };
    } catch (error) {
        console.error("Error in processValidatedQuotes:", error);
        return {
            quotes: [{
                article_metadata,
                quotes: quotes,  // Return original quotes on error
                status: 'quotesPublished'  // Set status here
            }]
        };
    }
};


// Here we define the logic to map out over the parent URLs
const continueToHeadlines = (state: typeof OverallState.State) => {
    // For each parent URL, we will create a send object that triggers the extractHeadlines function 
    return state.parent_monitored_urls.map((parent_monitored_url) => new Send("extractHeadlines", { 
        parent_monitored_url: parent_monitored_url 
    }));
};

// Here we define the logic to map out over the headlines / article URLs
const continueToArticles = (state: typeof OverallState.State) => {
    return state.quotes
        .filter(article => article.status !== 'articleTextExtracted')
        .map(article => new Send("extractArticleText", {
            parent_monitored_url: article.article_metadata.parent_monitored_url,
            article_url: article.article_metadata.article_url,
            article_headline: article.article_metadata.article_headline
        }));
};

// Here we define the logic to map out over the articles
const continueToQuotes = (state: typeof OverallState.State) => {
    // Map over the quotes array which contains our article metadata
    return state.quotes
        .filter(article => article.status === 'articleTextExtracted')
        .map((article) => new Send("extractQuotes", { 
                article_metadata: {
                    parent_monitored_url: article.article_metadata.parent_monitored_url,
                    article_url: article.article_metadata.article_url,
                    article_headline: article.article_metadata.article_headline,
                    article_text: article.article_metadata.article_text,
                    article_date: article.article_metadata.article_date
                },
                today_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
        }));
};

const continueToQuoteSimilarity = (state: typeof OverallState.State) => {    
    console.log("State in continueToQuoteSimilarity:", JSON.stringify(state.quotes, null, 2));
    
    return state.quotes
        .filter(article => article.status === 'quotesExtracted')
        .flatMap((quoteObj) => {  // Use flatMap to handle the nested array
            return new Send("checkQuoteSimilarity", {
                quote_object: quoteObj,
                today_date: new Date().toISOString().split('T')[0]
            });
        });
};

const continueToQuoteValidation = (state: typeof OverallState.State) => {
    return state.quotes
        .filter(article => article.status === 'quoteSimilarityChecked')  // Only proceed with articles that have completed similarity check
        .map(articleQuotes => {
            console.log("\nQuote filtering details for article:", articleQuotes.article_metadata.article_headline);
            console.log("Original quotes:", articleQuotes.quotes.length);
            
            // Filter out duplicate quotes based on similarity score
            const uniqueQuotes = articleQuotes.quotes.filter(quote => 
                !quote.similarity_score || // Keep quotes with no similarity score (unique)
                //quote.similarity_score > CONFIG.SIMILARITY.THRESHOLD // Keep quotes that are different enough
            );

            console.log("Unique quotes after filtering:", uniqueQuotes.length);
            console.log("Filtered quotes:", uniqueQuotes.map(q => ({
                speaker: q.speaker_name,
                quote_preview: q.raw_quote_text.substring(0, 50) + "...",
                similarity_score: q.similarity_score || "N/A"
            })));
            console.log(`Filtered out ${articleQuotes.quotes.length - uniqueQuotes.length} similar quotes\n`);
            
            // Send the article with its unique quotes to the validateQuotes node
            return new Send("validateQuotes", {
                quote_object: {
                    article_metadata: articleQuotes.article_metadata,
                    quotes: uniqueQuotes
                },
                today_date: new Date().toISOString().split('T')[0]
            });
        });
};

const continueToProcessValidated = (state: typeof OverallState.State) => {
    return state.quotes
        .filter(article => article.status === 'quotesValidated')
        .map(article => new Send("processValidatedQuotes", {
            quote_object: article,
            today_date: new Date().toISOString().split('T')[0]
        }));
};

// Construct the graph: here we put everything together to construct our graph
const graph = new StateGraph(OverallState)
    .addNode("fetchParentURLs", fetchParentURLs)
    .addNode("extractHeadlines", extractHeadlines)
    .addNode("extractArticleText", extractArticleText)
    .addNode("extractQuotes", extractQuotes)
    .addNode("checkQuoteSimilarity", checkQuoteSimilarity)
    .addNode("validateQuotes", validateQuotes)
    .addNode("processValidatedQuotes", processValidatedQuotes)
    .addEdge(START, "fetchParentURLs")
    .addConditionalEdges("fetchParentURLs", continueToHeadlines)
    .addConditionalEdges("extractHeadlines", continueToArticles)
    .addConditionalEdges("extractArticleText", continueToQuotes)
    .addConditionalEdges("extractQuotes", continueToQuoteSimilarity)
    .addConditionalEdges("checkQuoteSimilarity", continueToQuoteValidation)
    .addConditionalEdges("validateQuotes", continueToProcessValidated)
    .addEdge("processValidatedQuotes", END);

const app = graph.compile();

async function main() {
    let finalState = null;
    
    // Stream the processing
    for await (const chunk of await app.stream({}, {
        streamMode: "values",
    })) {
        // Log each state update with more detail
        console.log("\n==== State Update ====");
        console.log("Timestamp:", new Date().toISOString());
        
        // Log all possible state fields
        const stateFields = [
            'parent_urls',
            'articles',
            'article_text',
            'quotes',
            'validated_quotes',
            'processed_quotes'
        ];

        stateFields.forEach(field => {
            if (chunk[field]) {
                console.log(`\n${field.toUpperCase()}:`);
                if (Array.isArray(chunk[field])) {
                    chunk[field].forEach((item, index) => {
                        console.log(`\n[${index + 1}]`, JSON.stringify(item, null, 2));
                    });
                } else {
                    console.log(JSON.stringify(chunk[field], null, 2));
                }
            }
        });

        console.log("\n==================\n");

        // Keep track of the latest state
        finalState = chunk;
    }

    // Only save results once at the end
    if (finalState && finalState.quotes) {
        await saveGraphResults(
            'openai', // geminior 'openai' depending on which model is being used
            finalState
        );
    }
}

// Run the main function
main().catch(console.error);