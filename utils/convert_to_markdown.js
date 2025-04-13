/**
 * Convert HTML to Markdown in Database
 * 
 * This script converts all existing HTML content in the extracted_content field
 * of the database to Markdown format. It's a one-time migration script to update
 * the database after changing the content storage format.
 * 
 * Usage: node utils/convert_to_markdown.js
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import TurndownService from 'turndown';
import fs from 'fs';

// Initialize turndown for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  hr: '---'
});

// Helper function to convert HTML to Markdown
function convertToMarkdown(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return '';
  }
  
  try {
    return turndownService.turndown(htmlContent);
  } catch (error) {
    console.error('Error converting HTML to Markdown:', error.message);
    return htmlContent; // Return original content if conversion fails
  }
}

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

    // Get total number of articles
    const { total } = db.prepare('SELECT COUNT(*) as total FROM articles').get();
    console.log(`Found ${total} articles in the database`);

    // Get all articles with extracted_content
    const articles = db.prepare(`
      SELECT id, title, extracted_content 
      FROM articles 
      WHERE extracted_content IS NOT NULL
    `).all();

    console.log(`Found ${articles.length} articles with extracted content`);

    let convertedCount = 0;
    let errorCount = 0;
    let unchangedCount = 0;

    // Prepare update statement
    const updateStmt = db.prepare(`
      UPDATE articles
      SET extracted_content = ?
      WHERE id = ?
    `);

    // Process each article
    for (const article of articles) {
      try {
        // Skip if it looks like it's already in Markdown format
        // This is a simple heuristic - Markdown typically doesn't have HTML tags
        const content = article.extracted_content;
        
        if (!content) {
          unchangedCount++;
          continue;
        }

        // Simple check if it's likely already Markdown - doesn't have HTML tags
        const hasHtmlTags = /<[a-z][\s\S]*>/i.test(content);
        
        if (!hasHtmlTags) {
          console.log(`Article ${article.id} (${article.title}) appears to be already in Markdown format. Skipping.`);
          unchangedCount++;
          continue;
        }

        // Convert HTML to Markdown
        const markdown = convertToMarkdown(content);
        
        // Update the database
        updateStmt.run(markdown, article.id);
        
        convertedCount++;
        
        // Log progress every 100 articles
        if (convertedCount % 100 === 0) {
          console.log(`Converted ${convertedCount} articles so far...`);
        }
      } catch (error) {
        console.error(`Error processing article ${article.id} (${article.title}):`, error.message);
        errorCount++;
      }
    }

    // Commit the transaction
    db.exec('COMMIT');

    console.log('\nConversion complete!');
    console.log(`Total articles processed: ${articles.length}`);
    console.log(`Articles converted: ${convertedCount}`);
    console.log(`Articles already in Markdown: ${unchangedCount}`);
    console.log(`Errors encountered: ${errorCount}`);

  } catch (error) {
    // Rollback on error
    db.exec('ROLLBACK');
    console.error('An error occurred during conversion:', error.message);
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