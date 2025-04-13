/**
 * Database Module
 * 
 * This module handles all database operations using SQLite.
 * It provides an interface for storing and retrieving articles.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { promises as fs } from 'fs';
import { extractArticleKeywords } from './keywordExtractor.js';

const DB_FILE = path.join(process.cwd(), 'storage', 'news.db');

let db;

/**
 * Convert RFC 822 date format to ISO 8601
 * @param {string} dateStr - Date string in RFC 822 format
 * @returns {string} - Date in ISO 8601 format
 */
function normalizeDate(dateStr) {
    if (!dateStr) return null;
    try {
        return new Date(dateStr).toISOString();
    } catch (error) {
        console.error(`Error normalizing date ${dateStr}:`, error);
        return null;
    }
}

/**
 * Initialize the database connection and create tables if they don't exist
 */
async function initializeDatabase() {
    // Ensure storage directory exists
    const dbDir = path.dirname(DB_FILE);
    await fs.mkdir(dbDir, { recursive: true });
    
    db = new Database(DB_FILE);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create articles table with normalized datetime fields
    db.exec(`
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guid TEXT UNIQUE,
            title TEXT NOT NULL,
            link TEXT,
            description TEXT,
            content TEXT,
            extracted_content TEXT,
            image_url TEXT,
            feed_title TEXT NOT NULL,
            feed_url TEXT,
            feed_category TEXT NOT NULL,
            published_at TEXT,  -- Store in ISO 8601 format
            author TEXT,
            stored_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),  -- Store in ISO 8601 format
            metadata JSON,
            keywords JSON,
            topic_indices JSON,  -- Array of relevant topic indices
            topic_scores JSON    -- Array of topic relevance scores
        );

        CREATE TABLE IF NOT EXISTS topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            terms JSON NOT NULL,         -- Array of {term, probability} objects
            created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
            active BOOLEAN DEFAULT 1     -- Flag to mark current active topic set
        );

        CREATE TABLE IF NOT EXISTS article_interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER NOT NULL,
            interaction_type TEXT NOT NULL, -- 'click', 'thumbs_up', 'thumbs_down'
            created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
            FOREIGN KEY(article_id) REFERENCES articles(id)
        );

        CREATE INDEX IF NOT EXISTS idx_articles_feed ON articles(feed_title, published_at);
        CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(feed_category, published_at);
        CREATE INDEX IF NOT EXISTS idx_articles_stored ON articles(stored_at);
        CREATE INDEX IF NOT EXISTS idx_article_interactions ON article_interactions(article_id, interaction_type);
        CREATE INDEX IF NOT EXISTS idx_articles_keywords ON articles(keywords);
        CREATE INDEX IF NOT EXISTS idx_topics_active ON topics(active);
    `);

    return db;
}

/**
 * Store an article in the database
 * @param {Object} article - Article object to store
 * @returns {Promise<Object>} - Result with status and article id
 */
async function storeArticle(article) {
    try {
        if (!db) initializeDatabase();

        const stmt = db.prepare(`
            INSERT INTO articles (
                guid, title, link, description, content, extracted_content,
                image_url, feed_title, feed_url, feed_category, published_at, 
                author, metadata, keywords
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        `);

        // Get image URL from extracted data if available
        const imageUrl = article.extracted?.image || null;

        // Normalize the published date to ISO 8601
        const publishedAt = normalizeDate(article.pubDate);

        // Extract keywords from article content (now async)
        const keywords = await extractArticleKeywords(article);

        const result = stmt.run(
            article.guid || null,
            article.title,
            article.link || null,
            article.description || null,
            article.content?.text || null,
            article.extracted?.markdown || article.extracted?.content || null, // Store markdown if available, fallback to HTML
            imageUrl,
            article.feedTitle,
            article.feedUrl || null,
            article.feedCategory,
            publishedAt,
            article.author || null,
            JSON.stringify(article._storage || {}),
            JSON.stringify(keywords)
        );

        return {
            success: true,
            id: result.lastInsertRowid,
            article: {
                ...article,
                keywords
            }
        };
    } catch (error) {
        console.error(`Error storing article ${article.title}:`, error);
        return {
            success: false,
            error: error.message,
            article
        };
    }
}

/**
 * Create a summary of articles stored in a specific time period
 * @param {string} category - Category name
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @returns {Object} - Metadata about stored articles
 */
function createMetadata(category, dateStr) {
    try {
        if (!db) initializeDatabase();

        const startDate = new Date(dateStr);
        const endDate = new Date(dateStr);
        endDate.setDate(endDate.getDate() + 1);

        const results = db.prepare(`
            SELECT 
                COUNT(*) as totalArticles,
                COUNT(DISTINCT feed_title) as sourceCount,
                GROUP_CONCAT(DISTINCT feed_title) as sources
            FROM articles 
            WHERE feed_category = ? 
            AND stored_at >= ? 
            AND stored_at < ?
        `).get(category, startDate.toISOString(), endDate.toISOString());

        return {
            success: true,
            metadata: {
                category,
                date: dateStr,
                createdAt: new Date().toISOString(),
                totalArticles: results.totalArticles,
                sourceCount: results.sourceCount,
                sources: results.sources ? results.sources.split(',') : []
            }
        };
    } catch (error) {
        console.error(`Error creating metadata:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get articles with optional filtering
 * @param {Object} options - Filter options (category, feedTitle, dateFrom, dateTo, limit, offset, sort)
 * @returns {Array} - Array of articles
 */
async function getArticles(options = {}) {
    try {
        console.log('Getting articles with options:', JSON.stringify(options));
        
        if (!db) {
            console.log('Initializing database...');
            await initializeDatabase();
        }

        // Set a reasonable default limit to prevent performance issues
        const limit = options.limit ? parseInt(options.limit) : 50;
        const offset = options.offset ? parseInt(options.offset) : 0;
        
        // Check if topic_indices column exists
        let hasTopicColumns = false;
        try {
            // Query the table info to check if the columns exist
            const tableInfo = db.prepare("PRAGMA table_info(articles)").all();
            const columnNames = tableInfo.map(col => col.name);
            hasTopicColumns = columnNames.includes('topic_indices') && columnNames.includes('topic_scores');
            console.log('Table columns:', columnNames);
            console.log('Has topic columns:', hasTopicColumns);
        } catch (err) {
            console.error('Error checking table schema:', err);
            hasTopicColumns = false;
        }
        
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        
        // Use the same weighted score calculation as in getRecommendedArticles
        const query = `
            WITH topic_weights AS (
                -- Calculate weights for each topic based on interactions
                SELECT 
                    json_each.value as topic_id,
                    SUM(CASE 
                        WHEN i.interaction_type = 'thumbs_up' THEN 5.0
                        WHEN i.interaction_type = 'thumbs_down' THEN -3.0
                        WHEN i.interaction_type = 'click' THEN 1.0
                        ELSE 0 
                    END) as interaction_weight
                FROM articles a
                CROSS JOIN json_each(a.topic_indices)
                LEFT JOIN article_interactions i ON a.id = i.article_id
                GROUP BY json_each.value
            ),
            article_scores AS (
                -- Calculate score for each article based on its topics and their weights
                SELECT 
                    a.*,
                    COALESCE(
                        (
                            SELECT SUM(
                                CASE 
                                    WHEN tw.interaction_weight > 0 
                                    THEN tw.interaction_weight * CAST(json_extract(s.value, '$.score') AS FLOAT)
                                    ELSE tw.interaction_weight * (1 - CAST(json_extract(s.value, '$.score') AS FLOAT))
                                END
                            )
                            FROM json_each(a.topic_indices) ti
                            LEFT JOIN json_each(a.topic_scores) s 
                            LEFT JOIN topic_weights tw ON ti.value = tw.topic_id
                            WHERE tw.interaction_weight IS NOT NULL
                        ),
                        0
                    ) as topic_score,
                    (
                        SELECT COALESCE(SUM(
                            CASE 
                                WHEN interaction_type = 'thumbs_up' THEN 5
                                WHEN interaction_type = 'click' THEN 1
                                WHEN interaction_type = 'thumbs_down' THEN -3
                                ELSE 0
                            END
                        ), 0)
                        FROM article_interactions ai
                        WHERE ai.article_id = a.id
                    ) as direct_interaction_score,
                    datetime(a.published_at) as published_at_normalized,
                    datetime(a.stored_at) as stored_at_normalized
                FROM articles a
                WHERE 1=1
        `;

        // Add WHERE clause conditions
        let whereClause = '';
        const params = [];
        
        if (options.category) {
            whereClause += ' AND a.feed_category = ?';
            params.push(options.category);
        }

        if (options.feedTitle) {
            whereClause += ' AND a.feed_title = ?';
            params.push(options.feedTitle);
        }

        if (options.dateFrom) {
            whereClause += ' AND a.stored_at >= ?';
            params.push(new Date(options.dateFrom).toISOString());
        }

        if (options.dateTo) {
            whereClause += ' AND a.stored_at < ?';
            params.push(new Date(options.dateTo).toISOString());
        }
        
        const fullQuery = query + whereClause + ')'
        + `
            -- Final selection with combined scoring
            SELECT 
                *,
                COALESCE(topic_score, 0) + COALESCE(direct_interaction_score, 0) as final_score
            FROM article_scores
        `;
        
        // Handle sorting
        const sortField = options.sort === 'published_at' ? 'published_at_normalized' : 'stored_at_normalized';
        const sortQuery = fullQuery + ` ORDER BY ${sortField} DESC LIMIT ? OFFSET ?`;
        
        params.push(limit, offset);

        console.log('Executing query with weighted scoring...');
        
        // Execute the query
        const stmt = db.prepare(sortQuery);
        const results = stmt.all(...params);
        
        console.log(`Retrieved ${results.length} articles with weighted scores`);
        
        // Log some scoring details for debugging
        if (results.length > 0) {
            console.log('Sample scores for first few articles:');
            results.slice(0, 3).forEach(article => {
                console.log(`Article "${article.title}": Score ${article.final_score} (Topic: ${article.topic_score}, Direct: ${article.direct_interaction_score})`);
            });
        }
        
        return results;
    } catch (error) {
        console.error('Error fetching articles:', error);
        // Return an empty array in case of error
        return [];
    }
}

/**
 * Track user interaction with an article
 * @param {number} articleId - ID of the article
 * @param {string} type - Type of interaction ('click', 'thumbs_up', 'thumbs_down')
 */
function trackInteraction(articleId, type) {
    try {
        if (!db) initializeDatabase();
        
        const stmt = db.prepare(`
            INSERT INTO article_interactions (article_id, interaction_type)
            VALUES (?, ?)
        `);
        
        stmt.run(articleId, type);
        return { success: true };
    } catch (error) {
        console.error('Error tracking interaction:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get personalized article recommendations
 * @param {Object} options - Filter options (limit, offset)
 * @returns {Array} - Array of recommended articles
 */
function getRecommendedArticles(options = {}) {
    try {
        console.log('Getting recommended articles with options:', JSON.stringify(options));
        
        if (!db) {
            console.log('Initializing database for recommendations...');
            initializeDatabase();
        }

        const limit = options.limit ? parseInt(options.limit) : 30;
        const offset = options.offset ? parseInt(options.offset) : 0;
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        // First, calculate topic weights based on user interactions
        const query = `
            WITH topic_weights AS (
                -- Calculate weights for each topic based on interactions
                SELECT 
                    json_each.value as topic_id,
                    SUM(CASE 
                        WHEN i.interaction_type = 'thumbs_up' THEN 5.0
                        WHEN i.interaction_type = 'thumbs_down' THEN -3.0
                        WHEN i.interaction_type = 'click' THEN 1.0
                        ELSE 0 
                    END) as interaction_weight
                FROM articles a
                CROSS JOIN json_each(a.topic_indices)
                LEFT JOIN article_interactions i ON a.id = i.article_id
                WHERE a.stored_at >= ?
                GROUP BY json_each.value
            ),
            article_scores AS (
                -- Calculate score for each article based on its topics and their weights
                SELECT 
                    a.*,
                    COALESCE(
                        (
                            SELECT SUM(
                                CASE 
                                    WHEN tw.interaction_weight > 0 
                                    THEN tw.interaction_weight * CAST(json_extract(s.value, '$.score') AS FLOAT)
                                    ELSE tw.interaction_weight * (1 - CAST(json_extract(s.value, '$.score') AS FLOAT))
                                END
                            )
                            FROM json_each(a.topic_indices) ti
                            LEFT JOIN json_each(a.topic_scores) s
                            LEFT JOIN topic_weights tw ON ti.value = tw.topic_id
                            WHERE tw.interaction_weight IS NOT NULL
                        ),
                        0
                    ) as topic_score,
                    (
                        SELECT COUNT(*) * 
                        CASE 
                            WHEN interaction_type = 'thumbs_up' THEN 5
                            WHEN interaction_type = 'click' THEN 1
                            WHEN interaction_type = 'thumbs_down' THEN -3
                            ELSE 0
                        END
                        FROM article_interactions ai
                        WHERE ai.article_id = a.id
                    ) as direct_interaction_score
                FROM articles a
                WHERE a.stored_at >= ?
            )
            -- Final selection with combined scoring
            SELECT 
                *,
                COALESCE(topic_score, 0) + COALESCE(direct_interaction_score, 0) as final_score
            FROM article_scores
            ORDER BY final_score DESC, published_at DESC
            LIMIT ? OFFSET ?
        `;

        console.log('Executing recommendations query with scoring...');
        
        const stmt = db.prepare(query);
        const results = stmt.all(
            threeDaysAgo.toISOString(),
            threeDaysAgo.toISOString(),
            limit,
            offset
        );

        console.log(`Retrieved ${results.length} recommended articles with scores`);
        
        // Log some scoring details for debugging
        if (results.length > 0) {
            console.log('Sample scores for first few articles:');
            results.slice(0, 3).forEach(article => {
                console.log(`Article "${article.title}": Score ${article.final_score} (Topic: ${article.topic_score}, Direct: ${article.direct_interaction_score})`);
            });
        }

        return results;
    } catch (error) {
        console.error('Error getting recommended articles:', error);
        return [];
    }
}

/**
 * Store topics extracted from articles
 * @param {Array} topics - Array of topics with their terms and probabilities
 * @returns {Object} - Result with status and topic ids
 */
function storeTopics(topics) {
    try {
        if (!db) initializeDatabase();

        // Deactivate old topics
        db.prepare('UPDATE topics SET active = 0').run();

        // Store new topics
        const stmt = db.prepare('INSERT INTO topics (terms) VALUES (?)');
        
        const results = topics.map(topic => {
            const result = stmt.run(JSON.stringify(topic));
            return result.lastInsertRowid;
        });

        return {
            success: true,
            topicIds: results
        };
    } catch (error) {
        console.error('Error storing topics:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Update article's topic relationships
 * @param {number} articleId - ID of the article
 * @param {Array} topicIndices - Array of relevant topic indices
 * @param {Array} topicScores - Array of topic relevance scores
 * @returns {Object} - Result with status
 */
function updateArticleTopics(articleId, topicIndices, topicScores) {
    try {
        if (!db) initializeDatabase();
        
        // Check if topic_indices column exists
        let hasTopicColumns = false;
        try {
            const tableInfo = db.prepare("PRAGMA table_info(articles)").all();
            const columnNames = tableInfo.map(col => col.name);
            hasTopicColumns = columnNames.includes('topic_indices') && columnNames.includes('topic_scores');
    
        } catch (err) {
            console.error('Error checking table schema for topic update:', err);
            hasTopicColumns = false;
        }
        
        // If the columns don't exist, add them
        if (!hasTopicColumns) {
            try {
                db.exec(`
                    ALTER TABLE articles ADD COLUMN topic_indices JSON;
                    ALTER TABLE articles ADD COLUMN topic_scores JSON;
                `);
                console.log('Topic columns added successfully');
                hasTopicColumns = true;
            } catch (err) {
                console.error('Error adding topic columns:', err);
                return {
                    success: false,
                    error: 'Failed to add topic columns: ' + err.message
                };
            }
        }

        // Now update the article with topic information
        // Use the topic indices directly without mapping to IDs
        const stmt = db.prepare(`
            UPDATE articles 
            SET topic_indices = ?, topic_scores = ?
            WHERE id = ?
        `);

        stmt.run(
            JSON.stringify(topicIndices),
            JSON.stringify(topicScores),
            articleId
        );

        return { success: true };
    } catch (error) {
        console.error('Error updating article topics:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get current active topics
 * @returns {Array} - Array of active topics
 */
function getActiveTopics() {
    try {
        console.log('Getting active topics...');
        
        if (!db) {
            console.log('Initializing database for active topics...');
            initializeDatabase();
        }
        
        // Use a simpler query that's less likely to hang
        const stmt = db.prepare('SELECT id, terms, created_at FROM topics WHERE active = 1 LIMIT 20');
        const results = stmt.all();
        
        console.log(`Retrieved ${results.length} active topics`);
        return results;
    } catch (error) {
        console.error('Error getting active topics:', error);
        return [];
    }
}

/**
 * Check if an article with the given URL already exists in the database
 * @param {string} url - URL to check (will match against guid or link fields)
 * @returns {Promise<boolean>} - True if the URL exists, false otherwise
 */
async function checkUrlExists(url) {
    try {
        if (!db) {
            console.log('Initializing database for URL check...');
            await initializeDatabase();
        }
        
        // Check against both guid and link fields to ensure we catch all duplicates
        const stmt = db.prepare('SELECT COUNT(*) as count FROM articles WHERE guid = ? OR link = ?');
        const result = stmt.get(url, url);
        
        return result.count > 0;
    } catch (error) {
        console.error('Error checking URL existence:', error);
        return false;
    }
}

/**
 * Close the database connection
 */
function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}

export {
    initializeDatabase,
    storeArticle,
    createMetadata,
    getArticles,
    closeDatabase,
    trackInteraction,
    getRecommendedArticles,
    storeTopics,
    updateArticleTopics,
    getActiveTopics,
    checkUrlExists
};
