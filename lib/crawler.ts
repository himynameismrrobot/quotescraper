import * as puppeteer from 'puppeteer';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import prisma from './prisma';
import * as cheerio from 'cheerio';

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
  articleHeadline?: string; // Add this to track the headline
  summary: string;
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
  html: string, 
  url: string, 
  headline: string, 
  sendLog: (message: string) => void
): Promise<Quote[]> {
  // First, extract just the article text content
  const $ = cheerio.load(html);
  let articleText = '';

  // Try different selectors for article content
  const selectors = [
    '.article-body-commercial-selector', // Guardian
    'article[data-test-id="article-review-body"]', // Guardian alternative
    '.article__body', // BBC
    '.article-body', // MEN
    'article p', // Generic article paragraphs
    '.story-body p', // Generic story paragraphs
  ];

  for (const selector of selectors) {
    const content = $(selector).text().trim();
    if (content) {
      articleText = content;
      sendLog(`Found content using selector: ${selector}`);
      break;
    }
  }

  // If no content found through selectors, try to get all paragraph text
  if (!articleText) {
    articleText = $('p').text().trim();
    sendLog('No content found with specific selectors, falling back to all paragraph text');
  }

  // Log the text that will be sent to OpenAI
  sendLog('\n=== START OF TEXT TO BE SENT TO OPENAI FOR QUOTE EXTRACTION ===\n');
  const chunkSize = 500;
  for (let i = 0; i < articleText.length; i += chunkSize) {
    sendLog(articleText.slice(i, i + chunkSize));
  }
  sendLog('\n=== END OF TEXT TO BE SENT TO OPENAI FOR QUOTE EXTRACTION ===\n');
  sendLog(`Total text length: ${articleText.length} characters`);

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
        ${articleText}
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
  
  sendLog("OpenAI response received for quote extraction");
  console.log("OpenAI response:", content);

  content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');

  try {
    const quotes: Quote[] = JSON.parse(content);
    sendLog(`Successfully parsed ${quotes.length} quotes from the article`);
    return quotes.map(quote => ({ 
      ...quote, 
      articleUrl: url,
      articleHeadline: headline, // Add the headline to each quote
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
  const page = await browser.newPage();
  
  // Set a real user agent
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Add more realistic browser headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1'
  });

  // Add this line to intercept and block unnecessary resources
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (['image', 'stylesheet', 'font', 'media'].includes(request.resourceType())) {
      request.abort();
    } else {
      request.continue();
    }
  });

  sendLog('Browser configured with user agent and headers');

  try {
    sendLog(`Navigating to ${url}`);
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: 120000 
      });
      sendLog('Page loaded successfully');

      // Wait for content to be available
      await page.waitForSelector('main', { timeout: 10000 });
      sendLog('Main content found');

      // Log the actual HTML for debugging
      const pageContent = await page.content();
      sendLog(`Page content length: ${pageContent.length} characters`);

      // Extract only the relevant content based on the website
      const html = await page.evaluate(() => {
        let mainContent = '';
        
        if (window.location.hostname.includes('theguardian.com')) {
          // Guardian's main content area
          const content = document.querySelector('#container-content');
          mainContent = content ? content.innerHTML : '';
        } else if (window.location.hostname.includes('bbc.com')) {
          // BBC's main content area
          const content = document.querySelector('#main-content');
          mainContent = content ? content.innerHTML : '';
        } else if (window.location.hostname.includes('manchestereveningnews.co.uk')) {
          // Updated MEN extraction to focus on article links
          const articles = Array.from(document.querySelectorAll('a[data-testid="article-link"]'));
          mainContent = articles.map(article => ({
            url: article.getAttribute('href'),
            headline: article.textContent?.trim() || ''
          })).join('\n');
        }

        // Fallback to looking for common content area selectors
        if (!mainContent) {
          const selectors = [
            'main',
            '.main-content',
            '#content',
            '.content',
            'article',
            '.articles',
            '.stories'
          ];
          
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              mainContent = element.innerHTML;
              break;
            }
          }
        }

        return mainContent || document.body.innerHTML;
      });

      sendLog(`Extracted main content area from page`);

      const articles = await findHeadlinesWithQuotes(html, url, sendLog);
      sendLog(`Found ${articles.length} articles with potential quotes:`);
      articles.forEach((article, index) => {
        sendLog(`${index + 1}. ${article.headline}`);
      });

      let allQuotes: Quote[] = [];

      for (const article of articles) {
        sendLog(`\nScraping article: ${article.headline}`);
        sendLog(`URL: ${article.url}`);
        
        try {
          sendLog('Attempting to navigate to article URL');
          await page.goto(article.url, { 
            waitUntil: 'networkidle0',
            timeout: 120000 
          });
          sendLog('Successfully navigated to article URL');
        } catch (articleNavigationError) {
          sendLog(`Navigation error for article: ${articleNavigationError instanceof Error ? articleNavigationError.message : 'Unknown error'}`);
          sendLog('Attempting to proceed with partial page load');
          await page.waitForTimeout(5000);
        }
        
        sendLog('Extracting article content');
        const articleHtml = await page.evaluate(() => {
          let articleContent = '';
          
          // Try to find the main article content
          const selectors = [
            'article',
            '.article-body',
            '.article-content',
            '.story-body',
            'main article',
            '[data-test-id="article-body"]'
          ];
          
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              articleContent = element.innerHTML;
              break;
            }
          }
          
          return articleContent || document.body.innerHTML; // Fallback to entire body if no content found
        });
        sendLog(`Article content extracted. Length: ${articleHtml.length} characters`);

        sendLog('Calling extractQuotesFromArticle');
        const quotes = await extractQuotesFromArticle(articleHtml, article.url, article.headline, sendLog);
        sendLog(`Found ${quotes.length} quotes in this article:`);
        
        // Save quotes to the database
        for (const quote of quotes) {
          try {
            await prisma.quoteStaging.create({
              data: {
                summary: quote.quote_summary,
                rawQuoteText: quote.text,
                speakerName: quote.speaker,
                articleDate: new Date(quote.date + 'T00:00:00Z'),
                articleUrl: article.url, // Use article.url instead of quote.articleUrl
                articleHeadline: article.headline, // Use article.headline directly
                parentMonitoredUrl: url,
              },
            });
            sendLog(`Saved quote from ${quote.speaker} to the database`);
          } catch (error) {
            sendLog(`Error saving quote from ${quote.speaker}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
    } catch (navigationError) {
      sendLog(`Navigation error: ${navigationError instanceof Error ? navigationError.message : 'Unknown error'}`);
      sendLog('Attempting to proceed with partial page load');
      await page.waitForTimeout(5000);
    }
  } catch (error) {
    sendLog(`Error during crawl: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    await browser.close();
    sendLog('Browser closed');
  }
}

export async function crawlSpecificArticle(url: string, sendLog: (message: string) => void): Promise<void> {
  sendLog('\n=== STARTING PUPPETEER ===');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  sendLog('Browser launched');
  
  const page = await browser.newPage();
  sendLog('New page created');
  
  await page.setDefaultNavigationTimeout(120000);
  await page.setDefaultTimeout(120000);

  try {
    sendLog(`Puppeteer navigating to: ${url}`);
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: 120000 
      });
      sendLog('Page loaded successfully');
    } catch (navigationError) {
      sendLog(`Navigation error: ${navigationError instanceof Error ? navigationError.message : 'Unknown error'}`);
      sendLog('Attempting to proceed with partial page load');
      await page.waitForTimeout(5000);
    }

    sendLog('Puppeteer extracting article headline');
    const articleHeadline = await page.evaluate(() => {
      const selectors = ['h1', '.article-headline', '.article-title'];
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element.textContent?.trim() || '';
      }
      return '';
    });
    sendLog(`Found article headline: ${articleHeadline}`);

    sendLog('Puppeteer extracting article content');
    const html = await page.evaluate(() => {
      let mainContent = '';
      
      if (window.location.hostname.includes('theguardian.com')) {
        const content = document.querySelector('.article-body-commercial-selector');
        mainContent = content ? content.innerHTML : '';
      } else if (window.location.hostname.includes('bbc.com')) {
        const content = document.querySelector('.article__body');
        mainContent = content ? content.innerHTML : '';
      } else if (window.location.hostname.includes('manchestereveningnews.co.uk')) {
        const articleBody = Array.from(document.querySelectorAll('.article-body > p'))
          .map(p => p.textContent)
          .filter(text => text && !text.includes('READ MORE:') && !text.includes('READ NEXT:'))
          .join('\n\n');
        mainContent = articleBody;
      }

      // Fallback to common article content selectors
      if (!mainContent) {
        const selectors = [
          'article',
          '.article-body',
          '.article-content',
          '.story-body',
          'main article',
          '[data-test-id="article-body"]'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            mainContent = element.innerHTML;
            break;
          }
        }
      }

      return mainContent || document.body.innerHTML;
    });
    sendLog('Puppeteer extracted raw HTML content');
    sendLog('\n=== PUPPETEER COMPLETE ===\n');

    sendLog('\n=== STARTING CHEERIO PROCESSING ===');
    sendLog('Cheerio loading HTML content');
    const $ = cheerio.load(html);
    let articleText = '';

    sendLog('Cheerio extracting text content from HTML');
    // Try different selectors for article content
    const selectors = [
      '.article-body-commercial-selector',
      'article[data-test-id="article-review-body"]',
      '.article__body',
      '.article-body',
      'article p',
      '.story-body p',
    ];

    for (const selector of selectors) {
      const content = $(selector).text().trim();
      if (content) {
        articleText = content;
        sendLog(`Cheerio found content using selector: ${selector}`);
        break;
      }
    }

    if (!articleText) {
      sendLog('No content found with specific selectors, falling back to all paragraph text');
      articleText = $('p').text().trim();
    }
    sendLog('\n=== CHEERIO PROCESSING COMPLETE ===\n');

    sendLog('\n=== STARTING OPENAI PROCESSING ===');
    sendLog('\n=== TEXT BEING SENT TO OPENAI FOR QUOTE EXTRACTION ===\n');
    const chunkSize = 500;
    for (let i = 0; i < articleText.length; i += chunkSize) {
      sendLog(articleText.slice(i, i + chunkSize));
    }
    sendLog('\n=== END OF TEXT BEING SENT TO OPENAI ===\n');

    // Pass articleText instead of html to extractQuotesFromArticle
    const quotes = await extractQuotesFromArticle(articleText, url, articleHeadline, sendLog);
    sendLog(`OpenAI found ${quotes.length} quotes in this article`);
    sendLog('\n=== OPENAI PROCESSING COMPLETE ===\n');

    // Save quotes to the database
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
        sendLog(`Error saving quote from ${quote.speaker}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    sendLog(`Error during article crawl: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    await browser.close();
    sendLog('Browser closed');
  }
}
