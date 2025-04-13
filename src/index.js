/**
 * News Collector Application
 * 
 * This is the main entry point for the News Collector application.
 */

import { parseOpmlDirectory } from './opmlParser.js';
import { fetchFeeds } from './rssFetcher.js';
import { fetchContent } from './contentFetcher.js';
import { extractArticleContent } from './articleExtractor.js';
import { storeArticle } from './database.js';
import path from 'path';

// Configuration
const OPML_DIR = path.join(process.cwd(), 'opml');
const CONCURRENCY = {
  FEEDS: 3    // Number of feeds to process concurrently
};

/**
 * Main function to run the news collection process
 */
async function collectNews() {
  try {
    console.log('Starting News Collector...');
    console.log(`OPML Directory: ${OPML_DIR}`);
    
    // Step 1: Parse OPML files to get feed information
    console.log('\n--- Parsing OPML files ---');
    const feeds = await parseOpmlDirectory(OPML_DIR);
    console.log(`Found ${feeds.length} feeds across all OPML files`);
    
    // Group feeds by category for processing and reporting
    const feedsByCategory = feeds.reduce((acc, feed) => {
      acc[feed.category] = acc[feed.category] || [];
      acc[feed.category].push(feed);
      return acc;
    }, {});
    
    // Process each category
    for (const [category, categoryFeeds] of Object.entries(feedsByCategory)) {
      console.log(`\n--- Processing category: ${category} (${categoryFeeds.length} feeds) ---`);
      
      // Step 2: Fetch RSS feeds to get article metadata
      console.log('\n--- Fetching RSS feeds ---');
      const articles = await fetchFeeds(categoryFeeds, CONCURRENCY.FEEDS);
      console.log(`Fetched ${articles.length} articles from ${categoryFeeds.length} feeds`);
      
      if (articles.length === 0) {
        console.log(`No articles found for category: ${category}`);
        continue;
      }
      
      // Step 3: Process each article individually (fetch, extract, store)
      console.log('\n--- Processing articles ---');
      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;
      
      // Process articles one at a time to avoid race conditions
      for (const article of articles) {
        try {
          // Step 3a: Fetch HTML content
          console.log(`Fetching content for: ${article.title}`);
          const content = await fetchContent(article.link);
          
          // Skip further processing if article was already in database
          if (content.skipped) {
            console.log(`Skipping article already in database: ${article.title}`);
            processedCount++;
            continue;
          }
          
          // Skip further processing if fetch failed or content has an error
          if (!content.html || content.error) {
            console.log(`Skipping article due to fetch error: ${article.title}`);
            processedCount++;
            errorCount++;
            continue;
          }
          
          // Step 3b: Extract article content
          console.log(`Extracting content for: ${article.title}`);
          const extractedArticle = await extractArticleContent({...article, content});
          
          // Remove raw HTML before storage to save space
          if (extractedArticle.content && extractedArticle.content.html) {
            delete extractedArticle.content.html;
          }
          
          // Step 3c: Store the article immediately
          console.log(`Storing article: ${article.title}`);
          const result = await storeArticle(extractedArticle);
          
          if (result.success) {
            successCount++;
            console.log(`Successfully stored: ${article.title}`);
          } else {
            errorCount++;
            console.error(`Failed to store article: ${article.title}`, result.error);
          }
        } catch (error) {
          errorCount++;
          console.error(`Error processing article ${article.title}:`, error);
        }
        
        processedCount++;
      }
      
      console.log(`\nCategory ${category} complete!`);
      console.log(`Processed ${processedCount} articles`);
      console.log(`Stored ${successCount} articles successfully`);
      if (errorCount > 0) {
        console.log(`Failed to store ${errorCount} articles`);
      }
    }
    
    console.log('\n--- News collection completed successfully ---');
  } catch (error) {
    console.error('Error in news collection process:', error);
    process.exit(1);
  }
}

// Run the application if this file is executed directly
collectNews().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export {
  collectNews
};
