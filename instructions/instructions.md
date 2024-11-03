# Product Requirements Document (PRD)

## Project Overview

You are building a quote scraper that uses Large Language Models (LLMs) to automatically scrape quotes from articles provided by users via article URLs. The system comprises two main applications:

1. Admin App: An administrative interface for managing organizations, speakers, monitored URLs, and processing scraped quotes.
2. Echo App: A user-facing web application that allows users to explore published quotes in a user interface similar to Twitter's.

The project will be built using:

- Next.js 15
- Shadcn UI components
- Tailwind CSS
- Lucide Icons

## Core Functionalities

### 1. Admin App

#### 1.1 Organization Management

- Add Organization:
  - Input field for the organization's name.
  - Button to add the organization to the database.
  - New organizations are added to the top of the list.
  - Ability to upload an image for the organization's logo.
  - The list of organizations is saved in the database.
- Remove Organization:
  - Button to remove an organization from the database.

#### 1.2 Speaker Management

- Add Speaker:
  - Input field for the speaker's name.
  - Button to add the speaker to the database.
  - New speakers are added to the top of the list.
  - Ability to upload an image for the speaker.
  - Option to link the speaker to an organization.
  - The list of speakers is saved in the database.
- Remove Speaker:
  - Button to remove a speaker from the database.

#### 1.3 URL Monitoring Setup

- Add Monitored URL:
  - Input field for the URL.
  - Button to add the URL to the list of monitored URLs.
  - New URLs are added to the top of the list.
  - Ability to upload a logo image for the URL.
  - The list of monitored URLs is saved in the database.
  - The monitored URLs appear in a table with the columns in this order: image, URL
- There should also be a third column that has a "Crawl" button in each row that can be used to manually trigger a crawl of that website
- There should be a fourth column for a Remove Monitored URL Button:
  - Button to remove a URL from the list.

#### 1.4 Quote Scraping Capability

- The system scans the monitored URLs every 4 hours to identify articles likely to contain quotes.
- Article Identification:
  - Utilizes LLMs to read page content.
  - Identifies articles likely to contain quotes.
- Quote Extraction:
  - Navigates to identified articles.
  - Uses LLMs to extract quotes.
  - Intelligently combines split quotes to reduce noise.
  - Extracts the speaker's name and links the quote to a speaker in the database.
  - Generates a concise summary of the quote.

#### 1.5 Quote Staging Table

- Displays all extracted quotes in a table with columns for:
  - Quote Summary (editable)
  - Raw Quote Text (editable)
  - Speaker Name
  - Article Date
  - Article URL
  - Parent Monitored URL
  - Accept/Reject Button
- Accept Quote:
  - Adds the quote to the Published Quotes table.
- Reject Quote:
  - Deletes the quote entirely.

#### 1.6 Published Quotes Table

- Displays all accepted quotes in a table with columns for:
  - Quote Summary
  - Raw Quote Text
  - Speaker Name
  - Article Date
  - Article URL
- When saving quotes to this table, the quote on the back end should be linked to an existing speaker record within the database. The speaker in the database should be able to be looked up through a string match.
- If there is no match, then the quote should remain in the New Quotes tab (staging quotes table) until the speaker is added on the Speakers page.

### 2. Echo App

#### 2.1 User Authentication

- Users can sign up or log in using Google authentication.

#### 2.2 Onboarding Flow

1. User Information:
   - Required: Name, Username.
   - Optional: Profile Photo.
2. Interest Selection:
   - Users select organizations to follow.
   - Users select speakers to follow.
3. Access Newsfeed:
   - Users are directed to the newsfeed displaying the latest quotes from followed organizations and speakers.

#### 2.3 App Information Architecture

##### 2.3.1 Main Navigation Buttons/Pages

- Newsfeed Page:
  - 2 Main tabs
  - "Following" tab: Displays the latest quotes from followed entities.
  - "Everyone" tab: Displays the latest quotes from all speakers on the app.
  - Quote Card components include:
    - Quote Summary
    - Speaker Name (clickable to Speaker Detail Page)
    - Speaker's Image (clickable to Speaker Detail Page)
    - Speaker's Organization Logo (clickable to Organization Detail Page)
    - Article Date
    - Action Buttons:
      - Like:
        - Toggle like status.
        - Update like count.
      - Comment:
        - Opens Quote Detail Page.
        - Activates comment input field.
      - Share:
        - Opens a modal to copy the quote link.
        - Non-users are prompted to sign up when accessing the link.
- Quote Detail Page:
  - Displays the Quote Card.
  - Full Quote Card with raw quote text.
  - Source Card with:
    - Link to the original article.
    - Logo image linked to the monitored URL.
  - Comments Section:
    - Input field for adding comments.
    - Displays all user comments.
- Search Page:
  - Search for quotes by keyword, speaker name, or organization name.
  - Results displayed in Quote Cards.
  - Sorted by relevance.
- Profile Page:
  - Followed Speakers tab:
    - List of speakers the user follows.
    - Each row in the list shows the speaker's image, name, and an unfollow button
    - Clicking on the speaker's image or name will take the user to the  Speaker Detail Page.
  - Followed Organizations tab:
    - List of organizations the user follows.
    - Each row in the list shows the organization's image, name, and an unfollow button
    - Clicking on the organization's image or name will take the user to the  Organization Detail Page.
  - Account Management:
    - Ability to edit profile picture.
    - Ability to delete account.
    - Ability to log out.
- Add Quote Page:
  - Users can submit quotes by:
    - Inputting the quote text.
    - Providing the source URL.
    - Selecting a speaker from the database via search.
  - Submitted quotes are added to the Quote Staging Table in the Admin App.

##### 2.3.2 Secondary Pages

- Speaker Detail Page:
  - Displays all quotes from the selected speaker in Quote Cards.
  - Users can navigate to this page by clicking on a speaker's name or image on any quote card found on the news feed or in search results. They could also navigate by clicking into a speaker on the profile page.
  - There should be a back button allowing the user to go back to where they came from after visiting the page.
- Organization Detail Page:
  - Displays all quotes from speakers associated with the organization in Quote Cards.
  - Users can navigate to this page by clicking on an organization's name on any quote card found on the news feed or in search results. They could also navigate by clicking into an organization on the profile page.
  - There should be a back button allowing the user to go back to where they came from after visiting the page.

## Project File Structure

Here's the proposed file structure for the project:

quotescraper
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env
├── README.md
├── pages
│   ├── index.tsx
│   ├── admin.tsx
│   ├── profile.tsx
│   ├── search.tsx
│   ├── add-quote.tsx
│   ├── quote-detail.tsx
│   ├── _app.tsx
│   ├── _document.tsx
│   └── api
│       ├── scrape.ts
│       ├── auth.ts
│       └── quotes.ts
├── components
│   ├── Layout.tsx
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── QuoteCard.tsx
│   ├── QuoteDetail.tsx
│   ├── OrganizationCard.tsx
│   ├── SpeakerCard.tsx
│   ├── CommentSection.tsx
│   └── UIElements.tsx
├── styles
│   └── globals.css
├── lib
│   ├── utils.ts
│   ├── api.ts
│   └── auth.ts
├── hooks
│   ├── useAuth.ts
│   └── useMobile.tsx
├── models
│   ├── index.ts
│   └── types.ts
├── public
│   └── images
│       ├── logos
│       └── profiles
├── scripts
│   └── scraper.ts
└── data
    └── extracted_quotes.json



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

## Example front-end code for Echo App
```
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Home, Search, User, PlusCircle, Heart, MessageCircle, Share2, ArrowLeft, LogOut, Moon, Sun } from "lucide-react"

const QuoteCard = ({ quote, speaker, organization, date, onClick, onSpeakerClick, onOrganizationClick }) => (
  <Card className="mb-4">
    <CardHeader className="flex flex-row items-center gap-4">
      <Avatar className="cursor-pointer" onClick={onSpeakerClick}>
        <AvatarImage src={speaker.image} alt={speaker.name} />
        <AvatarFallback>{speaker.name[0]}</AvatarFallback>
      </Avatar>
      <div>
        <h3 className="font-bold cursor-pointer hover:underline" onClick={onSpeakerClick}>{speaker.name}</h3>
        <p className="text-sm text-muted-foreground cursor-pointer hover:underline" onClick={onOrganizationClick}>{organization.name}</p>
      </div>
    </CardHeader>
    <CardContent>
      <p className="cursor-pointer" onClick={onClick}>{quote}</p>
    </CardContent>
    <CardFooter className="flex justify-between">
      <Button variant="ghost" size="sm">
        <Heart className="w-4 h-4 mr-2" />
        Like
      </Button>
      <Button variant="ghost" size="sm">
        <MessageCircle className="w-4 h-4 mr-2" />
        Comment
      </Button>
      <Button variant="ghost" size="sm">
        <Share2 className="w-4 h-4 mr-2" />
        Share
      </Button>
    </CardFooter>
  </Card>
)

const ThemeToggle = ({ isDark, onToggle }) => (
  <div className="flex items-center space-x-2">
    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
    <Switch
      checked={isDark}
      onCheckedChange={onToggle}
      aria-label="Toggle dark mode"
    />
    <Moon className="h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
  </div>
)

const NewsfeedPage = ({ onQuoteClick, onSpeakerClick, onOrganizationClick, onAddQuote, isDark, onToggleTheme }) => (
  <div className="relative pb-24">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-2xl font-bold">Newsfeed</h2>
      <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
    </div>
    <QuoteCard
      quote="The best way to predict the future is to invent it."
      speaker={{ name: "Alan Kay", image: "/placeholder.svg?height=40&width=40" }}
      organization={{ name: "Xerox PARC" }}
      date="2023-05-20"
      onClick={() => onQuoteClick("The best way to predict the future is to invent it.")}
      onSpeakerClick={() => onSpeakerClick("Alan Kay")}
      onOrganizationClick={() => onOrganizationClick("Xerox PARC")}
    />
    <QuoteCard
      quote="Stay hungry, stay foolish."
      speaker={{ name: "Steve Jobs", image: "/placeholder.svg?height=40&width=40" }}
      organization={{ name: "Apple Inc." }}
      date="2023-05-19"
      onClick={() => onQuoteClick("Stay hungry, stay foolish.")}
      onSpeakerClick={() => onSpeakerClick("Steve Jobs")}
      onOrganizationClick={() => onOrganizationClick("Apple Inc.")}
    />
    <QuoteCard
      quote="The greatest glory in living lies not in never falling, but in rising every time we fall."
      speaker={{ name: "Nelson Mandela", image: "/placeholder.svg?height=40&width=40" }}
      organization={{ name: "African National Congress" }}
      date="2023-05-18"
      onClick={() => onQuoteClick("The greatest glory in living lies not in never falling, but in rising every time we fall.")}
      onSpeakerClick={() => onSpeakerClick("Nelson Mandela")}
      onOrganizationClick={() => onOrganizationClick("African National Congress")}
    />
    <QuoteCard
      quote="Imagination is more important than knowledge. Knowledge is limited. Imagination encircles the world."
      speaker={{ name: "Albert Einstein", image: "/placeholder.svg?height=40&width=40" }}
      organization={{ name: "Institute for Advanced Study" }}
      date="2023-05-17"
      onClick={() => onQuoteClick("Imagination is more important than knowledge. Knowledge is limited. Imagination encircles the world.")}
      onSpeakerClick={() => onSpeakerClick("Albert Einstein")}
      onOrganizationClick={() => onOrganizationClick("Institute for Advanced Study")}
    />
    <QuoteCard
      quote="The future belongs to those who believe in the beauty of their dreams."
      speaker={{ name: "Eleanor Roosevelt", image: "/placeholder.svg?height=40&width=40" }}
      organization={{ name: "United Nations" }}
      date="2023-05-16"
      onClick={() => onQuoteClick("The future belongs to those who believe in the beauty of their dreams.")}
      onSpeakerClick={() => onSpeakerClick("Eleanor Roosevelt")}
      onOrganizationClick={() => onOrganizationClick("United Nations")}
    />
    <QuoteCard
      quote="Success is not final, failure is not fatal: it is the courage to continue that counts."
      speaker={{ name: "Winston Churchill", image: "/placeholder.svg?height=40&width=40" }}
      organization={{ name: "British Government" }}
      date="2023-05-15"
      onClick={() => onQuoteClick("Success is not final, failure is not fatal: it is the courage to continue that counts.")}
      onSpeakerClick={() => onSpeakerClick("Winston Churchill")}
      onOrganizationClick={() => onOrganizationClick("British Government")}
    />
    <Button
      className="fixed bottom-20 right-4 rounded-full w-14 h-14 shadow-lg"
      onClick={onAddQuote}
    >
      <PlusCircle className="h-6 w-6" />
    </Button>
  </div>
)

const SearchPage = ({ onQuoteClick, onSpeakerClick, onOrganizationClick }) => (
  <div>
    <h2 className="text-2xl font-bold mb-4">Search</h2>
    <Input placeholder="Search quotes, speakers, or organizations" className="mb-4" />
    <QuoteCard
      quote="Innovation distinguishes between a leader and a follower."
      speaker={{ name: "Steve Jobs", image: "/placeholder.svg?height=40&width=40" }}
      organization={{ name: "Apple Inc." }}
      date="2023-05-18"
      onClick={() => onQuoteClick("Innovation distinguishes between a leader and a follower.")}
      onSpeakerClick={() => onSpeakerClick("Steve Jobs")}
      onOrganizationClick={() => onOrganizationClick("Apple Inc.")}
    />
  </div>
)

const ProfilePage = ({ onLogout, onSpeakerClick, onOrganizationClick }) => (
  <div>
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-2xl font-bold">Profile</h2>
      <Button variant="ghost" size="sm" onClick={onLogout}>
        <LogOut className="w-4 h-4 mr-2" />
        Log out
      </Button>
    </div>
    <div className="flex items-center gap-4 mb-6">
      <Avatar className="w-16 h-16">
        <AvatarImage src="/placeholder.svg?height=64&width=64" alt="User" />
        <AvatarFallback>U</AvatarFallback>
      </Avatar>
      <div>
        <h3 className="text-xl font-bold">John Doe</h3>
        <p className="text-muted-foreground">@johndoe</p>
      </div>
    </div>
    <Tabs defaultValue="speakers" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="speakers">Followed Speakers</TabsTrigger>
        <TabsTrigger value="organizations">Followed Organizations</TabsTrigger>
      </TabsList>
      <TabsContent value="speakers">
        <ul className="space-y-4">
          {["Steve Jobs", "Elon Musk", "Mark Zuckerberg", "Satya Nadella"].map((speaker, index) => (
            <li key={index} className="flex items-center gap-4 cursor-pointer hover:bg-accent rounded-lg p-2" onClick={() => onSpeakerClick(speaker)}>
              <Avatar>
                <AvatarImage src={`/placeholder.svg?height=40&width=40`} alt={speaker} />
                <AvatarFallback>{speaker[0]}</AvatarFallback>
              </Avatar>
              <span>{speaker}</span>
            </li>
          ))}
        </ul>
      </TabsContent>
      <TabsContent value="organizations">
        <ul className="space-y-4">
          {["Apple Inc.", "Tesla", "Microsoft", "Google"].map((org, index) => (
            <li key={index} className="flex items-center gap-4 cursor-pointer hover:bg-accent rounded-lg p-2" onClick={() => onOrganizationClick(org)}>
              <Avatar>
                <AvatarImage src={`/placeholder.svg?height=40&width=40`} alt={org} />
                <AvatarFallback>{org[0]}</AvatarFallback>
              </Avatar>
              <span>{org}</span>
            </li>
          ))}
        </ul>
      </TabsContent>
    </Tabs>
  </div>
)

const AddQuotePage = () => (
  <div>
    <h2 className="text-2xl font-bold mb-4">Add Quote</h2>
    <form className="space-y-4">
      <div>
        <label htmlFor="quote" className="block text-sm font-medium mb-1">
          Quote
        </label>
        <textarea id="quote" className="w-full p-2 border rounded" rows={4}></textarea>
      </div>
      <div>
        <label htmlFor="source" className="block text-sm font-medium mb-1">
          Source URL
        </label>
        <Input id="source" type="url" />
      </div>
      <div>
        <label htmlFor="speaker" className="block text-sm font-medium mb-1">
          Speaker
        </label>
        <Input id="speaker" placeholder="Search for a speaker" />
      </div>
      <Button type="submit">Submit Quote</Button>
    </form>
  </div>
)

const QuoteDetailPage = ({ quote, onBack }) => (
  <div>
    <Button variant="ghost" onClick={onBack} className="mb-4">
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back
    </Button>
    <QuoteCard
      quote={quote}
      speaker={{ name: "Speaker Name", image: "/placeholder.svg?height=40&width=40" }}
      organization={{ name: "Organization Name" }}
      date="2023-05-20"
    />
    <Card className="mb-4">
      <CardHeader>
        <h3 className="font-bold">Source</h3>
      </CardHeader>
      <CardContent>
        <a href="#" className="text-blue-500 hover:underline">
          https://example.com/original-article
        </a>
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <h3 className="font-bold">Comments</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <Avatar>
              <AvatarImage src="/placeholder.svg?height=40&width=40" alt="User 1" />
              <AvatarFallback>U1</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">User 1</p>
              <p className="text-sm text-muted-foreground">Great quote! Very inspiring.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Avatar>
              <AvatarImage src="/placeholder.svg?height=40&width=40" alt="User 2" />
              <AvatarFallback>U2</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">User 2</p>
              <p className="text-sm text-muted-foreground">I completely agree with this sentiment.</p>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Input placeholder="Add a comment..." className="mr-2" />
        <Button>Post</Button>
      </CardFooter>
    </Card>
  </div>
)

const SpeakerDetailPage = ({ speaker, onBack, onQuoteClick, onOrganizationClick }) => (
  <div>
    <Button variant="ghost" onClick={onBack} className="mb-4">
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back
    </Button>
    <div className="flex items-center gap-4 mb-6">
      <Avatar className="w-16 h-16">
        <AvatarImage src="/placeholder.svg?height=64&width=64" alt={speaker} />
        <AvatarFallback>{speaker[0]}</AvatarFallback>
      </Avatar>
      <h2 className="text-2xl font-bold">{speaker}</h2>
    </div>
    <h3 className="text-xl font-bold mb-4">Quotes</h3>
    <QuoteCard
      quote="The best way to predict the future is to invent it."
      speaker={{ name: speaker, image: "/placeholder.svg?height=40&width=40" }}
      organization={{ name: "Xerox PARC" }}
      
      date="2023-05-20"
      onClick={() => onQuoteClick("The best way to predict the future is to invent it.")}
      onOrganizationClick={() => onOrganizationClick("Xerox PARC")}
    />
    <QuoteCard
      quote="Stay hungry, stay foolish."
      speaker={{ name: speaker, image: "/placeholder.svg?height=40&width=40" }}
      organization={{ name: "Apple Inc." }}
      date="2023-05-19"
      onClick={() => onQuoteClick("Stay hungry, stay foolish.")}
      onOrganizationClick={() => onOrganizationClick("Apple Inc.")}
    />
  </div>
)

const OrganizationDetailPage = ({ organization, onBack, onQuoteClick, onSpeakerClick }) => (
  <div>
    <Button variant="ghost" onClick={onBack} className="mb-4">
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back
    </Button>
    <div className="flex items-center gap-4 mb-6">
      <Avatar className="w-16 h-16">
        <AvatarImage src="/placeholder.svg?height=64&width=64" alt={organization} />
        <AvatarFallback>{organization[0]}</AvatarFallback>
      </Avatar>
      <h2 className="text-2xl font-bold">{organization}</h2>
    </div>
    <h3 className="text-xl font-bold mb-4">Quotes</h3>
    <QuoteCard
      quote="The best way to predict the future is to invent it."
      speaker={{ name: "Alan Kay", image: "/placeholder.svg?height=40&width=40" }}
      organization={{ name: organization }}
      date="2023-05-20"
      onClick={() => onQuoteClick("The best way to predict the future is to invent it.")}
      onSpeakerClick={() => onSpeakerClick("Alan Kay")}
    />
    <QuoteCard
      quote="Stay hungry, stay foolish."
      speaker={{ name: "Steve Jobs", image: "/placeholder.svg?height=40&width=40" }}
      organization={{ name: organization }}
      date="2023-05-19"
      onClick={() => onQuoteClick("Stay hungry, stay foolish.")}
      onSpeakerClick={() => onSpeakerClick("Steve Jobs")}
    />
  </div>
)

const Navigation = ({ activePage, setActivePage }) => 
  activePage !== "speaker-detail" && activePage !== "organization-detail" && (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-2 flex justify-around items-center">
      <Button variant={activePage === "newsfeed" ? "default" : "ghost"} size="icon" className="w-12 h-12" onClick={() => setActivePage("newsfeed")}>
        <Home className="h-6 w-6" />
      </Button>
      <Button variant={activePage === "search" ? "default" : "ghost"} size="icon" className="w-12 h-12" onClick={() => setActivePage("search")}>
        <Search className="h-6 w-6" />
      </Button>
      <Button variant={activePage === "profile" ? "default" : "ghost"}   size="icon" className="w-12 h-12" onClick={() => setActivePage("profile")}>
        <User className="h-6 w-6" />
      </Button>
    </nav>
  )

export default function EchoApp() {
  const [activePage, setActivePage] = useState("newsfeed")
  const [selectedQuote, setSelectedQuote] = useState(null)
  const [selectedSpeaker, setSelectedSpeaker] = useState(null)
  const [selectedOrganization, setSelectedOrganization] = useState(null)
  const [previousPage, setPreviousPage] = useState(null)
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  const handleQuoteClick = (quote) => {
    setSelectedQuote(quote)
    setPreviousPage(activePage)
    setActivePage("quote-detail")
  }

  const handleSpeakerClick = (speaker) => {
    setSelectedSpeaker(speaker)
    setPreviousPage(activePage)
    setActivePage("speaker-detail")
  }

  const handleOrganizationClick = (organization) => {
    setSelectedOrganization(organization)
    setPreviousPage(activePage)
    setActivePage("organization-detail")
  }

  const handleAddQuote = () => {
    setPreviousPage(activePage)
    setActivePage("add-quote")
  }

  const handleBack = () => {
    setActivePage(previousPage)
    setPreviousPage(null)
  }

  const handleLogout = () => {
    // Implement logout logic here
    console.log("User logged out")
  }

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
  }

  return (
    <div className={`flex flex-col min-h-screen bg-background text-foreground ${isDarkMode ? 'dark' : ''}`}>
      <main className="flex-1 p-4 mb-16 max-w-2xl mx-auto">
        {activePage === "newsfeed" && (
          <NewsfeedPage
            onQuoteClick={handleQuoteClick}
            onSpeakerClick={handleSpeakerClick}
            onOrganizationClick={handleOrganizationClick}
            onAddQuote={handleAddQuote}
            isDark={isDarkMode}
            onToggleTheme={toggleDarkMode}
          />
        )}
        {activePage === "search" && (
          <SearchPage
            onQuoteClick={handleQuoteClick}
            onSpeakerClick={handleSpeakerClick}
            onOrganizationClick={handleOrganizationClick}
          />
        )}
        {activePage === "profile" && (
          <ProfilePage
            onLogout={handleLogout}
            onSpeakerClick={handleSpeakerClick}
            onOrganizationClick={handleOrganizationClick}
          />
        )}
        {activePage === "add-quote" && <AddQuotePage />}
        {activePage === "quote-detail" && <QuoteDetailPage quote={selectedQuote} onBack={handleBack} />}
        {activePage === "speaker-detail" && (
          <SpeakerDetailPage
            speaker={selectedSpeaker}
            onBack={handleBack}
            onQuoteClick={handleQuoteClick}
            onOrganizationClick={handleOrganizationClick}
          />
        )}
        {activePage === "organization-detail" && (
          <OrganizationDetailPage
            organization={selectedOrganization}
            onBack={handleBack}
            onQuoteClick={handleQuoteClick}
            onSpeakerClick={handleSpeakerClick}
          />
        )}
      </main>
      <Navigation activePage={activePage} setActivePage={setActivePage} />
    </div>
  )
}
```