/**
 * Storage Module
 * 
 * This module is responsible for storing and retrieving article data.
 * It uses SQLite database for storage while maintaining compatibility
 * with the existing API.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { storeArticle as dbStoreArticle, createMetadata, initializeDatabase } from './database.js';

// Base storage directory
export const STORAGE_DIR = path.join(process.cwd(), 'storage');

// Initialize database
initializeDatabase();

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dirPath - Path to the directory
 * @returns {Promise<void>}
 */
export async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

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
 * Create a metadata file for a batch of articles
 * @param {string} category - Category name
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {Array} results - Array of storage results
 * @returns {Promise<Object>} - Result with status and path
 */
export async function createMetadataFile(category, dateStr, results) {
    try {
        // Get metadata from database
        const dbMetadata = createMetadata(category, dateStr);
        
        if (!dbMetadata.success) {
            throw new Error(dbMetadata.error);
        }

        // Create the metadata directory for backward compatibility
        const metadataDir = path.join(STORAGE_DIR, category, dateStr);
        await ensureDir(metadataDir);

        // Create the metadata content
        const metadata = {
            ...dbMetadata.metadata,
            articles: results.map(r => ({
                title: r.article.title,
                source: r.article.feedTitle,
                success: r.success,
                path: r.success ? r.path : null,
                error: r.error || null
            }))
        };

        // Write the metadata file for backward compatibility
        const metadataPath = path.join(metadataDir, 'metadata.json');
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        return {
            success: true,
            path: metadataPath
        };
    } catch (error) {
        console.error(`Error creating metadata file:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}
