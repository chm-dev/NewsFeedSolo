import lda from 'lda';
import { cleanText } from './keywordExtractor.js';
import { removeStopwords } from 'stopword';
import natural from 'natural';

const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;
const NGrams = natural.NGrams;
const boostTerms = new Set(); // Empty set instead of hardcoded tech terms

const MAX_CONTENT_LENGTH = 1000; // Maximum words per article
const MAX_ARTICLES_PER_CHUNK = 50; // Process articles in smaller chunks

function logMemoryUsage(label) {
    const used = process.memoryUsage();
    console.log('\nMEMORY USAGE at', label);
    console.log('RSS:', Math.round(used.rss / 1024 / 1024), 'MB');
    console.log('Heap:', Math.round(used.heapUsed / 1024 / 1024), 'MB');
}

/**
 * Process a chunk of articles for LDA
 */
function processArticleChunk(articles, numTopics, numTerms) {
    console.log(`\nProcessing chunk of ${articles.length} articles`);
    const chunkStart = Date.now();
    
    console.log('Starting document preparation...');
    const documents = articles
        .map((article, index) => {
            if (index % 10 === 0) {
                console.log(`Processed ${index}/${articles.length} articles in chunk`);
            }
            
            if (!article) return '';
            
            // Extract all keywords/tags from the article
            const keywordSet = new Set();
            try {
                // Parse the keywords JSON if it exists
                if (article.keywords && typeof article.keywords === 'string') {
                    const keywords = JSON.parse(article.keywords);
                    if (Array.isArray(keywords)) {
                        // Add each keyword to our set, preserving multi-word tags
                        keywords.forEach(kw => keywordSet.add(kw.toLowerCase()));
                    }
                }
            } catch (e) {
                // Ignore JSON parse errors
            }
            
            // Combine text fields with different weights but limit size
            const text = [
                article.title || '',          // Title gets more weight
                article.title || '',
                article.description || '',
                (article.extracted_content || article.content || '').split(' ').slice(0, MAX_CONTENT_LENGTH).join(' ') // Limit content length
            ].filter(Boolean).join(' ').trim();
            
            if (!text) return '';
            
            const cleanedText = cleanText(text);
            if (!cleanedText) return '';

            // Extract potential named entities and technical terms
            const namedEntities = new Set();
            const capitalized = cleanedText.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
            capitalized.forEach(entity => namedEntities.add(entity.toLowerCase()));

            // Tokenize and process with size limits
            const tokens = tokenizer.tokenize(cleanedText).slice(0, MAX_CONTENT_LENGTH);
            if (!tokens || tokens.length === 0) return '';
            
            // Extract n-grams (2-4 words)
            const ngrams = [];
            // Add bigrams (2 words)
            NGrams.bigrams(tokens)
                .slice(0, 50)
                .map(gram => gram.join(' '))
                .filter(gram => {
                    const words = gram.split(' ');
                    return words.every(w => w.length > 2) && 
                           (namedEntities.has(gram) || words.some(w => boostTerms.has(w.toLowerCase())));
                })
                .forEach(gram => ngrams.push(gram));
                
            // Add trigrams (3 words)
            NGrams.trigrams(tokens)
                .slice(0, 30)
                .map(gram => gram.join(' '))
                .filter(gram => namedEntities.has(gram) || keywordSet.has(gram))
                .forEach(gram => ngrams.push(gram));
                
            // Add quadgrams (4 words) if they match keywords
            NGrams.ngrams(tokens, 4)
                .slice(0, 20)
                .map(gram => gram.join(' '))
                .filter(gram => keywordSet.has(gram))
                .forEach(gram => ngrams.push(gram));

            // Remove stopwords but keep technical terms
            const filteredTokens = removeStopwords(tokens)
                .filter(token => {
                    const lower = token.toLowerCase();
                    return token.length > 2 || boostTerms.has(lower);
                })
                .slice(0, 100);

            // Add high priority to the actual keywords
            const keywordTokens = Array.from(keywordSet).map(kw => {
                // Add each keyword multiple times to increase its weight
                return Array(3).fill(kw);
            }).flat();

            if (filteredTokens.length === 0 && keywordTokens.length === 0 && ngrams.length === 0) return '';
            
            return [...filteredTokens, ...ngrams, ...keywordTokens].join(' ');
        })
        .filter(doc => doc.length > 0);

    console.log(`\nDocument preparation complete:`);
    console.log(`- Input articles: ${articles.length}`);
    console.log(`- Valid documents: ${documents.length}`);
    console.log(`- Average document length: ${documents.reduce((sum, doc) => sum + doc.split(' ').length, 0) / documents.length} words`);
    logMemoryUsage('after document preparation');

    if (documents.length === 0) return [];

    console.log('\nStarting LDA processing...');
    const ldaStart = Date.now();
    const result = lda(documents, numTopics, numTerms, null, null, null, 25);
    console.log(`LDA processing completed in ${(Date.now() - ldaStart) / 1000}s`);
    logMemoryUsage('after LDA');

    console.log(`\nChunk processing completed in ${(Date.now() - chunkStart) / 1000}s`);
    return result;
}

/**
 * Extract topics from a collection of documents using LDA
 */
export function extractTopics(articles, numTopics = 5, numTerms = 8) {
    console.log('\n=== Starting Topic Extraction ===');
    console.log(`Processing ${articles.length} articles`);
    console.log(`Target: ${numTopics} topics with ${numTerms} terms each`);
    logMemoryUsage('start');
    
    const startTime = Date.now();
    const TIMEOUT = 30000; // 30 seconds timeout
    let allTopics = [];

    // Process articles in smaller chunks
    for (let i = 0; i < articles.length; i += MAX_ARTICLES_PER_CHUNK) {
        const chunkNum = Math.floor(i / MAX_ARTICLES_PER_CHUNK) + 1;
        const totalChunks = Math.ceil(articles.length / MAX_ARTICLES_PER_CHUNK);
        console.log(`\n--- Processing Chunk ${chunkNum}/${totalChunks} ---`);
        
        // Check timeout
        if (Date.now() - startTime > TIMEOUT) {
            console.warn('Topic extraction timed out, processing partial results');
            break;
        }

        const chunk = articles.slice(i, i + MAX_ARTICLES_PER_CHUNK);
        const chunkTopics = processArticleChunk(chunk, numTopics, numTerms);
        
        console.log('\nMerging topics...');
        // Merge topics from this chunk
        if (allTopics.length === 0) {
            allTopics = chunkTopics;
            console.log('First chunk - using as base topics');
        } else {
            const mergeStart = Date.now();
            const originalTopicCount = allTopics.length;
            
            // Combine similar topics
            chunkTopics.forEach((newTopic, topicIndex) => {
                console.log(`\nProcessing new topic ${topicIndex + 1}`);
                const bestMatchIndex = allTopics.findIndex(existingTopic => {
                    const overlap = existingTopic.filter(t1 => 
                        newTopic.some(t2 => t2.term === t1.term)
                    ).length;
                    return overlap >= 2; // At least 2 terms in common
                });

                if (bestMatchIndex !== -1) {
                    console.log(`Merging with existing topic ${bestMatchIndex + 1}`);
                    // Merge into existing topic
                    const merged = new Map();
                    [...allTopics[bestMatchIndex], ...newTopic].forEach(({term, probability}) => {
                        merged.set(term, (merged.get(term) || 0) + probability);
                    });
                    allTopics[bestMatchIndex] = Array.from(merged.entries())
                        .map(([term, probability]) => ({term, probability}))
                        .sort((a, b) => b.probability - a.probability)
                        .slice(0, numTerms);
                } else if (allTopics.length < numTopics) {
                    console.log('Adding as new topic');
                    // Add as new topic if we haven't reached the limit
                    allTopics.push(newTopic);
                }
            });
            
            console.log(`\nMerge completed in ${(Date.now() - mergeStart) / 1000}s`);
            console.log(`Topics before/after merge: ${originalTopicCount}/${allTopics.length}`);
        }
        
        logMemoryUsage(`after chunk ${chunkNum}`);
    }

    console.log('\nPost-processing topics...');
    // Post-process and boost important terms
    const finalTopics = allTopics.map((topic, index) => {
        console.log(`\nProcessing topic ${index + 1}`);
        const terms = topic
            .filter(term => term.probability > 0.01)
            .map(term => {
                let boost = 1.0;
                
                // Enhanced boosting logic
                if (boostTerms.has(term.term.toLowerCase())) {
                    boost *= 1.3;
                }
                
                // Boost multi-word terms significantly
                const wordCount = term.term.split(' ').length;
                if (wordCount > 1) {
                    // The longer the phrase, the higher the boost
                    boost *= (1 + (wordCount * 0.2));
                }
                
                return {
                    term: term.term,
                    probability: term.probability * boost
                };
            });
        
        const result = terms.sort((a, b) => b.probability - a.probability);
        console.log('Top terms:', result.slice(0, 3).map(t => t.term).join(', '));
        return result;
    });

    const totalTime = (Date.now() - startTime) / 1000;
    console.log(`\n=== Topic Extraction Complete ===`);
    console.log(`Total time: ${totalTime}s`);
    console.log(`Final topic count: ${finalTopics.length}`);
    logMemoryUsage('end');

    return finalTopics;
}

/**
 * Find most relevant topics for an article
 * @param {Object} article - Article to analyze
 * @param {Array} topics - Topics extracted from the corpus
 * @returns {Array} - Array of topic indices sorted by relevance
 */
export function findArticleTopics(article, topics) {
    const text = [
        article.title || '',
        article.title || '',  // Include title twice for more weight
        article.description || '',
        article.extracted_content || article.content || ''
    ].join(' ');
    
    const cleanedText = cleanText(text);
    if (!cleanedText) return [];

    // Extract keywords from the article
    const keywordSet = new Set();
    try {
        if (article.keywords && typeof article.keywords === 'string') {
            const keywords = JSON.parse(article.keywords);
            if (Array.isArray(keywords)) {
                keywords.forEach(kw => keywordSet.add(kw.toLowerCase()));
            }
        }
    } catch (e) {
        // Ignore JSON parse errors
    }

    // Extract named entities and n-grams
    const namedEntities = new Set();
    const capitalized = cleanedText.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
    capitalized.forEach(entity => namedEntities.add(entity.toLowerCase()));

    const tokens = tokenizer.tokenize(cleanedText);
    if (!tokens || tokens.length === 0) return [];

    // Get various n-grams for matching multi-word terms
    const ngramSets = {
        bigrams: new Set(
            NGrams.bigrams(tokens)
                .map(gram => gram.join(' '))
                .filter(gram => /\w+\s+\w+/.test(gram))
        ),
        trigrams: new Set(
            NGrams.trigrams(tokens)
                .map(gram => gram.join(' '))
                .filter(gram => /\w+\s+\w+\s+\w+/.test(gram))
        ),
        quadgrams: new Set(
            NGrams.ngrams(tokens, 4)
                .map(gram => gram.join(' '))
                .filter(gram => /\w+\s+\w+\s+\w+\s+\w+/.test(gram))
        )
    };

    const filteredTokens = new Set(
        removeStopwords(tokens).filter(token => token.length > 2 || boostTerms.has(token.toLowerCase()))
    );
    
    // Calculate topic relevance scores with improved weighting for multi-word terms
    const scores = topics.map((topic, index) => {
        let score = 0;
        let totalWeight = 0;
        
        topic.forEach(({ term, probability }) => {
            // Base weight from the topic model
            let weight = probability;
            
            // Adjust weight based on term type
            if (boostTerms.has(term.toLowerCase())) {
                weight *= 1.3;
            }
            
            // Boost multi-word terms
            const wordCount = term.split(' ').length;
            if (wordCount > 1) {
                weight *= (1 + (wordCount * 0.2));
            }
            
            totalWeight += weight;
            
            // Check for matches, prioritizing exact keyword matches and multi-word matches
            if (keywordSet.has(term.toLowerCase())) {
                // Direct match with keywords gets highest score
                score += weight * 2.0;
            } else if (wordCount >= 4 && ngramSets.quadgrams.has(term)) {
                // 4-word matches get high score
                score += weight * 1.8;
            } else if (wordCount === 3 && ngramSets.trigrams.has(term)) {
                // 3-word matches
                score += weight * 1.6;
            } else if (wordCount === 2 && ngramSets.bigrams.has(term)) {
                // 2-word matches
                score += weight * 1.4;
            } else if (namedEntities.has(term.toLowerCase())) {
                // Named entities
                score += weight * 1.2;
            } else if (filteredTokens.has(term)) {
                // Single word matches
                score += weight;
            }
        });

        return {
            topicIndex: index,
            score: totalWeight > 0 ? score / totalWeight : 0
        };
    });
    
    // Return indices sorted by score, filtering out low-relevance topics
    return scores
        .filter(s => s.score > 0.02) // Lowered threshold even more to catch more relationships
        .sort((a, b) => b.score - a.score)
        .map(s => s.topicIndex);
}

export default {
    extractTopics,
    findArticleTopics
};