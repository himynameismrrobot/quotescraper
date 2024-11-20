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

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
    chunkSize: 8,
    delayBetweenChunksMs: 60000, // 1 minute
};

// OpenAI Model Initialization
 
const headlineModel = new ChatOpenAI({
    model: "gpt-4o-mini",
});

const quoteValidationModel = new ChatOpenAI({
    model: "ft:gpt-4o-mini-2024-07-18:personal::AVXTE2Zu",
});

const openai = new OpenAI();


// Gemini Schema for getting structured output from the LLM
const quoteExtractionSchema = {
    type: SchemaType.OBJECT,
    properties: {
        quotes: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
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
                    },
                    article_date: {
                        type: SchemaType.STRING,
                        description: "The article date in YYYY-MM-DD format"
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
                "X-Retain-Images": "none",
                "X-Remove-Selector": "header, footer, nav, .ad, .advertisement, .social-share, .comments"
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

//Helper Function for retrying if rate limited
async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
): Promise<T> {
    let retryCount = 0;
    
    while (true) {
        try {
            return await operation();
        } catch (error) {
            if (error?.status === 429 && retryCount < maxRetries) {
                // Get retry delay from header, or use exponential backoff
                const retryAfterMs = parseInt(error?.headers?.['retry-after-ms']) || Math.pow(2, retryCount) * 1000;
                console.log(`Rate limited. Retrying in ${retryAfterMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryAfterMs));
                retryCount++;
            } else {
                throw error;
            }
        }
    }
}

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
        quotes: state.quotes,
        final_quotes: state.final_quotes
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
    Analyze the following Markdown and return a JSON array of objects with 'article_url' and 'headline' properties for all news article headlines that you can find. 
    Respond ONLY with the JSON array, no other text or formatting.
    If no headlines are found, return an empty array.


    #Parent URL Markdown
    {parent_url_markdown}

    
    #EXPECTED OUTPUT
    [
        {
            "article_url": "https://www.theguardian.com/football/2024/nov/15/ruben-amorim-believes-manchester-united-is-where-i-am-supposed-to-be",
            "headline": "Forging new Manchester United identity is my key task, claims Rúben Amorim",
        },
        {
            "article_url": "https://www.theguardian.com/football/video/2024/nov/08/van-nistelrooy-manchester-united-ruben-amorim-video",
            "headline": "Van Nistelrooy keen to stay at Manchester United under Amorim",
    `;

const quoteExtractionPrompt = `Extract all quotes from the provided article. Take your time to do this.
    Return the output as a JSON array of objects, where each object contains the following properties:
	•	speaker: Name of the person who the quote is attributed to.
        •	Don't extract a quote if the speaker is not known
	•	quote_raw: The raw quote text from the article. 
        •	Identify text enclosed within quotation marks (" "), as these represent the quotes to extract. Ensure all quotes, from every quoted speaker, are included.
        •	Ignore header and footer content - only search for quotes that are directly from the article content.
        •	If a quote lacks context to be fully understood, provide a brief contextual note in brackets at the start of the quote, but keep this note concise.
        •	Extract only the spoken content of the quotes, excluding any narrative or commentary from the article’s author.
        •	If a single quote is split across the article, combine the segments into one cohesive quote, but only if they pertain to the same topic. Do not merge quotes that discuss different topics.
	•	quote_summary: A concise version of the quote.
        •	For each quote, generate a more concise version as if the speaker had summarized it themselves. Store this in the quote_summary field.
	•	article_date: The determined article date.
        •	Extract the article date in YYYY-MM-DD format
        •	Use the date provided within the article text, if available.
        •	If not found, check the article URL for a potential date.
        •	If no date is available in the text or URL, use the current date: {today_date}.


	If no quotes are found, double check to make sure you didn't miss anything. If you're certain there are no quotes, return an empty JSON array.
    Return only the JSON array, with no additional text or formatting.

The article URL is: {article_url}.
    
    === START OF ARTICLE TEXT ===
    {article_url_markdown}
    === END OF ARTICLE TEXT ===

    Here's an example of how to extract and format quotes from an article:
    ###EXAMPLE ARTICLE TEXT###
    José Mourinho sarcastically described Clément Turpin as "one of the best referees in the world" after the Fenerbahce manager was sent off in his side's 1-1 draw with former club Manchester United.
    Mourinho was shown a red card after protesting when he thought his side should have had a ­penalty ­during the second half after Youssef ­En-Nesyri had cancelled out ­Christian Eriksen's opening goal. He watched the rest of the match from the stands but revealed afterwards that he had been to see Turpin to ask about his dismissal.
    "The referee told me something incredible," said Mourinho. "He said at the same time he could see the action in the box and my behaviour on the touchline.
    "I congratulate him because he is absolutely incredible. During the game, 100 miles per hour, he had one eye on the penalty situation and one eye on my behaviour on the bench. That's the explanation he gave me and that is why he is one of the best referees in the world."
    He added: "I think the best thing I have to do when I leave Fenerbahce I go to a club that doesn't play in Uefa competitions. So if any club in ­England at the bottom of the table needs a manager in the next two years, I'm ready to go. I don't want to say anything else – we played ­absolutely fantastic against a team that is far more superior."
    United have now gone exactly a year since their last victory in Europe having picked up three straight draws to start their Europa League campaign.
    Erik ten Hag was pleased with his side's performance but admitted that he was disappointed not to have claimed all three points.
    "Of course when you are ­taking the lead, it [drawing] shouldn't ­happen," the Dutchman said. "We had chances to make a second goal. Disappointed not to win. At Old ­Trafford we have to win games."
    Asked whether he would like to face Fenerbahce again in the final, he added: "It would be a very good final. We should keep the ball ­better in the first half. We should score more goals but to be honest they also ­created good chances. They gave us some problems. They are a good team with a good manager. It is not a bad point. But we want to win. We want to win every game."
    
    ###EXPECTED OUTPUT###
    [
        {
            "speaker": "José Mourinho",
            "quote_raw": "The referee told me something incredible. He said at the same time he could see the action in the box and my behaviour on the touchline. I congratulate him because he is absolutely incredible. During the game, 100 miles per hour, he had one eye on the penalty situation and one eye on my behaviour on the bench. That's the explanation he gave me and that is why he is one of the best referees in the world.",
            "quote_summary": "The referee claimed he could watch both the match and my behavior simultaneously, praising him for his skills.",
            "article_date": "2024-10-24"
        },
        {
            "speaker": "José Mourinho",
            "quote_raw": "I think the best thing I have to do when I leave Fenerbahce I go to a club that doesn't play in Uefa competitions. So if any club in ­England at the bottom of the table needs a manager in the next two years, I'm ready to go. I don't want to say anything else – we played ­absolutely fantastic against a team that is far more superior.",
            "quote_summary": "My plan after leaving Fenerbahce is to join a club not in Uefa competitions. I'd be available for any struggling club in England. Despite facing a superior team, we played extremely well.",
            "article_date": "2024-10-24"
        },
        {
            "speaker": "Erik ten Hag",
            "quote_raw": "Of course when you are ­taking the lead, it [drawing] shouldn't ­happen. We had chances to make a second goal. Disappointed not to win. At Old ­Trafford we have to win games.",
            "quote_summary": "We shouldn't draw when leading. We missed opportunities to score a second goal and it's disappointing. At Old Trafford, we have an expectation to win.",
            "article_date": "2024-10-24"
        },
        {
            "speaker": "Erik ten Hag",
            "quote_raw": "It would be a very good final. We should keep the ball ­better in the first half. We should score more goals but to be honest they also ­created good chances. They gave us some problems. They are a good team with a good manager. It is not a bad point. But we want to win. We want to win every game.",
            "quote_summary": "A final against Fenerbahce would be interesting. Despite some errors on our side, they were challenging, they're a good team with a competent manager. It's not bad to draw, but our goal is always to win.",
            "article_date": "2024-10-24"
        }
    ]`;


const quoteValidationPrompt = `Assess the quote in the quote object below and determine if it is valid. If it is invalid, return the JSON object below but with an additional field called is_valid, and a field called invalid_reason. Populate these fields if you determine a quote is invalid based on the criteria below.
    # Raw Quote Text
    {quote_object}
    
    # Validation Rules
    - Article author written text vs speaker quoted text: ensure the raw quote text only contains the words spoken by the speaker and not the text written by the author of the article
    - The speaker must be a person who is named in the article (i.e., speaker cannot be unknown or anonymous)
    - The speaker must not be a fan or random people on the internet`;


// Zod schemas for getting structured output from the LLM
const Headlines = z.object({
    headlines: z.array(z.object({
        article_url: z.string().url(),
        headline: z.string()
    }))
});

const Quote = z.object({
    speaker: z.string(),
    quote_raw: z.string(),
    quote_summary: z.string(),
    article_date: z.string(), // assuming YYYY-MM-DD format
    is_valid: z.boolean().optional()
});

const Quotes = z.object({
    quotes: z.array(z.object({
        speaker: z.string(),
        quote_raw: z.string(),
        quote_summary: z.string(),
        article_date: z.string()
    }))
});

const QuoteWithMetadata = z.object({
    parent_url: z.string().url(),
    article_url: z.string().url(),
    article_date: z.string(),
    headline: z.string(),
    speaker: z.string(),
    quote_raw: z.string(),
    quote_summary: z.string()
});

const FinalQuotes = z.object({
    final_quotes: z.array(z.object({
        speaker: z.string(),
        quote_raw: z.string(),
        quote_summary: z.string(),
        article_date: z.string(),
        is_valid: z.boolean(),
        invalid_reason: z.string().optional()
    }))
});

const MonitoredURLStats = z.object({
    parent_url: z.string().url(),
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
    quotes: Annotation<z.infer<typeof Quotes>>({
        reducer: (state, update) => state.concat(update),
    }),
    final_quotes: Annotation<z.infer<typeof FinalQuotes>>({
        reducer: (state, update) => state.concat(update),
    }),
    monitored_url_stats: Annotation<z.infer<typeof MonitoredURLStats>>({
        reducer: (state, update) => state.concat(update),  // Added reducer since we'll have stats for each parent_url
    })
});

// Interface for mapping over parent URLs to extract headlines
interface ParentURLState {
    parent_url: string;
}

// Interface for mapping over headlines to extract quotes
interface ArticleState {
    parent_url: string;
    article_url: string;
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

// Function to extract headlines as second node
const extractHeadlines = async (
    state: ParentURLState
): Promise<Partial<typeof OverallState.State>> => {
    console.log("\nProcessing headlines for parent URL:", state.parent_url);
    
    // Get markdown from jina.ai
    const markdown = await getJinaMarkdown(state.parent_url);
    if (!markdown) {
        console.log(`No markdown content found for ${state.parent_url}`);
        return { headlines: [] };
    }
    
    const prompt = headlineExtractionPrompt.replace("{parent_url_markdown}", markdown);
    const response = await headlineModel
        .withStructuredOutput(Headlines)
        .invoke(prompt);
    
    console.log(`Found ${response.headlines.length} headlines for ${state.parent_url}`);
    
    return { 
        headlines: response.headlines
    };
};

const extractQuotes = async (
    state: ArticleState
): Promise<Partial<typeof OverallState.State>> => {
    console.log("\nExtracting quotes from article:", state.headline);
    
    const markdown = await getJinaMarkdown(state.article_url);
    if (!markdown) {
        console.log(`No markdown content found for ${state.article_url}`);
        return { quotes: [] };
    }
    
    const prompt = quoteExtractionPrompt
        .replace("{article_url}", state.article_url)
        .replace("{article_url_markdown}", markdown)
        .replace("{today_date}", state.today_date);
        
    const completion = await withRetry(() => openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: "You are an expert at extracting quotes from news articles." },
            { role: "user", content: prompt }
        ],
        response_format: zodResponseFormat(Quotes, "initial_quotes")
    }));
    
    const parsedResponse = JSON.parse(completion.choices[0].message.content);
    console.log(`Found ${parsedResponse.quotes.length} quotes in article: ${state.headline}`);
    
    return { 
        quotes: parsedResponse.quotes
    };
};

// Add the Gemini extraction function
const extractQuotesWithGemini = async (
    state: ArticleState
): Promise<Partial<typeof OverallState.State>> => {
    console.log("\nExtracting quotes with Gemini from article:", state.headline);
    
    const markdown = await getJinaMarkdown(state.article_url);
    if (!markdown) {
        console.log(`No markdown content found for ${state.article_url}`);
        return { quotes: [] };
    }
    
    const prompt = quoteExtractionPrompt
        .replace("{article_url}", state.article_url)
        .replace("{article_url_markdown}", markdown)
        .replace("{today_date}", state.today_date);
        
    const result = await withRetry(() => geminiModel.generateContent(prompt));
    const response = JSON.parse(result.response.text());
    
    console.log(`Found ${response.quotes.length} quotes in article: ${state.headline}`);
    
    return { 
        quotes: response.quotes
    };
};

const validateQuotes = async (
    state: QuoteValidationState
): Promise<Partial<typeof OverallState.State>> => {
    console.log("\nValidating quote:", state.quote_object);
    
    const prompt = quoteValidationPrompt
        .replace("{quote_object}", state.quote_object)
        .replace(/{today_date}/g, state.today_date);
        
    const response = await quoteValidationModel
        .withStructuredOutput(FinalQuotes)
        .invoke(prompt);
    
    console.log(`Validation complete. Valid: ${response.final_quotes[0].is_valid}`);
    
    return { 
        final_quotes: response.final_quotes
    };
};

// Helper function to process articles in chunks with rate limiting
const processArticlesInChunks = async (
    articles: ArticleState[],
    processor: (article: ArticleState) => Promise<Partial<typeof OverallState.State>>
): Promise<Partial<typeof OverallState.State>[]> => {
    const results: Partial<typeof OverallState.State>[] = [];
    
    // Process articles in chunks
    for (let i = 0; i < articles.length; i += RATE_LIMIT_CONFIG.chunkSize) {
        const chunk = articles.slice(i, i + RATE_LIMIT_CONFIG.chunkSize);
        console.log(`\nProcessing chunk ${(i/RATE_LIMIT_CONFIG.chunkSize) + 1} of ${Math.ceil(articles.length/RATE_LIMIT_CONFIG.chunkSize)} (${chunk.length} articles)`);
        
        // Process all articles in current chunk
        const chunkResults = await Promise.all(chunk.map(article => processor(article)));
        results.push(...chunkResults);
        
        // If this isn't the last chunk, wait before processing next chunk
        const isLastChunk = i + RATE_LIMIT_CONFIG.chunkSize >= articles.length;
        if (!isLastChunk) {
            console.log(`Waiting ${RATE_LIMIT_CONFIG.delayBetweenChunksMs/1000} seconds before processing next chunk...`);
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_CONFIG.delayBetweenChunksMs));
        }
    }
    
    return results;
};

// Here we define the logic to map out over the parent URLs
// We will use this as an edge in the graph
const continueToHeadlines = (state: typeof OverallState.State) => {
    // We will return a list of `Send` objects
    // Each `Send` object consists of the name of a node in the graph as well as the state to send to that node
    return state.parent_urls.map((parent_url) => new Send("extractHeadlines", { parent_url }));
  };


// Here we define the logic to map out over the articles
const continueToQuotes = async (state: typeof OverallState.State) => {
    if (!state.headlines?.length) {
        return [];
    }

    // Convert headlines to ArticleState objects
    const articles: ArticleState[] = state.headlines.map(headline => ({
        parent_url: headline.parent_url,
        article_url: headline.article_url,
        headline: headline.headline,
        today_date: new Date().toISOString().split('T')[0]
    }));

    // Process articles in chunks with rate limiting
    const results = await processArticlesInChunks(articles, extractQuotes);

    // Combine all quotes from all chunks
    const allQuotes = results.reduce((acc, result) => {
        if (result.quotes) {
            acc.push(...result.quotes);
        }
        return acc;
    }, [] as typeof state.quotes);

    // Return a single Send object with all quotes
    return [new Send("validateQuotes", { quotes: allQuotes })];
};

const continueToQuoteValidation = (state: typeof OverallState.State) => {
    // Map over each quote and create a validation task
    return state.quotes.map((quote) => new Send("validateQuotes", {
        quote_object: JSON.stringify(quote),
        today_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    }));
};

// Construct the graph: here we put everything together to construct our graph
const graph = new StateGraph(OverallState)
    .addNode("fetchParentURLs", fetchParentURLs)
    .addNode("extractHeadlines", extractHeadlines)
    .addNode("extractQuotes", extractQuotes)
    .addNode("validateQuotes", validateQuotes)
    .addEdge(START, "fetchParentURLs")
    .addConditionalEdges("fetchParentURLs", continueToHeadlines)
    .addConditionalEdges("extractHeadlines", continueToQuotes)
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
        if (chunk.quotes) console.log("Quotes:", chunk.quotes);
        if (chunk.final_quotes) console.log("Final Quotes:", chunk.final_quotes);
        // if (chunk.monitored_url_stats) console.log("Stats:", chunk.monitored_url_stats);       
        console.log("\n====\n");

        // Save results when we have final_quotes (meaning the graph has completed)
        if (chunk.final_quotes) {
            await saveGraphResults(
                'gemini', // or 'openai' depending on which model is being used
                chunk
            );
        }
    }
}


// Run the main function
main().catch(console.error);