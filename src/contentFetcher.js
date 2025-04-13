/**
 * Content Fetcher Module
 * 
 * This module is responsible for fetching HTML content from article URLs.
 * It handles HTTP requests, error handling, and rate limiting to avoid
 * overwhelming target servers.
 */

import axios from 'axios';
import { checkUrlExists } from './database.js';

// Configure axios defaults
const httpClient = axios.create({
  timeout: 15000, // 15 seconds timeout
  headers: {
    'User-Agent': 'NewsCollector/1.0.0 (https://github.com/yourusername/news-collector)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
  },
  maxRedirects: 5
});

/**
 * Fetch HTML content from a URL
 * @param {string} url - The URL to fetch content from
 * @param {number} retries - Number of retry attempts (default: 1)
 * @returns {Promise<Object>} - Object containing HTML content and metadata
 */
async function fetchContent(url, retries = 0) {
  try {
    // Check if the URL already exists in the database
    const exists = await checkUrlExists(url);
    if (exists) {
      console.log(`URL already exists in database, skipping fetch: ${url}`);
      return {
        url: url,
        html: null,
        statusCode: 304, // Not Modified
        skipped: true,
        fetchedAt: new Date().toISOString()
      };
    }
    
    console.log(`Fetching content from: ${url}`);
    
    // Make the HTTP request
    const response = await httpClient.get(url);
    
    return {
      url: response.request.res.responseUrl || url, // Final URL after redirects
      html: response.data,
      statusCode: response.status,
      headers: response.headers,
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    // Handle retries
    if (retries > 0) {
      console.warn(`Retry attempt for ${url}, ${retries} attempts remaining`);
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * (3 - retries)));
      return fetchContent(url, retries - 1);
    }
    
    console.error(`Error fetching content from ${url}:`, error.message);
    
    // Return partial data on error
    return {
      url: url,
      html: null,
      statusCode: error.response ? error.response.status : 0,
      error: error.message,
      fetchedAt: new Date().toISOString()
    };
  }
}

export {
  fetchContent
};
