/**
 * Rebuild Keywords with OpenAI GPT-4o mini
 * 
 * This script processes all articles in the database and rebuilds their keywords
 * using OpenAI's GPT-4o mini model for high-quality tag extraction.
 * 
 * Usage: node utils/rebuild_keywords.js [--limit=100] [--batch=10]
 * 
 * Options:
 *   --limit=N    Process only N articles (default: all articles)
 *   --batch=N    Process articles in batches of N (default: 10)
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { extractDetailedKeywords } from '../src/keywordExtractor.js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith('--limit=')) {
    acc.limit = parseInt(arg.split('=')[1]);
  }
  if (arg.startsWith('--batch=')) {
    acc.batchSize = parseInt(arg.split('=')[1]);
  }
  return acc;
}, { limit: null, batchSize: 10 });

async function main() {
  // Get directory path of the current module
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  
  // Path to the database
  const dbPath = path.resolve(__dirname, '..', 'storage', 'news.db');
  
  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at ${dbPath}`);
    process.exit(1);
  }

  console.log(`Opening database at ${dbPath}`);
  const db = new Database(dbPath);

  try {
    // Get total number of articles with content
    const { total } = db.prepare('SELECT COUNT(*) as total FROM articles WHERE extracted_content IS NOT NULL').get();
    console.log(`Found ${total} articles with content in the database`);
    
    // Limit the number of articles to process if specified
    const limit = args.limit ? Math.min(args.limit, total) : total;
    console.log(`Will process ${limit} articles with batch size ${args.batchSize}`);

    // Get query to retrieve articles
    let query = `
      SELECT id, title, description, extracted_content 
      FROM articles 
      WHERE extracted_content IS NOT NULL
      ORDER BY id DESC
    `;
    
    if (args.limit) {
      query += ` LIMIT ${args.limit}`;
    }
    
    // Prepare update statement
    const updateStmt = db.prepare(`
      UPDATE articles
      SET keywords = ?
      WHERE id = ?
    `);
    
    // Process articles in batches
    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    // Get all article IDs first
    const articleIds = db.prepare(query).all().map(a => a.id);
    
    // Process articles in batches
    for (let i = 0; i < articleIds.length; i += args.batchSize) {
      const batchIds = articleIds.slice(i, i + args.batchSize);
      console.log(`\nProcessing batch ${Math.floor(i/args.batchSize) + 1} (articles ${i+1}-${i+batchIds.length} of ${limit})...`);
      
      // Get articles for this batch
      const batchQuery = `
        SELECT id, title, description, extracted_content 
        FROM articles 
        WHERE id IN (${batchIds.join(',')})
      `;
      
      const articles = db.prepare(batchQuery).all();
      
      // Process each article in the batch
      await Promise.all(articles.map(async (article) => {
        try {
          processedCount++;
          console.log(`[${processedCount}/${limit}] Processing article: ${article.id} - ${article.title}`);
          
          // Extract detailed keywords with OpenAI
          const detailedKeywords = await extractDetailedKeywords({
            title: article.title,
            description: article.description,
            extracted_content: article.extracted_content
          });
          
          if (!detailedKeywords || detailedKeywords.length === 0) {
            console.log(`  No keywords found for article ${article.id}`);
            return;
          }
          
          // Store basic keywords for compatibility with existing code
          const simpleKeywords = detailedKeywords.map(kw => kw.name);
          
          // Log the extracted keywords
          console.log(`  Extracted ${detailedKeywords.length} keywords:`);
          detailedKeywords.slice(0, 5).forEach(kw => {
            console.log(`    - ${kw.name}`);
          });
          
          // Start a transaction for the update
          db.exec('BEGIN TRANSACTION');
          
          try {
            // Update the article with new keywords
            updateStmt.run(JSON.stringify(simpleKeywords), article.id);
            db.exec('COMMIT');
            updatedCount++;
          } catch (error) {
            db.exec('ROLLBACK');
            console.error(`  Error updating article ${article.id}:`, error.message);
            errorCount++;
          }
        } catch (error) {
          console.error(`  Error processing article ${article.id}:`, error.message);
          errorCount++;
        }
      }));
      
      // Log batch progress
      console.log(`\nBatch complete. Updated ${updatedCount} articles so far (${errorCount} errors)`);
      
      // Small delay to prevent API rate limits
      if (i + args.batchSize < articleIds.length) {
        console.log('Waiting 5 seconds before next batch to avoid OpenAI API rate limits...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log('\nKeyword extraction complete!');
    console.log(`Total articles processed: ${processedCount}`);
    console.log(`Articles updated with new keywords: ${updatedCount}`);
    console.log(`Errors encountered: ${errorCount}`);

  } catch (error) {
    console.error('An error occurred during keyword extraction:', error.message);
  } finally {
    // Close the database connection
    db.close();
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});