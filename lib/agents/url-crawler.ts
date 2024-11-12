import { StateGraph } from 'langgraph'
import { createClient } from '@supabase/supabase-js'
import { TypedDict } from 'typing_extensions'
import { JSDOM } from 'jsdom'

// Define our state schema
interface CrawlerState extends TypedDict {
  urls: {
    id: string
    url: string
    active: boolean
    last_crawled_at: string | null
  }[]
  articles: {
    url: string
    headline: string
    parent_url: string
  }[]
  current_url_index: number
  logs: string[]
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Node function to fetch URLs from database
async function fetchUrls(state: CrawlerState) {
  const { data: urls, error } = await supabase
    .from('monitored_urls')
    .select('*')
    .eq('active', true)

  if (error) throw error

  return {
    urls,
    current_url_index: 0,
    logs: ['Fetched monitored URLs from database']
  }
}

// Node function to extract articles from current URL
async function extractArticles(state: CrawlerState) {
  const currentUrl = state.urls[state.current_url_index]
  if (!currentUrl) return { articles: [] }

  try {
    const response = await fetch(currentUrl.url)
    const html = await response.text()
    const dom = new JSDOM(html)
    const document = dom.window.document

    const articles = Array.from(document.querySelectorAll('article a, .article a, .post a'))
      .map(element => {
        const link = element as HTMLAnchorElement
        return {
          url: new URL(link.href, currentUrl.url).toString(),
          headline: link.textContent?.trim() || '',
          parent_url: currentUrl.url
        }
      })
      .filter(article => article.headline)

    return {
      articles: [...state.articles, ...articles],
      logs: [...state.logs, `Extracted ${articles.length} articles from ${currentUrl.url}`]
    }
  } catch (error) {
    return {
      logs: [...state.logs, `Error extracting articles from ${currentUrl.url}: ${error}`]
    }
  }
}

// Node function to save articles to database
async function saveArticles(state: CrawlerState) {
  if (state.articles.length === 0) return state

  const { error } = await supabase
    .from('staged_articles')
    .insert(
      state.articles.map(article => ({
        url: article.url,
        headline: article.headline,
        parent_url: article.parent_url,
        discovered_at: new Date().toISOString()
      }))
    )

  if (error) throw error

  return {
    logs: [...state.logs, `Saved ${state.articles.length} articles to database`]
  }
}

// Node function to update last crawled timestamp
async function updateTimestamp(state: CrawlerState) {
  const currentUrl = state.urls[state.current_url_index]
  if (!currentUrl) return state

  const { error } = await supabase
    .from('monitored_urls')
    .update({ last_crawled_at: new Date().toISOString() })
    .eq('id', currentUrl.id)

  if (error) throw error

  return {
    current_url_index: state.current_url_index + 1,
    logs: [...state.logs, `Updated last_crawled_at for ${currentUrl.url}`]
  }
}

// Function to determine if we should continue crawling
function shouldContinue(state: CrawlerState) {
  if (state.current_url_index < state.urls.length) {
    return 'extract_articles'
  }
  return 'end'
}

// Create and configure the graph
export function createCrawlerGraph() {
  const workflow = new StateGraph<CrawlerState>({
    urls: [],
    articles: [],
    current_url_index: 0,
    logs: []
  })

  // Add nodes
  workflow.addNode('fetch_urls', fetchUrls)
  workflow.addNode('extract_articles', extractArticles)
  workflow.addNode('save_articles', saveArticles)
  workflow.addNode('update_timestamp', updateTimestamp)

  // Add edges
  workflow.addEdge('START', 'fetch_urls')
  workflow.addEdge('fetch_urls', 'extract_articles')
  workflow.addEdge('extract_articles', 'save_articles')
  workflow.addEdge('save_articles', 'update_timestamp')
  
  // Add conditional edge for looping
  workflow.addConditionalEdges(
    'update_timestamp',
    shouldContinue
  )

  return workflow.compile()
} 