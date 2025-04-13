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
 * Build a user preference profile based on interactions with time decay
 * @returns {Object} - User preference profile with weighted keywords, categories, and sources
 */
function buildKeywordProfile() {
    console.log('Building user preference profile based on interactions...');
    
    if (!db) initializeDatabase();
    
    const profile = {
        keywords: new Map(),  // keyword -> weight
        sources: new Map(),   // source -> weight
        categories: new Map() // category -> weight
    };
    
    // Get all interactions with time decay, prioritizing more recent interactions
    const interactions = db.prepare(`
        SELECT 
            a.id, 
            a.keywords, 
            a.feed_title, 
            a.feed_category, 
            ai.interaction_type, 
            ai.created_at 
        FROM 
            article_interactions ai
        JOIN 
            articles a ON ai.article_id = a.id
    `).all();
    
    console.log(`Processing ${interactions.length} interactions for user profile...`);
    
    // Process each interaction
    interactions.forEach(interaction => {
        try {
            // Apply time decay - more recent interactions count more
            const interactionDate = new Date(interaction.created_at);
            const daysSinceInteraction = (Date.now() - interactionDate) / (1000 * 60 * 60 * 24);
            const decayFactor = Math.exp(-daysSinceInteraction / 30); // 30-day half-life
            
            // Set base weight based on interaction type
            let baseWeight = 0;
            switch (interaction.interaction_type) {
                case 'thumbs_up': baseWeight = 5.0; break;
                case 'thumbs_down': baseWeight = -3.0; break;
                case 'click': baseWeight = 1.0; break;
            }
            
            const weight = baseWeight * decayFactor;
            
            // Add source weight
            const sourceWeight = profile.sources.get(interaction.feed_title) || 0;
            profile.sources.set(interaction.feed_title, sourceWeight + weight);
            
            // Add category weight
            const categoryWeight = profile.categories.get(interaction.feed_category) || 0;
            profile.categories.set(interaction.feed_category, categoryWeight + weight);
            
            // Add keyword weights
            try {
                const keywords = JSON.parse(interaction.keywords || '[]');
                keywords.forEach(keyword => {
                    const keywordWeight = profile.keywords.get(keyword) || 0;
                    profile.keywords.set(keyword, keywordWeight + weight);
                });
            } catch (e) {
                console.error(`Error parsing keywords for article ${interaction.id}:`, e);
            }
        } catch (e) {
            console.error(`Error processing interaction for article ${interaction.id}:`, e);
        }
    });
    
    // Convert Maps to sorted arrays for easier handling and debugging
    const sortMapByWeight = map => 
        [...map.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([name, weight]) => ({ name, weight }));
    
    const result = {
        keywords: sortMapByWeight(profile.keywords),
        sources: sortMapByWeight(profile.sources),
        categories: sortMapByWeight(profile.categories)
    };
    
    // Log profile summary
    console.log('User profile built successfully:');
    console.log(`- ${result.keywords.length} keywords`);
    console.log(`- ${result.sources.length} sources`);
    console.log(`- ${result.categories.length} categories`);
    
    if (result.keywords.length > 0) {
        console.log('Top keywords:');
        result.keywords.slice(0, 5).forEach(k => 
            console.log(`  "${k.name}" (${k.weight.toFixed(2)})`));
    }
    
    if (result.categories.length > 0) {
        console.log('Category preferences:');
        result.categories.forEach(c => 
            console.log(`  "${c.name}" (${c.weight.toFixed(2)})`));
    }
    
    return result;
}

/**
 * Calculate similarity score between an article and user profile
 * @param {Object} article - The article to score
 * @param {Object} profile - User preference profile
 * @returns {Object} - Various component scores and total score
 */
function scoreArticle(article, profile) {
    if (!article || !profile) return { totalScore: 0 };
    
    // Create maps from arrays for faster lookups
    const keywordMap = new Map(profile.keywords.map(k => [k.name, k.weight]));
    const sourceMap = new Map(profile.sources.map(s => [s.name, s.weight]));
    const categoryMap = new Map(profile.categories.map(c => [c.name, c.weight]));
    
    // 1. Keyword score (40% of total)
    let keywordScore = 0;
    let keywordMatchCount = 0;
    try {
        const keywords = JSON.parse(article.keywords || '[]');
        keywords.forEach(keyword => {
            const weight = keywordMap.get(keyword) || 0;
            if (weight !== 0) keywordMatchCount++;
            keywordScore += weight;
        });
        
        // Normalize by keyword count to avoid favoring articles with many keywords
        if (keywords.length > 0) {
            keywordScore = keywordScore / Math.sqrt(keywords.length);
        }
    } catch (e) {
        console.error(`Error parsing keywords for article ${article.id}:`, e);
    }
    
    // 2. Source score (20% of total)
    const sourceScore = sourceMap.get(article.feed_title) || 0;
    
    // 3. Category score (20% of total)
    const categoryScore = categoryMap.get(article.feed_category) || 0;
    
    // 4. Recency score (20% of total)
    let recencyScore = 0;
    try {
        const publishDate = new Date(article.published_at);
        const daysSincePublished = (Date.now() - publishDate) / (1000 * 60 * 60 * 24);
        recencyScore = Math.exp(-daysSincePublished / 7); // 7-day half-life
    } catch (e) {
        console.error(`Error calculating recency for article ${article.id}:`, e);
    }
    
    // 5. Direct interaction score - applies only if this specific article has interactions
    let interactionScore = 0;
    try {
        if (article.direct_interaction_score) {
            interactionScore = article.direct_interaction_score;
        }
    } catch (e) {
        console.error(`Error getting interaction score for article ${article.id}:`, e);
    }
    
    // Calculate weighted total score
    const totalScore = (
        (keywordScore * 0.4) + 
        (sourceScore * 0.2) + 
        (categoryScore * 0.2) + 
        (recencyScore * 0.2) +
        interactionScore // Direct interactions get added directly
    );
    
    return {
        keywordScore,
        sourceScore,
        categoryScore,
        recencyScore,
        interactionScore,
        keywordMatchCount,
        totalScore
    };
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
        
        // Basic query to get articles with direct interaction scores
        const query = `
            SELECT 
                a.*,
                (
                    SELECT COALESCE(SUM(
                        CASE 
                            WHEN interaction_type = 'thumbs_up' THEN 5.0 * EXP(-(julianday('now') - julianday(created_at))/30.0)
                            WHEN interaction_type = 'thumbs_down' THEN -3.0 * EXP(-(julianday('now') - julianday(created_at))/30.0)
                            WHEN interaction_type = 'click' THEN 1.0 * EXP(-(julianday('now') - julianday(created_at))/30.0)
                            ELSE 0 
                        END
                    ), 0)
                    FROM article_interactions ai
                    WHERE ai.article_id = a.id
                ) as direct_interaction_score
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
        
        // Finalize the query with sorting and pagination
        const sortField = options.sort === 'published_at' ? 'published_at' : 'stored_at';
        const finalQuery = query + whereClause + ` ORDER BY ${sortField} DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        console.log('Executing article query...');
        
        // Execute the query
        const stmt = db.prepare(finalQuery);
        const results = stmt.all(...params);
        
        console.log(`Retrieved ${results.length} articles`);
        
        // If we're not doing recommendations, just return the sorted articles
        if (!options.recommend) {
            return results;
        }
        
        // For recommendations, apply the keyword profile scoring
        const profile = buildKeywordProfile();
        
        // Score each article based on user profile
        const scoredArticles = results.map(article => {
            const scores = scoreArticle(article, profile);
            return {
                ...article,
                keyword_score: scores.keywordScore,
                source_score: scores.sourceScore,
                category_score: scores.categoryScore,
                recency_score: scores.recencyScore,
                final_score: scores.totalScore
            };
        });
        
        // Sort by final score for recommendations
        scoredArticles.sort((a, b) => b.final_score - a.final_score);
        
        // Log some scoring details for debugging
        if (scoredArticles.length > 0) {
            console.log('Sample scores for first few articles:');
            scoredArticles.slice(0, 3).forEach(article => {
                console.log(`Article "${article.title}": Final Score ${article.final_score.toFixed(2)} (Keyword: ${article.keyword_score.toFixed(2)}, Source: ${article.source_score.toFixed(2)}, Category: ${article.category_score.toFixed(2)}, Recency: ${article.recency_score.toFixed(2)}, Direct: ${article.direct_interaction_score})`);
            });
        }
        
        return scoredArticles;
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
        
        // Build user profile from interactions
        const profile = buildKeywordProfile();
        if (!profile || profile.keywords.length === 0) {
            console.log('No user profile or empty profile, falling back to recency-based recommendations');
            // If no profile, return recent articles
            const stmt = db.prepare(`
                SELECT * FROM articles 
                ORDER BY published_at DESC 
                LIMIT ? OFFSET ?
            `);
            return stmt.all(limit, offset);
        }
        
        console.log('Getting articles for recommendation scoring...');
        
        // Get articles from the last 14 days for scoring
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        
        const articles = db.prepare(`
            SELECT 
                a.*,
                (
                    SELECT COALESCE(SUM(
                        CASE 
                            WHEN interaction_type = 'thumbs_up' THEN 5.0 * EXP(-(julianday('now') - julianday(created_at))/30.0)
                            WHEN interaction_type = 'thumbs_down' THEN -3.0 * EXP(-(julianday('now') - julianday(created_at))/30.0)
                            WHEN interaction_type = 'click' THEN 1.0 * EXP(-(julianday('now') - julianday(created_at))/30.0)
                            ELSE 0 
                        END
                    ), 0)
                    FROM article_interactions ai
                    WHERE ai.article_id = a.id
                ) as direct_interaction_score
            FROM articles a
            WHERE a.published_at > ?
            ORDER BY a.published_at DESC
        `).all(twoWeeksAgo.toISOString());
        
        console.log(`Retrieved ${articles.length} articles for scoring`);
        
        // Score each article using the user profile
        const scoredArticles = articles.map(article => {
            const scores = scoreArticle(article, profile);
            return {
                ...article,
                keyword_score: scores.keywordScore,
                source_score: scores.sourceScore,
                category_score: scores.categoryScore,
                recency_score: scores.recencyScore,
                interaction_score: scores.interactionScore,
                keywordMatchCount: scores.keywordMatchCount,
                final_score: scores.totalScore
            };
        });
        
        // Sort by final score for recommendations
        scoredArticles.sort((a, b) => b.final_score - a.final_score);
        
        // Apply pagination
        const paginatedResults = scoredArticles.slice(offset, offset + limit);
        
        // Log some scoring details for debugging
        if (paginatedResults.length > 0) {
            console.log('Sample scores for first few recommended articles:');
            paginatedResults.slice(0, 3).forEach(article => {
                console.log(`Article ${article.id} "${article.title}": Final Score ${article.final_score.toFixed(2)} (Keyword: ${article.keyword_score.toFixed(2)}, Category: ${article.category_score.toFixed(2)}, Source: ${article.source_score.toFixed(2)}, Recency: ${article.recency_score.toFixed(2)}, Direct: ${article.direct_interaction_score || 0})`);
            });
        }

        return paginatedResults;
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
 * Find similar articles based on keyword overlap
 * @param {number} articleId - ID of the source article
 * @param {number} limit - Maximum number of similar articles to return
 * @returns {Array} - Array of similar articles
 */
function getSimilarArticles(articleId, limit = 5) {
    try {
        console.log(`Finding similar articles to article ${articleId}...`);
        
        if (!db) {
            console.log('Initializing database...');
            initializeDatabase();
        }

        // Get the source article
        const sourceArticle = db.prepare('SELECT id, keywords, feed_category FROM articles WHERE id = ?').get(articleId);
        if (!sourceArticle) {
            console.error(`Article ${articleId} not found`);
            return [];
        }

        // Parse keywords
        let sourceKeywords = [];
        try {
            sourceKeywords = JSON.parse(sourceArticle.keywords || '[]');
        } catch (e) {
            console.error(`Error parsing keywords for article ${articleId}:`, e);
        }

        if (sourceKeywords.length === 0) {
            console.log(`No keywords found for article ${articleId}`);
            return [];
        }

        // Get articles with matching keywords (excluding the source article)
        // This is a simple SQL solution that doesn't require complex JSON parsing in the query
        const articleCandidates = db.prepare(`
            SELECT 
                a.*,
                (
                    SELECT COALESCE(SUM(
                        CASE 
                            WHEN interaction_type = 'thumbs_up' THEN 5.0
                            WHEN interaction_type = 'click' THEN 1.0
                            WHEN interaction_type = 'thumbs_down' THEN -3.0
                            ELSE 0 
                        END
                    ), 0)
                    FROM article_interactions ai
                    WHERE ai.article_id = a.id
                ) as interaction_score
            FROM articles a
            WHERE 
                a.id != ? AND
                a.feed_category = ? AND
                a.published_at > datetime('now', '-14 day')
            ORDER BY published_at DESC
            LIMIT 100
        `).all(articleId, sourceArticle.feed_category);

        console.log(`Found ${articleCandidates.length} candidate articles for similarity comparison`);

        // Calculate similarity score for each candidate
        const scoredArticles = articleCandidates.map(article => {
            let targetKeywords = [];
            try {
                targetKeywords = JSON.parse(article.keywords || '[]');
            } catch (e) {
                console.error(`Error parsing keywords for article ${article.id}:`, e);
            }

            // Count matching keywords
            const matchingKeywords = sourceKeywords.filter(keyword => 
                targetKeywords.includes(keyword)
            );

            // Calculate similarity score
            const similarityScore = matchingKeywords.length / 
                Math.sqrt(sourceKeywords.length * Math.max(targetKeywords.length, 1));

            return {
                ...article,
                similarity_score: similarityScore,
                matching_keywords: matchingKeywords,
                // Combined score includes similarity and direct interaction
                combined_score: similarityScore + (article.interaction_score * 0.1)
            };
        });

        // Filter articles with at least one matching keyword and sort by score
        const results = scoredArticles
            .filter(article => article.matching_keywords.length > 0)
            .sort((a, b) => b.combined_score - a.combined_score)
            .slice(0, limit);

        console.log(`Found ${results.length} similar articles`);
        
        return results;
    } catch (error) {
        console.error('Error finding similar articles:', error);
        return [];
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
    checkUrlExists,
    buildKeywordProfile,
    scoreArticle,
    getSimilarArticles
};
