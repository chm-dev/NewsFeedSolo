/**
 * Extract entities from a single article using Google Cloud Natural Language API
 * 
 * This script retrieves a specific article from the database and analyzes it
 * with Google Cloud Natural Language API, then logs the full entity analysis results.
 * 
 * Usage: node utils/extract_single_article_entities.js [--id=<article_id>]
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { LanguageServiceClient } from '@google-cloud/language';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Parse command line arguments to allow overriding the article ID
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith('--id=')) {
    acc.articleId = parseInt(arg.split('=')[1]);
  }
  return acc;
}, { articleId: 145 }); // Default to article ID 145

// Initialize the Language client
const languageClient = new LanguageServiceClient();

async function analyzeEntities(text) {
  try {
    // Prepare the document for the API
    const document = {
      content: text,
      type: 'PLAIN_TEXT',
      language: 'en' // Assuming English content
    };
    
    // Analyze entities in the text
    console.log('Sending request to Google Cloud Natural Language API...');
    const [result] = await languageClient.analyzeEntities({ document });
    return result;
  } catch (error) {
    console.error('Error analyzing entities:', error.message);
    throw error;
  }
}

function cleanText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove URLs
  let cleaned = text.replace(/https?:\/\/[^\s]+/g, '');

  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
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
    // Get the article with the specified ID
    console.log(`Retrieving article with ID: ${args.articleId}`);
    const article = db.prepare(`
      SELECT id, title, description, extracted_content, keywords, content
      FROM articles
      WHERE id = ?
    `).get(args.articleId);

    if (!article) {
      console.error(`Article with ID ${args.articleId} not found!`);
      process.exit(1);
    }

    console.log('\n=========== ARTICLE DETAILS ===========');
    console.log(`ID: ${article.id}`);
    console.log(`Title: ${article.title}`);
    console.log(`Description: ${article.description?.substring(0, 100)}...`);
    
    let currentKeywords = [];
    try {
      currentKeywords = JSON.parse(article.keywords || '[]');
      console.log('\nCurrent keywords in database:');
      console.log(currentKeywords);
    } catch (e) {
      console.log('No valid keywords in database');
    }

    // Prepare and clean the text for analysis
    const textToAnalyze = [
      article.title || '',
      article.description || '',
      article.extracted_content || '',
      article.content || ''  // Include raw content as well for more potential entities
    ].filter(Boolean).join(' ');

    const cleanedText = cleanText(textToAnalyze);
    console.log(`\nText length for analysis: ${cleanedText.length} characters`);

    if (cleanedText.length < 20) {
      console.error('Text is too short for meaningful entity analysis');
      process.exit(1);
    }

    console.log('\n=========== ENTITY ANALYSIS ===========');
    const analysis = await analyzeEntities(cleanedText);
    
    // Log the full response for debugging
    console.log('\nRaw API Response:');
    console.log(JSON.stringify(analysis, null, 2));

    // Get configured threshold from env (or use default)
    const minSalience = parseFloat(process.env.LANGUAGE_API_MIN_SALIENCE || 0.01);
    console.log(`\nCurrent salience threshold: ${minSalience}`);

    // Count total entities and those above threshold
    const totalEntities = analysis.entities.length;
    const entitiesAboveThreshold = analysis.entities.filter(e => e.salience >= minSalience).length;
    console.log(`Total entities detected: ${totalEntities}`);
    console.log(`Entities with salience >= ${minSalience}: ${entitiesAboveThreshold}`);
    
    // Extract and format entities by type
    const entitiesByType = {};
    analysis.entities.forEach(entity => {
      if (!entitiesByType[entity.type]) {
        entitiesByType[entity.type] = [];
      }
      entitiesByType[entity.type].push({
        name: entity.name,
        salience: entity.salience,
        mentions: entity.mentions.length,
        metadata: entity.metadata
      });
    });

    // Print entities by type
    console.log('\n=========== ENTITIES BY TYPE (ALL) ===========');
    Object.keys(entitiesByType).forEach(type => {
      console.log(`\n--- ${type} ---`);
      // Sort by salience
      entitiesByType[type]
        .sort((a, b) => b.salience - a.salience)
        .forEach(entity => {
          const belowThreshold = entity.salience < minSalience ? ' [BELOW THRESHOLD]' : '';
          console.log(`${entity.name} (salience: ${entity.salience.toFixed(4)}, mentions: ${entity.mentions})${belowThreshold}`);
          // Print metadata if available
          if (Object.keys(entity.metadata).length > 0) {
            console.log(`  Metadata: ${JSON.stringify(entity.metadata)}`);
          }
        });
    });

    // Compare with current keywords
    console.log('\n=========== COMPARISON WITH CURRENT KEYWORDS ===========');
    const entityNames = analysis.entities.map(e => e.name.toLowerCase());
    const existingKeywords = currentKeywords.map(k => k.toLowerCase());
    
    const onlyInGoogle = entityNames.filter(name => !existingKeywords.includes(name));
    const onlyInDatabase = existingKeywords.filter(name => !entityNames.includes(name));
    const inBoth = entityNames.filter(name => existingKeywords.includes(name));

    console.log('\nEntities only found by Google API:');
    console.log(onlyInGoogle.join(', '));
    
    console.log('\nKeywords only in database:');
    console.log(onlyInDatabase.join(', '));
    
    console.log('\nFound in both:');
    console.log(inBoth.join(', '));

    // Show what keywords would be selected with current threshold
    console.log('\n=========== KEYWORDS WITH CURRENT THRESHOLD ===========');
    const keywordsWithThreshold = analysis.entities
      .filter(entity => entity.salience >= minSalience)
      .filter(entity => {
          const name = entity.name.toLowerCase();
          return name.length > 1 && 
                 !/^https?:\/\//.test(name) &&
                 !/^\d+$/.test(name);
      })
      .map(entity => entity.name.toLowerCase())
      .slice(0, parseInt(process.env.MAX_KEYWORDS_PER_ARTICLE || 25));
    
    console.log(`Would extract ${keywordsWithThreshold.length} keywords with current settings:`);
    console.log(keywordsWithThreshold.join(', '));

  } catch (error) {
    console.error('Error:', error);
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