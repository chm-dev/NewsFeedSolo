/**
 * API Server Module
 * 
 * This module provides the HTTP API for accessing articles
 */

import express from 'express';
import cors from 'cors';
import { getArticles, getRecommendedArticles, trackInteraction, getActiveTopics } from './database.js';
import { updateTopicModel } from './topicAnalyzer.js';
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

// Get recommended articles
app.get('/api/recommendations', async (req, res) => {
    try {
        const { limit = 30, offset = 0 } = req.query;
        const articles = await getRecommendedArticles({
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        res.json(articles);
    } catch (error) {
        console.error('Error fetching recommendations:', error);
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

// Get topics
app.get('/api/topics', async (req, res) => {
    try {
        const topics = getActiveTopics();
        res.json(topics);
    } catch (error) {
        console.error('Error fetching topics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Get current topics
app.get('/api/admin/topics', async (req, res) => {
    try {
        const topics = await getActiveTopics();
        res.json(topics);
    } catch (error) {
        console.error('Error fetching topics:', error);
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

        res.json({
            recentArticlesCount: recentArticles.length,
            interactions
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Get topic weights
app.get('/api/admin/topic-weights', async (req, res) => {
    try {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const weights = db.prepare(`
            WITH RECURSIVE
            article_topics AS (
                -- Extract topic IDs and articles they belong to, along with their scores
                SELECT 
                    a.id as article_id,
                    CAST(json_each.value AS INTEGER) as topic_id,
                    CAST(json_extract(json_each2.value, '$.score') AS FLOAT) as topic_score
                FROM articles a
                CROSS JOIN json_each(a.topic_indices) as json_each
                JOIN json_each(a.topic_scores) as json_each2
                WHERE a.stored_at >= ?
                AND json_each.key = json_each2.key  -- Ensure we match the correct score with each topic
            ),
            topic_weights AS (
                -- Calculate weights for each topic based on interactions, weighted by topic relevance
                SELECT 
                    at.topic_id,
                    SUM(
                        at.topic_score * 
                        CASE 
                            WHEN i.interaction_type = 'thumbs_up' THEN 5.0
                            WHEN i.interaction_type = 'thumbs_down' THEN -3.0
                            WHEN i.interaction_type = 'click' THEN 1.0
                            ELSE 0 
                        END
                    ) as weight
                FROM article_topics at
                LEFT JOIN article_interactions i ON at.article_id = i.article_id
                GROUP BY at.topic_id
            )
            -- Get weights for all active topics, defaulting to 0 for topics without interactions
            SELECT t.id as topic_id, COALESCE(tw.weight, 0) as weight
            FROM topics t
            LEFT JOIN topic_weights tw ON t.id = tw.topic_id
            WHERE t.active = 1
        `).all(threeDaysAgo.toISOString());

        // Convert to object for easier lookup in frontend
        const weightMap = Object.fromEntries(
            weights.map(w => [w.topic_id, w.weight])
        );
        
        res.json(weightMap);
    } catch (error) {
        console.error('Error fetching topic weights:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the server and initialize topic analysis
app.listen(port, () => {
    console.log(`API server running at http://localhost:${port}`);
    // Start topic analysis with a delay to avoid blocking API responses
    setTimeout(() => {
        console.log('Starting topic analysis...');
        updateTopicModel().catch(err => {
            console.error('Error in topic analysis:', err);
        });
    }, 5000); // 5 second delay
});

// Schedule topic analysis every 6 hours
const SIX_HOURS = 6 * 60 * 60 * 1000;
setInterval(() => {
    console.log('[Server] Running scheduled topic analysis');
    updateTopicModel().catch(err => {
        console.error('Error in scheduled topic analysis:', err);
    });
}, SIX_HOURS);
