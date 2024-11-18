import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END, START, Annotation, Send } from "@langchain/langgraph";
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import puppeteer from 'puppeteer';

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

// OpenAI Model Initialization
 
const model = new ChatOpenAI({
    model: "gpt-4o-mini",
});

//Get Jina Markdown Helper Function
async function getJinaMarkdown(url: string): Promise<string> {
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    console.log(`Fetching markdown from: ${jinaUrl}`);
    
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    try {
        await page.goto(jinaUrl, { waitUntil: 'networkidle0' });
        
        // Wait for the markdown content to be available
        await page.waitForSelector('pre', { timeout: 10000 });
        
        // Get the markdown content
        const markdown = await page.$eval('pre', el => el.textContent || '');
        
        return markdown;
    } catch (error) {
        console.error(`Error fetching markdown for ${url}:`, error);
        return '';
    } finally {
        await browser.close();
    }
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

const quoteExtractionPrompt = `Extract all the quoted text from the following article text. Only the text between quotation marks should be extracted. 
    There could be quotes from multiple speakers, make sure to extract them all. 
    If a quote needs context to make sense feel free to include this in brackets at the start of the quote but keep it short.
    For the extracted quote text, ensure it only contains text that was spoken by the speaker as opposed to anything written by the article author. 
    Some quotes may be broken up across the article. If this is the case, merge them together into one contiguous quote. 
    But do not merge quotes that discuss different topics. 
    For each quote, also provide a more succinct version of the quote written as if the speaker had spoken it themselves. 
    Also extract the quote date in YYYY-MM-DD format. Use the article date as the date. The article URL is: {article_url}. 
    If the article date is not in the article text also look at the Article URL to see if you can determine the date from there. 
    If those both fail, use the current date. 
    Return ONLY a JSON array of objects with 'speaker', 'quote_raw', 'quote_summary', 'article_date' properties. 
    If you can't find any quotes, return an empty array. 
    No other text or formatting:
    
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


const quoteValidationPrompt = `Review the quote object copied below and use the rules below to flag invalid quotes. For quotes that are valid, also fix the article date if the condition listed below is met.
    #Raw Quote Text
    {quote_raw}
    
    #Validation Rules
    - Author text vs quoted text differentiation: ensure the raw quote text only contains the words spoken by the speaker and not the text written by the author of the article
    - Ensure speakers are players or managers of sports organizations such as teams like Manchester United. A quote with a speaker that is not a player or manager of a sports organization is not valid (e.g., quotes from fans)
    
    #Article Date Update Condition
    - If the {article_date} is more than 30 days past today's date: {today_date}, then update the value of {article_date} to match today's date: {today_date}.`



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

const Quotes = z.array(Quote);

const QuoteWithMetadata = z.object({
    parent_url: z.string().url(),
    article_url: z.string().url(),
    article_date: z.string(),
    headline: z.string(),
    speaker: z.string(),
    quote_raw: z.string(),
    quote_summary: z.string()
});

const FinalQuotes = z.array(QuoteWithMetadata);

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
}

// Interface for mapping over quotes to validate them
interface QuoteState {
    parent_url: string;
    article_url: string;
    headline: string;
    quote: z.infer<typeof Quote>;
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
    const response = await model
        .withStructuredOutput(Headlines)
        .invoke(prompt);
    
    console.log(`Found ${response.headlines.length} headlines for ${state.parent_url}`);
    
    return { 
        headlines: response.headlines
    };
};


// Here we define the logic to map out over the parent URLs
// We will use this as an edge in the graph
const continueToHeadlines = (state: typeof OverallState.State) => {
    // We will return a list of `Send` objects
    // Each `Send` object consists of the name of a node in the graph as well as the state to send to that node
    return state.parent_urls.map((parent_url) => new Send("extractHeadlines", { parent_url }));
  };
  

// Construct the graph: here we put everything together to construct our graph
const graph = new StateGraph(OverallState)
    .addNode("fetchParentURLs", fetchParentURLs)
    .addNode("extractHeadlines", extractHeadlines)
    .addEdge(START, "fetchParentURLs")
    .addConditionalEdges("fetchParentURLs", continueToHeadlines)
    .addEdge("extractHeadlines", END);

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
        // if (chunk.quotes) console.log("Quotes:", chunk.quotes);
        // if (chunk.final_quotes) console.log("Final Quotes:", chunk.final_quotes);
        // if (chunk.monitored_url_stats) console.log("Stats:", chunk.monitored_url_stats);
        console.log("\n====\n");
    }
}

// Run the main function
main().catch(console.error);