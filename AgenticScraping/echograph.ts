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

// Helper for tracking OpenAI calls
let activeRequests = new Set<string>();

// Add counters for tracking progress
let totalArticleCount = 0;
let extractedArticleCount = 0;
let processedArticleCount = 0;
let validatedQuoteCount = 0;
let totalQuotesToValidate = 0;
let totalArticlesToProcess = 0;

const logOpenAICall = (action: 'start' | 'end', functionName: string, modelName: string, url: string) => {
    const requestId = `${functionName}-${url}`;
    if (action === 'start') {
        activeRequests.add(requestId);
        if (functionName === 'extractArticleText') {
            extractedArticleCount++;
            console.log(`Article Text Extraction: ${extractedArticleCount} out of ${totalArticleCount} articles. Current Concurrent Count = ${activeRequests.size}`);
        } else if (functionName === 'extractQuotes') {
            processedArticleCount++;
            console.log(`Quote Extraction: Processing article ${processedArticleCount} out of ${totalArticleCount}. Current Concurrent Count = ${activeRequests.size}`);
        } else if (functionName === 'validateQuotes') {
            validatedQuoteCount++;
            console.log(`Quote Validation: Processing batch ${validatedQuoteCount} out of ${totalQuotesToValidate}. Current Concurrent Count = ${activeRequests.size}`);
        }
    } else {
        activeRequests.delete(requestId);
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
                "X-With-Links-Summary": "true",
                "X-Return-Format": "markdown"
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
    const filename = `${modelType}_run_${timestamp}.json`;
    
    const output = {
        model: modelType,
        timestamp: new Date().toISOString(),
        parent_urls: state.parent_urls,
        headlines: state.headlines,
        articles: state.articles,
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
            "parent_url": "<parent_url>",
            "article_url": "<article_url>",
            "headline": "<headline>",
        }
    `;

const articleExtractionPrompt = `Below is a markdown version of a news article from a website. It contains a lot of text that is not the article content.
Extract just the article text and return it as a string within the data model shown below. Make sure to preserve the parent_url, article_url, and headline exactly as provided.

    # Article Metadata
    parent_url: {parent_url}
    article_url: {article_url}
    headline: {headline}
    
    # Expected Output Format
    {
        "parent_url": "{parent_url}",
        "article_url": "{article_url}",
        "headline": "{headline}",
        "article_text": "The main article text, excluding headers, footers, and other non-article content",
        "article_date": "YYYY-MM-DD",
        "publishedTime": "YYYY-MM-DDTHH:MM:SSZ" // Optional ISO 8601 timestamp if found
    }

    #Instructions
    1. Extract and clean the main article text, removing:
        • Headers, footers, navigation
        • Advertisements
        • Social media buttons
        • Comments sections
        • Related articles
        • Any other non-article content
    
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
    parent_url: {parent_url}
    article_url: {article_url}
    headline: {headline}
    
    ## Expected Output Format
    {
        "article_metadata": {
            "parent_url": "{parent_url}",
            "article_url": "{article_url}",
            "headline": "{headline}",
            "article_text": "{article_text}",
            "article_date": "YYYY-MM-DD"
        },
        "quotes": [
            {
                "speaker": "Name of person quoted",
                "quote_raw": "The exact quote from the text",
                "quote_summary": "A concise version of the quote"
            }
        ]
    }
    
# START OF ARTICLE TEXT

{article_text}

# END OF ARTICLE TEXT`;


const quoteValidationPrompt = `Assess the validity of the quotes in the quote object below.
    Return a JSON object with the same array of quotes but with two additinoal properties on each quote: is_valid and invalid_reason.
]   Invalid quotes should have is_valid set to false and an invalid_reason.
    Valid quotes should have is_valid set to true. invalid_reason should be empty.
    Use the article text to help you determine whether the quote is valid or not.
    
    # Article Text 
    parent_url: {parent_url}
    article_url: {article_url}
    {article_text}

    
    # Raw Quote Text
    {quote_object}
    
    # A quote is only valid if...
    - The raw quote text only contains the words spoken by a named speaker and not the text written by the author of the article. For example, invalid quotes are those attributed to the news publication, article author, or other unnamed speakers (e.g., fans, spokespersons, etc.)`;


// Zod schemas for getting structured output from the LLM
const Headlines = z.object({
    headlines: z.array(z.object({
        parent_url: z.string(),
        article_url: z.string(),
        headline: z.string()
    }))
});

const Article = z.object({
    parent_url: z.string(),
    article_url: z.string(),
    headline: z.string(),
    article_text: z.string(),
    article_date: z.string().optional(), // Make article_date optional
    publishedTime: z.string().optional() // Allow publishedTime as an alternative
}).transform(data => ({
    ...data,
    // If article_date is missing, try to use publishedTime or fallback to current date
    article_date: data.article_date || 
                 (data.publishedTime ? data.publishedTime.split('T')[0] : 
                 new Date().toISOString().split('T')[0])
}));

const Quote = z.object({
    speaker: z.string(),
    quote_raw: z.string(),
    quote_summary: z.string(),
    is_valid: z.boolean().optional()
});

const Quotes = z.object({
    article_metadata: z.object({
        parent_url: z.string(),
        article_url: z.string(),
        headline: z.string(),
        article_text: z.string(),
        article_date: z.string() // Added article_date at metadata level
    }),
    quotes: z.array(Quote)
});

const FinalQuotes = z.object({
    final_quotes: z.array(z.object({
        article_metadata: z.object({
            parent_url: z.string(),
            article_url: z.string(),
            headline: z.string(),
            article_text: z.string(),
            article_date: z.string() // Added article_date at metadata level
        }),
        quotes: z.array(z.object({
            speaker: z.string(),
            quote_raw: z.string(),
            quote_summary: z.string(),
            is_valid: z.boolean(),
            invalid_reason: z.string().optional()
        }))
    }))
});

const MonitoredURLStats = z.object({
    parent_url: z.string(), // assuming YYYY-MM-DD format like article_date
    last_crawl_date: z.string(), // assuming YYYY-MM-DD format like article_date
    no_of_articles: z.number().int(),
    no_of_quotes: z.number().int()
});


/* Graph components: define the components that will make up the graph */

const OverallState = Annotation.Root({
    parent_urls: Annotation<string[]>,  // Changed from single string to array
    headlines: Annotation<z.infer<typeof Headlines>>({
        reducer: (state, update) => {
            // Convert arrays to Set to remove duplicates based on article_url
            const uniqueHeadlines = Array.from(
                new Map(
                    [...state, ...update].map(item => [item.article_url, item])
                ).values()
            );
            return uniqueHeadlines;
        }
    }),
    articles: Annotation<z.infer<typeof Article>>({
        reducer: (state, update) => state.concat(update),
    }),
    quotes: Annotation<z.infer<typeof Quotes>>({
        reducer: (state, update) => state.concat(update),
    }),
    monitored_url_stats: Annotation<z.infer<typeof MonitoredURLStats>>({
        reducer: (state, update) => state.concat(update),  // Added reducer since we'll have stats for each parent_url
    })
});

// Interface for mapping over parent URLs to extract headlines / article URLs
interface ParentURLState {
    parent_url: string;
}

//Interface mapping over article URLs to extract article text
interface ArticleMarkdownState {
    parent_url: string;
    article_url: string;
    headline: string;
}

// Interface for mapping over article text to extract quotes
interface ArticleState {
    parent_url: string;
    article_url: string;
    article_text: string;
    headline: string;
    today_date: string;
}

// Interface for mapping over quotes to validate them
interface QuoteState {
    parent_url: string;
    article_url: string;
    headline: string;
    quote: z.infer<typeof Quote>;
}

// Interface for mapping over initially extracted quotes to validate them
interface QuoteValidationState {
    quote_object: string;
    today_date: string;
}


// Function to fetch parent URLs as first node
const fetchParentURLs = async (
    state: typeof OverallState.State
): Promise<Partial<typeof OverallState.State>> => {
    const { data: parentUrls, error } = await supabase
        .from('monitored_urls')
        .select('url');

    if (error) {
        throw new Error(`Failed to fetch parent URLs: ${error.message}`);
    }

    return {
        parent_urls: parentUrls.map(row => row.url)
    };
};

// Hardcoded list of additional URLs to process
const additionalUrls = [
    {
        parent_url: "https://www.bbc.com/sport/football/teams/manchester-united",
        article_url: "https://www.bbc.com/sport/football/teams/manchester-united",
        headline: "BBC Manchester United Homepage"
    }
    // Add more URLs here as needed
];

// Function to extract headlines as second node
const extractHeadlines = async (
    state: ParentURLState
): Promise<Partial<typeof OverallState.State>> => {
    console.log("\nProcessing headlines for parent URL:", state.parent_url);
    
    return new Promise((resolve) => {
        const operation = async () => {
            // Get markdown from jina.ai
            const markdown = await getJinaMarkdown(state.parent_url);
            if (!markdown) {
                console.log(`No markdown content found for ${state.parent_url}`);
                resolve({ headlines: [] });
                return;
            }

            const prompt = headlineExtractionPrompt
                .replace("{parent_url_markdown}", markdown)
                .replace("{parent_url}", state.parent_url);

            try {
                const completion = await openai.beta.chat.completions.parse({
                    model: "gpt-4o-mini",
                    messages: [{ role: "user", content: prompt }],
                    response_format: zodResponseFormat(Headlines, "headlines")
                });

                const response = completion.choices[0].message.parsed;
                
                // Extract domain from parent URL
                const parentDomain = new URL(state.parent_url).hostname.replace('www.', '');
                
                // Filter headlines to only include those from the same domain
                const validHeadlines = response.headlines.filter(headline => {
                    try {
                        const articleDomain = new URL(headline.article_url).hostname.replace('www.', '');
                        return articleDomain === parentDomain;
                    } catch {
                        return false;
                    }
                });

                console.log(`Found ${validHeadlines.length} valid headlines (from same domain) out of ${response.headlines.length} total for ${state.parent_url}`);
                totalArticleCount += validHeadlines.length;
                
                // Combine extracted headlines with hardcoded URLs
                const combinedHeadlines = [...validHeadlines];
                
                // Only add additional URLs if we're processing the main parent URL
                // This prevents duplicate entries when processing other parent URLs
                if (state.parent_url === additionalUrls[0]?.parent_url) {
                    combinedHeadlines.push(...additionalUrls);
                }
                
                console.log(`Added ${additionalUrls.length} hardcoded URLs to the headlines list`);
                resolve({ headlines: combinedHeadlines });
            } catch (error) {
                console.error("Failed to extract headlines:", error);
                resolve({ headlines: [] });
            }
        };

        requestQueue.push(operation);
        processQueue();
    });
};

// Add semaphore for concurrency control
const maxConcurrentRequests = 10;
let currentActiveRequests = 0;
let extractedQuoteCount = 0;
let totalQuoteCount = 0;
const requestQueue: (() => Promise<void>)[] = [];

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
        const markdown = await getJinaMarkdown(state.article_url);
        if (!markdown) {
            console.log(`No markdown content found for ${state.article_url}`);
            return { articles: [] };
        }
        
        const today_date = new Date().toISOString().split('T')[0];
        
        // Format the prompt with the actual values
        const prompt = articleExtractionPrompt
            .replace("{article_url_markdown}", markdown)
            .replace("{parent_url}", state.parent_url)
            .replace("{article_url}", state.article_url)
            .replace("{headline}", state.headline)
            .replace("{today_date}", today_date);

        try {
            const completion = await openai.beta.chat.completions.parse({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                response_format: zodResponseFormat(Article, "article")
            });

            const response = completion.choices[0].message.parsed;
            extractedArticleCount++;
            console.log(`Article Text Extraction: ${extractedArticleCount} out of ${totalArticleCount} articles. Current Concurrent Count = ${currentActiveRequests}`);

            return { 
                articles: [response]
            };
        } catch (error) {
            console.error("Failed to extract article text:", error);
            
            // If we can parse the output but just missing date, try to salvage it
            if (error.llmOutput) {
                try {
                    const parsedOutput = JSON.parse(error.llmOutput);
                    if (parsedOutput.parent_url && parsedOutput.article_text) {
                        extractedArticleCount++;
                        console.log(`Article Text Extraction: ${extractedArticleCount} out of ${totalArticleCount} articles. Current Concurrent Count = ${currentActiveRequests}`);
                        return {
                            articles: [{
                                ...parsedOutput,
                                article_date: today_date // Use today's date as fallback
                            }]
                        };
                    }
                } catch (parseError) {
                    // If we can't parse the output, just return empty
                }
            }
            return { articles: [] };
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

// Function to extract quotes
const extractQuotes = async (
    state: ArticleState
): Promise<Partial<typeof OverallState.State>> => {
    // Initialize total articles count if this is the first article
    if (processedArticleCount === 0) {
        totalArticlesToProcess = totalArticleCount;
    }

    console.log("\nExtracting quotes from article:", state.headline);
    
    return new Promise((resolve) => {
        const operation = async () => {
            const today_date = new Date().toISOString().split('T')[0];  // Get today's date in YYYY-MM-DD format
            
            // Use the already extracted article text instead of fetching markdown
            const prompt = quoteExtractionPrompt
                .replace("{article_text}", state.article_text)
                .replace("{parent_url}", state.parent_url)
                .replace("{article_url}", state.article_url)
                .replace("{headline}", state.headline)
                .replace("{today_date}", today_date);

            logOpenAICall('start', 'extractQuotes', 'gpt-4o-mini', state.article_url);
            try {
                // Log the request
                logger.logOpenAICall({
                    function_name: 'extractQuotes',
                    model: 'gpt-4o-mini',
                    url: state.article_url,
                    prompt: prompt
                });

                const completion = await openai.beta.chat.completions.parse({
                    model: "gpt-4o-mini",
                    messages: [{ role: "user", content: prompt }],
                    response_format: zodResponseFormat(Quotes, "quotes")
                });

                const response = completion.choices[0].message.parsed;
                
                // Log the successful response
                logger.logOpenAICall({
                    function_name: 'extractQuotes',
                    model: 'gpt-4o-mini',
                    url: state.article_url,
                    prompt: prompt,
                    response: response
                });

                logOpenAICall('end', 'extractQuotes', 'gpt-4o-mini', state.article_url);

                processedArticleCount++;
                console.log(`Found ${response.quotes.length} quotes in article ${processedArticleCount} of ${totalArticlesToProcess}: ${state.headline}`);

                resolve({ 
                    quotes: [response]  // Wrap in array since the state expects an array
                });
            } catch (error) {
                // Log the error
                logger.logOpenAICall({
                    function_name: 'extractQuotes',
                    model: 'gpt-4o-mini',
                    url: state.article_url,
                    prompt: prompt,
                    error: error
                });

                logOpenAICall('end', 'extractQuotes', 'gpt-4o-mini', state.article_url);
                console.error("Error in extractQuotes for article:", state.headline);
                console.error(error);
                
                processedArticleCount++;
                // Return empty quotes array on error to allow processing to continue
                resolve({ 
                    quotes: []
                });
            }
        };

        requestQueue.push(operation);
        processQueue();
    });
};

// Gemini quote extraction function
const extractQuotesWithGemini = async (
    state: ArticleState
): Promise<Partial<typeof OverallState.State>> => {
    console.log("\nExtracting quotes with Gemini from article:", state.headline);
    
    const prompt = quoteExtractionPrompt
        .replace("{article_url}", state.article_url)
        .replace("{article_text}", state.article_text)
        .replace("{today_date}", state.today_date);
        
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await withRetry(() => model.generateContent(prompt));
    const response = JSON.parse(result.response.text());
        
    console.log(`Found ${response.quotes.length} quotes in article: ${state.headline}`);
    
    return { 
        quotes: response.quotes
    };
};

// Function to validate quotes
const validateQuotes = async (
    state: QuoteValidationState
): Promise<Partial<typeof OverallState.State>> => {
    // Parse the quotes object to get the count
    const quotesObject = JSON.parse(state.quote_object);
    
    // Update total quotes to validate if this is the first batch
    if (validatedQuoteCount === 0) {
        totalQuotesToValidate = quotesObject.quotes.length;
    }

    console.log("\nValidating quotes...");

    // Split quotes into smaller chunks to avoid length limits
    const CHUNK_SIZE = 5;
    const quotes = quotesObject.quotes;
    const chunks = [];
    for (let i = 0; i < quotes.length; i += CHUNK_SIZE) {
        chunks.push(quotes.slice(i, i + CHUNK_SIZE));
    }

    const validatedQuotes = [];

    return new Promise((resolve) => {
        const operation = async () => {
            try {
                for (const chunk of chunks) {
                    const prompt = quoteValidationPrompt
                        .replace("{quote_object}", JSON.stringify(chunk))
                        .replace("{article_text}", quotesObject.article_metadata.article_text)
                        .replace("{parent_url}", quotesObject.article_metadata.parent_url)
                        .replace("{article_url}", quotesObject.article_metadata.article_url);

                    // Log the validation request
                    logger.logOpenAICall({
                        function_name: 'validateQuotes',
                        model: 'gpt-4o-mini',
                        url: quotesObject.article_metadata.article_url,
                        prompt: prompt
                    });

                    logOpenAICall('start', 'validateQuotes', 'gpt-4o-mini', quotesObject.article_metadata.article_url);
                    
                    const completion = await openai.beta.chat.completions.parse({
                        model: "ft:gpt-4o-mini-2024-07-18:personal::AVXTE2Zu",
                        messages: [{ role: "user", content: prompt }],
                        response_format: zodResponseFormat(z.array(Quote), "quotes")
                    });

                    const response = completion.choices[0].message.parsed;

                    // Log the successful validation response
                    logger.logOpenAICall({
                        function_name: 'validateQuotes',
                        model: 'gpt-4o-mini',
                        url: quotesObject.article_metadata.article_url,
                        prompt: prompt,
                        response: response
                    });

                    logOpenAICall('end', 'validateQuotes', 'gpt-4o-mini', quotesObject.article_metadata.article_url);
                    validatedQuotes.push(...response);
                    validatedQuoteCount += response.length;
                }

                console.log(`Validated ${validatedQuoteCount} of ${totalQuotesToValidate} quotes`);
                resolve({
                    quotes: [{ ...quotesObject, quotes: validatedQuotes }]
                });
            } catch (error) {
                // Log any validation errors
                logger.logOpenAICall({
                    function_name: 'validateQuotes',
                    model: 'gpt-4o-mini',
                    url: quotesObject.article_metadata.article_url,
                    prompt: 'Error occurred during validation',
                    error: error
                });

                console.error("Error in validateQuotes:", error);
                resolve({
                    quotes: [{ ...quotesObject, quotes: [] }]
                });
            }
        };

        requestQueue.push(operation);
        processQueue();
    });
};
// Here we define the logic to map out over the parent URLs
// We will use this as an edge in the graph
const continueToHeadlines = (state: typeof OverallState.State) => {
    // We will return a list of `Send` objects
    // Each `Send` object consists of the name of a node in the graph as well as the state to send to that node
    return state.parent_urls.map((parent_url) => new Send("extractHeadlines", { parent_url }));
  };

// Here we define the logic to map out over the headlines / article URLs
const continueToArticles = (state: typeof OverallState.State) => {
    // We will return a list of `Send` objects
    // Each `Send` object consists of the name of a node in the graph as well as the state to send to that node
    return state.headlines.map((headline) => new Send("extractArticleText", { 
        parent_url: headline.parent_url, // Use the parent_url from the headline object
        article_url: headline.article_url,
        headline: headline.headline
    }));
};


// Here we define the logic to map out over the articles
const continueToQuotes = (state: typeof OverallState.State) => {
    // Reset quote extraction counters
    extractedQuoteCount = 0;
    totalQuoteCount = state.articles.length;

    // Map over the articles array which contains our extracted article text
    return state.articles.map((article) => new Send("extractQuotes", { 
        parent_url: article.parent_url,
        article_url: article.article_url,
        headline: article.headline,
        article_text: article.article_text,
        today_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    }));
};

const continueToQuoteValidation = (state: typeof OverallState.State) => {
    validatedQuoteCount = 0;
    totalQuotesToValidate = state.quotes.length;

    // Each item in state.quotes is already a response containing all quotes from one article
    return state.quotes.map((articleQuotes) => new Send("validateQuotes", {
        quote_object: JSON.stringify(articleQuotes),
        today_date: new Date().toISOString().split('T')[0]
    }));
};

// Construct the graph: here we put everything together to construct our graph
const graph = new StateGraph(OverallState)
    .addNode("fetchParentURLs", fetchParentURLs)
    .addNode("extractHeadlines", extractHeadlines)
    .addNode("extractArticleText", extractArticleText)
    .addNode("extractQuotes", extractQuotes)
    .addNode("validateQuotes", validateQuotes)
    .addEdge(START, "fetchParentURLs")
    .addConditionalEdges("fetchParentURLs", continueToHeadlines)
    .addConditionalEdges("extractHeadlines", continueToArticles)
    .addConditionalEdges("extractArticleText", continueToQuotes)
    .addConditionalEdges("extractQuotes", continueToQuoteValidation)
    .addEdge("validateQuotes", END);

const app = graph.compile();

async function main() {
    // Stream the processing
    for await (const chunk of await app.stream({}, {
        streamMode: "values",
    })) {
        // Log each state update
        console.log("Current State Update:");
        if (chunk.parent_urls) console.log("Parent URLs:", chunk.parent_urls);
        if (chunk.headlines) console.log("Headlines:", chunk.headlines);
        if(chunk.articles) console.log("Articles:", chunk.articles);
        if (chunk.quotes) console.log("Quotes:", chunk.quotes);
        console.log("\n====\n");

        // Save results when we have quotes (meaning the graph has completed)
        if (chunk.quotes) {
            await saveGraphResults(
                'gemini', // or 'openai' depending on which model is being used
                chunk
            );
        }
    }
}


// Run the main function
main().catch(console.error);