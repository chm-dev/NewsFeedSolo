/**
 * API Server Module
 * 
 * This module provides the HTTP API for accessing articles
 */

import express from 'express';
import cors from 'cors';
import { 
    getArticles, 
    getRecommendedArticles, 
    trackInteraction, 
    buildKeywordProfile,
    getSimilarArticles 
} from './database.js';
import Database from 'better-sqlite3';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;
const DB_FILE = path.join(process.cwd(), 'storage', 'news.db');
const db = new Database(DB_FILE);

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Get articles with optional filtering
app.get('/api/articles', async (req, res) => {
    try {
        const { category, feedTitle, dateFrom, dateTo, limit = 50, offset = 0, sort = 'stored_at' } = req.query;
        const articles = await getArticles({ 
            category, 
            feedTitle, 
            dateFrom, 
            dateTo, 
            limit: parseInt(limit), 
            offset: parseInt(offset),
            sort
        });
        res.json(articles);
    } catch (error) {
        console.error('Error fetching articles:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a specific article by ID and increment view count
app.get('/api/articles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get the article
        const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
        
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        
        // Increment the view count
        db.prepare('UPDATE articles SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?').run(id);
        
        // Return the article with the updated view count
        article.view_count = (article.view_count || 0) + 1;
        
        res.json(article);
    } catch (error) {
        console.error(`Error fetching article ${req.params.id}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get available categories
app.get('/api/categories', async (req, res) => {
    try {
        const articles = await getArticles();
        const categoriesFromArticles = [...new Set(articles.map(article => article.feed_category))];
        
        // Ensure both 'diy' and 'development' categories are always included
        const requiredCategories = ['diy', 'development'];
        const categories = [...new Set([...requiredCategories, ...categoriesFromArticles])];
        
        console.log('Available categories:', categories);
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get personalized article recommendations
app.get('/api/recommendations', async (req, res) => {
    try {
        const { limit = 30, offset = 0 } = req.query;
        const articles = await getRecommendedArticles({
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        // Track view counts for all articles in the response
        if (articles && articles.length > 0) {
            const updateViewCountStmt = db.prepare('UPDATE articles SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?');
            
            const updateTransaction = db.transaction((articleIds) => {
                for (const id of articleIds) {
                    updateViewCountStmt.run(id);
                }
            });
            
            // Execute the updates in a transaction for better performance
            updateTransaction(articles.map(article => article.id));
            
            // Update the view counts in the response objects
            articles.forEach(article => {
                article.view_count = (article.view_count || 0) + 1;
            });
        }
        
        res.json(articles);
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get similar articles
app.get('/api/articles/:id/similar', async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 5 } = req.query;
        
        const similarArticles = await getSimilarArticles(
            parseInt(id),
            parseInt(limit)
        );
        
        // Track view counts for all articles in the response
        if (similarArticles && similarArticles.length > 0) {
            const updateViewCountStmt = db.prepare('UPDATE articles SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?');
            
            const updateTransaction = db.transaction((articleIds) => {
                for (const id of articleIds) {
                    updateViewCountStmt.run(id);
                }
            });
            
            // Execute the updates in a transaction for better performance
            updateTransaction(similarArticles.map(article => article.id));
            
            // Update the view counts in the response objects
            similarArticles.forEach(article => {
                article.view_count = (article.view_count || 0) + 1;
            });
        }
        
        res.json(similarArticles);
    } catch (error) {
        console.error('Error fetching similar articles:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Track article interaction
app.post('/api/articles/:id/interaction', async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body;
        
        if (!['click', 'thumbs_up', 'thumbs_down'].includes(type)) {
            return res.status(400).json({ error: 'Invalid interaction type' });
        }
        
        const result = await trackInteraction(parseInt(id), type);
        
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking interaction:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user preference profile
app.get('/api/profile', (req, res) => {
    try {
        const profile = buildKeywordProfile();
        res.json(profile);
    } catch (error) {
        console.error('Error building user profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Get system stats
app.get('/api/admin/stats', async (req, res) => {
    try {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const recentArticles = await getArticles({ 
            dateFrom: threeDaysAgo.toISOString() 
        });

        const interactions = db.prepare(`
            SELECT 
                interaction_type,
                COUNT(*) as count,
                COUNT(DISTINCT article_id) as unique_articles
            FROM article_interactions
            WHERE created_at >= ?
            GROUP BY interaction_type
        `).all(threeDaysAgo.toISOString());

        const profile = buildKeywordProfile();

        res.json({
            recentArticlesCount: recentArticles.length,
            interactions,
            profile: {
                keywordCount: profile.keywords.length,
                keywords: profile.keywords,     
                categoryPreferences: profile.categories             
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`API server running at http://localhost:${port}`);
});
