import * as puppeteer from 'puppeteer';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import prisma from './prisma';

dotenv.config();

const openai = new OpenAI();

interface Article {
  url: string;
  headline: string;
}

interface Quote {
  speaker: string;
  text: string;
  date: string;
  articleUrl: string;
  articleHeadline?: string;
  summary: string;
}

function getJinaReaderUrl(url: string): string {
  // Remove any existing protocol (http:// or https://)
  const cleanUrl = url.replace(/^(https?:\/\/)/, '');
  return `https://r.jina.ai/${cleanUrl}`;
}

export async function findHeadlinesWithQuotes(html: string, baseUrl: string, sendLog: (message: string) => void): Promise<Article[]> {
  sendLog('\n=== CONTENT BEING SENT TO OPENAI FOR HEADLINE EXTRACTION ===\n');
  // Break the HTML into chunks for logging

  sendLog(html);
  
  sendLog('\n=== END OF CONTENT SENT TO OPENAI FOR HEADLINE EXTRACTION ===\n');
  sendLog(`Total content length: ${html.length} characters`);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a helpful assistant that identifies headlines on news websites. Always respond with valid JSON only, without any markdown formatting or extra text." },
      { role: "user", content: `Analyze the following HTML and return a JSON array of objects with 'url' and 'headline' properties for all news article headlines. Respond ONLY with the JSON array, no other text or formatting: ${html}` }
    ],
  });

  let content = response.choices[0].message?.content || '[]';
  
  sendLog("Full OpenAI response in findHeadlinesWithQuotes:");
  console.log("Full OpenAI response in findHeadlinesWithQuotes:");
  console.log(JSON.stringify(response, null, 2));
  sendLog("Content of the response:");
  console.log("Content of the response:");
  console.log(content);

  // Remove any markdown code block formatting if present
  content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');

  try {
    const articles: Article[] = JSON.parse(content);
    // Prepend the base URL to each article's URL
    return articles.map(article => ({
      ...article,
      url: new URL(article.url, baseUrl).toString()
    }));
  } catch (error) {
    sendLog(`Failed to parse JSON response in findHeadlinesWithQuotes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error("Failed to parse JSON response in findHeadlinesWithQuotes. Error:", error);
    console.error("Raw content:", content);
    return [];
  }
}

export async function extractQuotesFromArticle(
  markdown: string, 
  url: string, 
  headline: string, 
  sendLog: (message: string) => void
): Promise<Quote[]> {
  sendLog('\n=== START OF TEXT TO BE SENT TO OPENAI FOR QUOTE EXTRACTION ===\n');
  sendLog(markdown);
  sendLog('\n=== END OF TEXT TO BE SENT TO OPENAI FOR QUOTE EXTRACTION ===\n');
  sendLog(`Total text length: ${markdown.length} characters`);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { 
        role: "system", 
        content: "You are a helpful assistant that extracts quoted text from news articles. Always respond with valid JSON only, without any markdown formatting or extra text." 
      },
      {
        role: "user",
        content: `Extract all the quoted text from the following article text. Only the text between quotation marks should be extracted. There could be quotes from multiple speakers, make sure to extract them all. If a quote needs context to make sense feel free to include this in brackets at the start of the quote but keep it short.
        For the extracted quote text, ensure it only contains text that was spoken by the speaker as opposed to anything written by the article author. 
        Some quotes may be broken up across the article. If this is the case, merge them together into one contiguous quote. 
        But do not merge quotes that discuss different topics. For each quote, also provide a more succinct version of the quote written as if the speaker had spoken it themselves. 
        Also extract the quote date in YYYY-MM-DD format. Use the article date as the date. The article URL is: ${url}. 
        If the article date is not in the article text also look at the URL to see if you can determine the date from there. If those both fail, use the current date. 
        Return ONLY a JSON array of objects with 'speaker', 'text', 'quote_summary', 'date' properties. If you can't find any quotes, return an empty array. 
        No other text or formatting:
        
        === START OF ARTICLE TEXT ===
        ${markdown}
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
                "text": "The referee told me something incredible. He said at the same time he could see the action in the box and my behaviour on the touchline. I congratulate him because he is absolutely incredible. During the game, 100 miles per hour, he had one eye on the penalty situation and one eye on my behaviour on the bench. That's the explanation he gave me and that is why he is one of the best referees in the world.",
                "quote_summary": "The referee claimed he could watch both the match and my behavior simultaneously, praising him for his skills.",
                "date": "2024-10-24"
            },
            {
                "speaker": "José Mourinho",
                "text": "I think the best thing I have to do when I leave Fenerbahce I go to a club that doesn't play in Uefa competitions. So if any club in ­England at the bottom of the table needs a manager in the next two years, I'm ready to go. I don't want to say anything else – we played ­absolutely fantastic against a team that is far more superior.",
                "quote_summary": "My plan after leaving Fenerbahce is to join a club not in Uefa competitions. I'd be available for any struggling club in England. Despite facing a superior team, we played extremely well.",
                "date": "2024-10-24"
            },
            {
                "speaker": "Erik ten Hag",
                "text": "Of course when you are ­taking the lead, it [drawing] shouldn't ­happen. We had chances to make a second goal. Disappointed not to win. At Old ­Trafford we have to win games.",
                "quote_summary": "We shouldn't draw when leading. We missed opportunities to score a second goal and it's disappointing. At Old Trafford, we have an expectation to win.",
                "date": "2024-10-24"
            },
            {
                "speaker": "Erik ten Hag",
                "text": "It would be a very good final. We should keep the ball ­better in the first half. We should score more goals but to be honest they also ­created good chances. They gave us some problems. They are a good team with a good manager. It is not a bad point. But we want to win. We want to win every game.",
                "quote_summary": "A final against Fenerbahce would be interesting. Despite some errors on our side, they were challenging, they're a good team with a competent manager. It's not bad to draw, but our goal is always to win.",
                "date": "2024-10-24"
            }
        ]`
      }
    ],
  });

  let content = response.choices[0].message?.content || '[]';
  
  try {
    const quotes: Quote[] = JSON.parse(content);
    sendLog(`Successfully parsed ${quotes.length} quotes from the article`);
    return quotes.map(quote => ({ 
      ...quote, 
      articleUrl: url,
      articleHeadline: headline,
      summary: quote.quote_summary
    }));
  } catch (error) {
    sendLog(`Failed to parse JSON response in extractQuotesFromArticle: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error("Failed to parse JSON response in extractQuotesFromArticle. Error:", error);
    console.error("Raw content:", content);
    return [];
  }
}

export async function crawlWebsite(url: string, sendLog: (message: string) => void): Promise<void> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });

  try {
    const jinaUrl = getJinaReaderUrl(url);
    sendLog(`Navigating to Jina reader URL: ${jinaUrl}`);
    
    const page = await browser.newPage();
    await page.goto(jinaUrl, { waitUntil: 'networkidle0', timeout: 120000 });
    sendLog('Page loaded successfully');

    // Extract the markdown content
    const markdown = await page.evaluate(() => {
      // Just get the entire body text since it's already markdown from Jina
      return document.body.innerText;
    });
    sendLog('Extracted markdown content from Jina reader');

    // Add logging to see what we got
    sendLog('Extracted markdown content:');
    sendLog(markdown);

    // Send markdown to OpenAI for headline extraction
    const articles = await findHeadlinesWithQuotes(markdown, url, sendLog);
    sendLog(`Found ${articles.length} articles with potential quotes:`);
    
    for (const article of articles) {
      sendLog(`\nScraping article: ${article.headline}`);
      
      // Convert article URL to Jina reader URL
      const jinaArticleUrl = getJinaReaderUrl(article.url);
      sendLog(`Navigating to Jina reader URL for article: ${jinaArticleUrl}`);
      
      await page.goto(jinaArticleUrl, { waitUntil: 'networkidle0', timeout: 120000 });
      sendLog('Article page loaded successfully');

      // Extract the markdown content
      const articleMarkdown = await page.evaluate(() => document.body.innerText);
      sendLog('Extracted markdown content from article');

      // Extract quotes from the markdown
      const quotes = await extractQuotesFromArticle(articleMarkdown, article.url, article.headline, sendLog);
      sendLog(`Found ${quotes.length} quotes in this article`);

      // Save quotes to database
      for (const quote of quotes) {
        try {
          await prisma.quoteStaging.create({
            data: {
              summary: quote.quote_summary,
              rawQuoteText: quote.text,
              speakerName: quote.speaker,
              articleDate: new Date(quote.date + 'T00:00:00Z'),
              articleUrl: article.url,
              articleHeadline: article.headline,
              parentMonitoredUrl: url,
            },
          });
          sendLog(`Saved quote from ${quote.speaker} to the database`);
        } catch (error) {
          sendLog(`Error saving quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    // After successfully saving quotes, update the lastCrawledAt timestamp
    try {
      await prisma.monitoredURL.update({
        where: { url: url },
        data: { 
          lastCrawledAt: new Date() 
        },
      });
      sendLog('Updated last crawled timestamp');
    } catch (error) {
      sendLog(`Error updating lastCrawledAt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

  } catch (error) {
    sendLog(`Error during crawl: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    await browser.close();
    sendLog('Browser closed');
  }
}

export async function crawlSpecificArticle(url: string, sendLog: (message: string) => void): Promise<void> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const jinaUrl = getJinaReaderUrl(url);
    sendLog(`Navigating to Jina reader URL: ${jinaUrl}`);
    
    const page = await browser.newPage();
    await page.goto(jinaUrl, { waitUntil: 'networkidle0', timeout: 120000 });
    sendLog('Page loaded successfully');

    // Extract the markdown content
    const markdown = await page.evaluate(() => {
      // Just get the entire body text since it's already markdown from Jina
      return document.body.innerText;
    });
    sendLog('Extracted markdown content from Jina reader');

    // Add logging to see what we got
    sendLog('Extracted markdown content:');
    sendLog(markdown);

    // Extract the headline (you might need to adjust this based on Jina's output format)
    const articleHeadline = await page.evaluate(() => {
      const firstLine = document.body.innerText.split('\n')[0];
      return firstLine || '';
    });
    sendLog(`Found article headline: ${articleHeadline}`);

    // Extract quotes from the markdown
    const quotes = await extractQuotesFromArticle(markdown, url, articleHeadline, sendLog);
    sendLog(`Found ${quotes.length} quotes in this article`);

    // Save quotes to database
    for (const quote of quotes) {
      try {
        await prisma.quoteStaging.create({
          data: {
            summary: quote.quote_summary,
            rawQuoteText: quote.text,
            speakerName: quote.speaker,
            articleDate: new Date(quote.date + 'T00:00:00Z'),
            articleUrl: url,
            articleHeadline: articleHeadline,
            parentMonitoredUrl: url,
          },
        });
        sendLog(`Saved quote from ${quote.speaker} to the database`);
      } catch (error) {
        sendLog(`Error saving quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    sendLog(`Error during article crawl: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    await browser.close();
    sendLog('Browser closed');
  }
}
