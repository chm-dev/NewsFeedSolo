/**
 * Keyword Extractor using OpenAI GPT-4o mini
 * 
 * This module extracts meaningful keywords from article content using
 * OpenAI's GPT-4o mini model with a prompt-based approach for tagging.
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize the OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Maximum number of keywords to extract per article
const MAX_KEYWORDS = parseInt(process.env.MAX_KEYWORDS_PER_ARTICLE || 15);

/**
 * Clean and normalize text for processing
 * @param {string} text - Text to clean
 * @returns {string} - Cleaned text
 */
export function cleanText(text) {
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

/**
 * Extract keywords using OpenAI GPT-4o mini
 * @param {string} text - Text to extract keywords from
 * @returns {Promise<Array<Object>>} - Array of keyword objects with name and salience
 */
async function extractKeywordsWithOpenAI(text) {
    if (!text || typeof text !== 'string' || text.trim().length < 5) {
        console.warn('Text too short for keyword extraction');
        return [];
    }
    
    // Clean and normalize the text
    const cleanedText = cleanText(text);
    if (!cleanedText) {
        return [];
    }
    
    try {
        // Construct the prompt with the content
        const prompt = `You are a bot in a read-it-later app and your responsibility is to help with automatic tagging.
Please analyze the text between the sentences "CONTENT START HERE" and "CONTENT END HERE" and suggest relevant tags that describe its key themes, topics, and main ideas. The rules are:

Aim for a variety of tags, including broad categories, specific keywords, and potential sub-genres.
The tags language must be in english.
If it's a famous website you may also include a tag for the website. If the tag is not generic enough, don't include it.
The content can include text for cookie consent and privacy policy, ignore those while tagging.
Aim for 4-7 tags.
If there are no good tags, leave the array empty.
CONTENT START HERE

${cleanedText}
CONTENT END HERE
You must respond in JSON with the key "tags" and the value is an array of string tags.`;

        // Call OpenAI API with GPT-4o mini model
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You extract relevant tags from content." },
                { role: "user", content: prompt }
            ],
            temperature: 0.5,
            response_format: { type: "json_object" }
        });

        // Extract tags from the response
        const responseContent = response.choices[0].message.content;
        const parsedResponse = JSON.parse(responseContent);
        const tags = parsedResponse.tags || [];

        // Convert tags to the expected format with a dummy salience score for compatibility
        const keywords = tags.map(tag => ({
            name: tag.toLowerCase(),
            salience: 1.0, // Using a default salience as OpenAI doesn't provide this
            type: 'OTHER', // Default type as OpenAI doesn't provide entity types
            mentions: 1 // Default mention count
        }));
        
        return keywords;
    } catch (error) {
        console.error('Error extracting keywords with OpenAI:', error);
        return [];
    }
}

/**
 * Extract keywords from article content
 * @param {Object} article - Article object
 * @param {number} maxKeywords - Maximum number of keywords to return
 * @returns {Promise<Array<string>>} - Array of keywords
 */
export async function extractArticleKeywords(article, maxKeywords = MAX_KEYWORDS) {
    if (!article) return [];

    // Combine title, description and extracted content for keyword extraction
    const textToAnalyze = [
        article.title || '',
        article.description || '',
        (article.extracted_content || '') // Use full content for better analysis
    ].filter(Boolean).join(' ');

    // Extract keywords with OpenAI
    const keywords = await extractKeywordsWithOpenAI(textToAnalyze);
    
    // Return just the names for compatibility with existing code
    return keywords.map(kw => kw.name).slice(0, maxKeywords);
}

/**
 * Extract detailed keywords from article content
 * @param {Object} article - Article object
 * @param {number} maxKeywords - Maximum number of keywords to return
 * @returns {Promise<Array<Object>>} - Array of keyword objects with name and salience
 */
export async function extractDetailedKeywords(article, maxKeywords = MAX_KEYWORDS) {
    if (!article) return [];

    // Combine title, description and extracted content for keyword extraction
    const textToAnalyze = [
        article.title || '',
        article.description || '',
        (article.extracted_content || '') // Use full content for better analysis
    ].filter(Boolean).join(' ');

    // Return full keyword objects
    return (await extractKeywordsWithOpenAI(textToAnalyze)).slice(0, maxKeywords);
}

export default {
    extractArticleKeywords,
    extractDetailedKeywords,
    cleanText
};