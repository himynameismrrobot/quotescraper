# Project Overview
You are building a quote scraper that uses LLMs to automatically scrape quotes from articles that are provided by a user inputting the article URL.

You will be using NextJS 15, shadcn, tailwind, Lucide icon

# Core Functionalities
1. Admin App: The system should have an admin page
    1. Organization Management
        1. Users should be able to add an organization to the database
            1. There should be an input field for the organization's name and a button to add the organization to the database
            2. The new organization should be added to the top of the list of organizations
            3. There should be a button to remove the organization from the database
            4. The list of organizations should be saved in the database
            5. The user should be able to add an image for the organization's logo 
    2. Speaker Management
        1. Users should be able to add a speaker to the database
            1. There should be an input field for the speaker's name and a button to add the speaker to the database
            2. The new speaker should be added to the top of the list of speakers
            3. There should be a button to remove the speaker from the database
            4. The list of speakers should be saved in the database 
            5. The user should be able to add an image for the speaker
            6. The user should be able to link the speaker to an organization
    3. URL Monitoring Setup
        1. Users should be able to add URLs for the system to monitor
            1. There should be an input field for the URL and a button to add the URL to the list of URLs to monitor
            2. The new URL should be added to the top of the list of URLs to monitor
            3. There should be a button to remove the URL from the list of URLs to monitor
            4. There should also be a button to add a logo image for the URL
    4. Quote Scraping Capability
        1. The system will scan these "monitored" URLs every 4 hours in order to identify articles that are likely to contain a quote
            1. The system will use LLMs to read the content of the page and identify which articles are likely to contain a quote
        2. When the system finds an article likely to have a quote it will navigate to that article and scrape all of the quotes from it
            1. The system will use LLMs to extract the quotes from the article
            2. When quotes are split up across the article the system should also use LLMs to intelligently combine them to reduce noise
            3. The system should use LLMs to extract the name of the speaker of the quote and link the quote to a speaker in the database
            4. The system should use LLMs to create a concise summary of the quote
    5. Quote Staging Table
        1. All extracted quotes will display on a screen in a table with columns for quote summary, rawquote, speaker name, article date, article URL, parent monitored URL, and a button to accept/reject the quote
        2. The data in this table (e.g., summarized quote text, raw quote text) will be editable in case of errors
        3. The user can click on the accept button to add the quote to the Published Quotes table
        4. The user can click on the reject button to delete the quote entirely
    6. Published Quotes Table
        1. All accepted quotes will display on a screen in a table with columns for quote summary, rawquote, speaker name, article date, article URL
2. Echo App: the system will have a external user facing web app that allows users who sign up for Echo to explore the published quotes in a UI/UX that is similar to Twitter's
    1. The user should be able to sign up/log in with Google
    2. Onboarding Flow
        1. The user should be asked to input their name (required), username (required), and profile photo (optional)
        2. The user should be asked to select the organizations they are interested in to follow them
        3. Then the user should be asked to select the speakers they are interested in to follow them
        4. Then the user should be taken to the newsfeed page where they can view the latest quotes from the organizations and speakers they selected
    3. App Information Architecture
        1. Main Naviagtion Buttons/Pages
            1. Newsfeed Page
                1. The user should be able to view the latest quotes from the organizations and speakers they follow
                    1. Each quote should appear in a Quote Card with the quote summary, speaker name, speaker's image, speaker's organization logo image, and article date
                        1. If the user clicks the speaker's image or name they should be taken to the Speaker Detail Page
                        2. If the user clicks the speaker's organization logo image they should be taken to the Organization Detail Page
                    2. The Quote Card should also have buttons to like, comment, and share the quote
                        1. These buttons should show the number of likes, comments, and shares respectively
                        2. Clicking on the like button should toggle the quote's like status for the user and increase the like count
                            1. If the user has already liked the quote, clicking the like button will unlike it and decrease the like count
                        3. Clicking on the comment button should open the Quote Detail Page, navigate the user to the comment input field, and activate it so the keyboard on a phone would pop up immediately
                        4. Clicking on the share button should open a modal where the user can copy a link to the quote to their clipboard
                            1. The link should be the URL of the quote detail page
                            2. If someone who is not a user of the app clicks on the link they should be taken to the Echo website where they can sign up for the app
                    3. The user should be able to click on a Quote Card to go to a "Quote Detail Page" to see more information
                        1. On the Quote Detail Page, the same Quote Card from the newsfeed will appear at the top (with the same quote summary, speaker name, speaker's image, article date, and action buttons).
                        2. Under the Quote Card will be the Full Quote Card, which shows the the full raw quote
                        3. Under the Full Quote Card, will be the Source Card, which contains a link to the article that the quote came from and the Logo image linked to the monitored URL that the source URL was discovered from
                        4. Under the Source Card will be all of the comments on the quote that other users have left
                            1. Above the comments there will be an input field for the user to add their own comment to the quote
                            2. After inputting a comment the user must click a submit button to post the comment
                            3. After submitting the comment the user should be able to see their comment in the list of comments
            2. Search Page
                1. The user should be able to search for quotes by keyword, speaker name, and organization name
                2. The search results should be displayed in the same Quote Cards as can be seen on the newsfeed
                3. The search results should be sorted by the most relevant quotes first
            3. Profile Page
                1. The user should be able to view all the speakers they follow
                    1. The user should be able to click on a speaker to go to the Speaker Detail Page
                    2. The user should be able to click on the "Unfollow" button to stop following the speaker (and the speaker should no longer appear on this page)
                2. The user should be able to view all the organizations they follow
                    1. The user should be able to click on an organization to go to the Organization Detail Page
                    2. The user should be able to click on the "Unfollow" button to stop following the organization (and the organization should no longer appear on this page)
                3. The user should be able to delete their account on this page
                4. The user should be able to log out on this page
                5. The user should be able to edit their profile picture
            4. Add Quote Page
                1. The user should be able to add a quote by inputting the quote, inputting the source URL, and selecting a speaker from the app's database
                    1. The user should be able to select the speaker by typing the speaker's name into a search input field and selecting the correct speaker from the dropdown list that appears
                    2. The user should be able to click a button to submit the quote (which will add it to the Quote Staging Table in the Admin App)
        2. Secondary Pages
            1. Speaker Detail Page
                1. All of a speaker's quotes should be displayed on this page in Quote Cards with the same format as on the newsfeed
            2. Organization Detail Page
                1. All of the quotes from speakers associated with a given organization should be displayed on this page in Quote Cards with the same format as on the newsfeed

# Doc
## Documentation of how to use Puppeteer and OpenAI to scrape quotes
CODE EXAMPLE:
```
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
    console.log(`   URL: ${article.url}`);
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
```







# Current File Structure
quotescraper
├── README.md
├── components
│   └── ui
├── components.json
├── extracted_quotes.json
├── globals.css
├── hooks
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── instructions
│   └── instructions.md
├── lib
│   └── utils.ts
├── next.config.js
├── package-lock.json
├── package.json
├── postcss.config.js
├── quoteScraper.ts
├── tailwind.config.js
└── tsconfig.json