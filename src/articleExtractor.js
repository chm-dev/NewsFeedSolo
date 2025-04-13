/**
 * Article Extractor Module
 * 
 * This module is responsible for extracting the main content from HTML pages.
 * It uses the @extractus/article-extractor package to identify and extract
 * the article content, removing ads, navigation, and other non-content elements.
 * It also converts the extracted HTML content to Markdown format.
 */

import { extract } from '@extractus/article-extractor';
import TurndownService from 'turndown';

// Initialize turndown for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  hr: '---'
});

/**
 * Convert HTML content to Markdown format
 * @param {string} htmlContent - HTML content to convert
 * @returns {string} - Markdown formatted content
 */
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

/**
 * Extract the main article content from HTML
 * @param {Object} article - Article object with content.html
 * @returns {Promise<Object>} - Article with extracted content added
 */
async function extractArticleContent(article) {
  try {
    // Skip if there's no HTML content
    if (!article.content || !article.content.html) {
      console.warn(`No HTML content to extract for article: ${article.title}`);
      return {
        ...article,
        extracted: {
          error: 'No HTML content available',
          extractedAt: new Date().toISOString()
        }
      };
    }

    console.log(`Extracting content from article: ${article.title}`);
    
    // Extract the article content
    const extracted = await extract(article.content.url, {
      html: article.content.html
    });
    
    // Convert HTML content to Markdown
    const markdownContent = convertToMarkdown(extracted.content);
    
    // Add extraction timestamp and include both HTML and Markdown content
    const extractedWithMeta = {
      ...extracted,
      content: extracted.content, // Original HTML content
      markdown: markdownContent,  // New Markdown content
      extractedAt: new Date().toISOString()
    };
    
    // Return the article with extracted content
    return {
      ...article,
      extracted: extractedWithMeta
    };
  } catch (error) {
    console.error(`Error extracting content for article ${article.title}:`, error.message);
    
    // Return the article with error information
    return {
      ...article,
      extracted: {
        error: error.message,
        extractedAt: new Date().toISOString()
      }
    };
  }
}

export {
  extractArticleContent,
  convertToMarkdown
};
