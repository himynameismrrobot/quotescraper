const { startScrape } = require('./playerScraper');

// Execute the scrape
console.log('Starting player scraper...');
startScrape()
  .then(() => console.log('Scraping completed'))
  .catch((error: Error) => console.error('Error during scraping:', error)); 