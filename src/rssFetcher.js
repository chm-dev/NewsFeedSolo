/**
 * RSS Fetcher Module
 * 
 * This module is responsible for fetching and parsing RSS feeds.
 * It takes feed URLs from the OPML parser and retrieves the content
 * of each feed, extracting article information.
 */

import Parser from 'rss-parser';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get max articles per feed from environment or use default
const MAX_ARTICLES_PER_FEED = parseInt(process.env.MAX_ARTICLES_PER_FEED || 50);

const parser = new Parser({
  timeout: 10000, // 10 seconds timeout
  headers: {
    'User-Agent': 'NewsCollector/1.0.0 (https://github.com/yourusername/news-collector)'
  }
});

/**
 * Fetch and parse an RSS feed
 * @param {Object} feed - Feed object with xmlUrl, title, category, etc.
 * @returns {Promise<Array>} - Array of article objects from the feed
 */
async function fetchFeed(feed) {
  try {
    console.log(`Fetching feed: ${feed.title} (${feed.xmlUrl})`);
    
    // Parse the feed
    const feedContent = await parser.parseURL(feed.xmlUrl);
    
    // Extract and normalize articles, limiting to MAX_ARTICLES_PER_FEED
    const articles = feedContent.items
      .slice(0, MAX_ARTICLES_PER_FEED) // Limit the number of articles per feed
      .map(item => {
        return {
          title: item.title || 'Untitled',
          link: item.link || '',
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          author: item.creator || item.author || feedContent.title || 'Unknown',
          content: item.content || item.contentSnippet || '',
          guid: item.guid || item.id || item.link || '',
          categories: item.categories || [],
          // Add feed metadata to each article
          feedTitle: feed.title,
          feedUrl: feed.xmlUrl,
          feedCategory: feed.category
        };
      });
    
    console.log(`Fetched ${articles.length} articles from ${feed.title} (limited to ${MAX_ARTICLES_PER_FEED})`);
    return articles;
  } catch (error) {
    console.error(`Error fetching feed ${feed.xmlUrl}:`, error.message);
    // Return empty array on error to continue processing other feeds
    return [];
  }
}

/**
 * Fetch multiple feeds in parallel with rate limiting
 * @param {Array} feeds - Array of feed objects
 * @param {number} concurrency - Number of concurrent requests
 * @returns {Promise<Array>} - Array of article objects from all feeds
 */
async function fetchFeeds(feeds, concurrency = 3) {
  const results = [];
  
  // Process feeds in batches to limit concurrency
  for (let i = 0; i < feeds.length; i += concurrency) {
    const batch = feeds.slice(i, i + concurrency);
    const batchPromises = batch.map(feed => fetchFeed(feed));
    
    // Wait for the current batch to complete
    const batchResults = await Promise.all(batchPromises);
    
    // Add batch results to the overall results
    results.push(...batchResults.flat());
    
    // Add a small delay between batches to be nice to servers
    if (i + concurrency < feeds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

export {
  fetchFeed,
  fetchFeeds
};
