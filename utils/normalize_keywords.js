/**
 * Normalize Keywords in Database
 * 
 * This script normalizes all existing keywords in the database to lowercase format.
 * It's a one-time migration script to ensure consistent keyword format for better topic modeling.
 * 
 * Usage: node utils/normalize_keywords.js
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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
    // Start a transaction
    db.exec('BEGIN TRANSACTION');

    // Get total number of articles with keywords
    const { total } = db.prepare('SELECT COUNT(*) as total FROM articles WHERE keywords IS NOT NULL').get();
    console.log(`Found ${total} articles with keywords in the database`);

    // Get all articles with keywords
    const articles = db.prepare(`
      SELECT id, title, keywords 
      FROM articles 
      WHERE keywords IS NOT NULL
    `).all();

    console.log(`Processing ${articles.length} articles with keywords`);

    let updatedCount = 0;
    let errorCount = 0;
    let unchangedCount = 0;

    // Prepare update statement
    const updateStmt = db.prepare(`
      UPDATE articles
      SET keywords = ?
      WHERE id = ?
    `);

    // Process each article
    for (const article of articles) {
      try {
        // Parse keywords JSON
        const keywords = JSON.parse(article.keywords);
        
        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
          unchangedCount++;
          continue;
        }

        // Check if any keywords need normalization
        const normalizedKeywords = keywords.map(keyword => keyword.toLowerCase());
        
        // Check if anything changed after normalization
        const needsUpdate = JSON.stringify(keywords) !== JSON.stringify(normalizedKeywords);
        
        if (!needsUpdate) {
          unchangedCount++;
          continue;
        }

        // Update the database with normalized keywords
        updateStmt.run(JSON.stringify(normalizedKeywords), article.id);
        
        updatedCount++;
        
        // Log progress every 100 articles
        if (updatedCount % 100 === 0) {
          console.log(`Normalized keywords for ${updatedCount} articles so far...`);
        }
      } catch (error) {
        console.error(`Error processing article ${article.id} (${article.title}):`, error.message);
        errorCount++;
      }
    }

    // Commit the transaction
    db.exec('COMMIT');

    console.log('\nNormalization complete!');
    console.log(`Total articles processed: ${articles.length}`);
    console.log(`Articles updated: ${updatedCount}`);
    console.log(`Articles already normalized: ${unchangedCount}`);
    console.log(`Errors encountered: ${errorCount}`);

  } catch (error) {
    // Rollback on error
    db.exec('ROLLBACK');
    console.error('An error occurred during normalization:', error.message);
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