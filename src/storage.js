/**
 * Storage Module
 * 
 * This module is responsible for storing and retrieving article data.
 * It uses SQLite database for storage.
 */

import path from 'path';
import { storeArticle as dbStoreArticle, createMetadata, initializeDatabase } from './database.js';

// Base storage directory - kept for backward compatibility when forming paths
export const STORAGE_DIR = path.join(process.cwd(), 'storage');

// Initialize database
initializeDatabase();

/**
 * Store an article to the database
 * @param {Object} article - Article object to store
 * @returns {Promise<Object>} - Result with status and path
 */
export async function storeArticle(article) {
    // Store in database
    const result = dbStoreArticle(article);
    
    if (!result.success) {
        return result;
    }

    // For backward compatibility, create a virtual path
    const category = article.feedCategory || 'uncategorized';
    const dateStr = new Date().toISOString().split('T')[0];
    const feedDir = article.feedTitle
        ? article.feedTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
        : 'unknown-source';
    
    const filename = `${article.guid || article.title || 'untitled'}`
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 100);
    
    const virtualPath = path.join(STORAGE_DIR, category, dateStr, feedDir, `${filename}-${Date.now()}.json`);

    return {
        success: true,
        path: virtualPath,
        article: {
            ...article,
            _storage: {
                storedAt: new Date().toISOString(),
                path: virtualPath,
                id: result.id
            }
        }
    };
}

/**
 * Create a metadata record for a batch of articles
 * @param {string} category - Category name
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {Array} results - Array of storage results
 * @returns {Promise<Object>} - Result with status
 */
export async function createMetadataFile(category, dateStr, results) {
    try {
        // Get metadata from database
        const dbMetadata = createMetadata(category, dateStr);
        
        if (!dbMetadata.success) {
            throw new Error(dbMetadata.error);
        }

        return {
            success: true,
            metadata: dbMetadata.metadata
        };
    } catch (error) {
        console.error(`Error creating metadata:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}
