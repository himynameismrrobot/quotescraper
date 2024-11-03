import * as puppeteer from 'puppeteer';
import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';

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
}

async function findHeadlinesWithQuotes(html: string, baseUrl: string): Promise<Article[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a helpful assistant that identifies news headlines likely to contain quotes. Always respond with valid JSON only, without any markdown formatting or extra text." },
      { role: "user", content: `Analyze the following HTML and return a JSON array of objects with 'url' and 'headline' properties for headlines likely to contain quotes. Respond ONLY with the JSON array, no other text or formatting: ${html}` }
    ],
  });

  let content = response.choices[0].message?.content || '[]';
  
  console.log("Full OpenAI response in findHeadlinesWithQuotes:");
  console.log(JSON.stringify(response, null, 2));
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
    console.error("Failed to parse JSON response in findHeadlinesWithQuotes. Error:", error);
    console.error("Raw content:", content);
    return [];
  }
}

async function extractQuotesFromArticle(html: string, url: string): Promise<Quote[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a helpful assistant that extracts quotes from news articles. Always respond with valid JSON only, without any markdown formatting or extra text." },
      { role: "user", content: `Extract quotes from the following HTML. Return ONLY a JSON array of objects with 'speaker', 'text', and 'date' properties. The 'date' should be in YYYY-MM-DD format. If you can't find a specific date, use the current date. If you can't find any quotes, return an empty array. No other text or formatting: ${html}` }
    ],
  });

  let content = response.choices[0].message?.content || '[]';
  
  console.log("Full OpenAI response in extractQuotesFromArticle:");
  console.log(JSON.stringify(response, null, 2));
  console.log("Content of the response:");
  console.log(content);

  // Remove any markdown code block formatting if present
  content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');

  try {
    const quotes: Quote[] = JSON.parse(content);
    return quotes.map(quote => ({ ...quote, articleUrl: url }));
  } catch (error) {
    console.error("Failed to parse JSON response in extractQuotesFromArticle. Error:", error);
    console.error("Raw content:", content);
    return [];
  }
}

async function scrapeWebsite(url: string): Promise<Quote[]> {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });

  const html = await page.content();
  const articles = await findHeadlinesWithQuotes(html, url);
  console.log(`Found ${articles.length} articles with potential quotes:`);
  articles.forEach((article, index) => {
    console.log(`${index + 1}. ${article.headline}`);
  });

  let allQuotes: Quote[] = [];

  for (const article of articles) {
    console.log(`\nScraping article: ${article.headline}`);
    console.log(`URL: ${article.url}`);
    await page.goto(article.url, { waitUntil: 'networkidle0' });
    const articleHtml = await page.content();
    
    // Extract and log the main content of the article
    const articleText = await page.evaluate(() => {
      const articleBody = document.querySelector('article');
      return articleBody ? articleBody.innerText : 'No article body found';
    });
    console.log('Article Text:');
    console.log(articleText);
    console.log('\n--- End of Article Text ---\n');

    const quotes = await extractQuotesFromArticle(articleHtml, article.url);
    console.log(`Found ${quotes.length} quotes in this article:`);
    quotes.forEach((quote, index) => {
      console.log(`Quote ${index + 1}:`);
      console.log(`Speaker: ${quote.speaker}`);
      console.log(`Text: ${quote.text}`);
      console.log(`Date: ${quote.date}`);
      console.log('---');
    });
    allQuotes = allQuotes.concat(quotes);
  }

  await browser.close();
  return allQuotes;
}

async function main(urls: string[]) {
  let allQuotes: Quote[] = [];

  for (const url of urls) {
    console.log(`Scraping website: ${url}`);
    const quotes = await scrapeWebsite(url);
    allQuotes = allQuotes.concat(quotes);
  }

  await fs.writeFile('extracted_quotes.json', JSON.stringify(allQuotes, null, 2));
  console.log(`Quotes have been extracted and saved to extracted_quotes.json. Total quotes: ${allQuotes.length}`);
}

// Usage
const websiteUrls = [
  'https://www.theguardian.com/football/manchester-united',
];

main(websiteUrls).catch(console.error);
