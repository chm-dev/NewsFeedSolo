import { getArticles, storeTopics, updateArticleTopics } from './database.js';
import { extractTopics, findArticleTopics } from './topicModeling.js';

const TOPICS_COUNT = 12;  // Increased from 10 to 12 for more topic coverage
const TERMS_PER_TOPIC = 8;  // Increased from 5 to 8 to include more multi-word terms
const BATCH_SIZE = 50;     // Size of batches for processing
const ANALYSIS_TIMEOUT = 300000; // 5 minutes

function logTimestamp(label) {
    console.log(`\n[${new Date().toISOString()}] ${label}`);
}

/**
 * Debug function to print discovered topics and their terms
 * @param {Array} topics - Array of topics with terms and probabilities
 */
function debugTopics(topics, articles) {
    console.log('\n=== Discovered Topics ===\n');
    topics.forEach((topic, i) => {
        console.log(`Topic ${i + 1}:`);
        console.log(topic.map(t => `${t.term} (${t.probability.toFixed(3)})`).join(', '));
        console.log('');
    });

    // Print a sample article and its most relevant topics
    if (articles.length > 0) {
        const sampleArticle = articles[0];
        console.log('\n=== Sample Article Topic Analysis ===\n');
        console.log('Title:', sampleArticle.title);
        const topicIndices = findArticleTopics(sampleArticle, topics);
        console.log('\nRelevant Topics:');
        topicIndices.slice(0, 3).forEach(index => {
            console.log(`Topic ${index + 1}:`, topics[index].map(t => t.term).join(', '));
        });
    }
}

/**
 * Process a batch of articles for topic analysis
 */
async function processBatch(articles, topics, topicIds, startIndex) {
    logTimestamp(`Processing batch ${Math.floor(startIndex/BATCH_SIZE) + 1}/${Math.ceil(articles.length/BATCH_SIZE)}`);
    console.log(`Batch size: ${Math.min(BATCH_SIZE, articles.length - startIndex)} articles`);
    
    const batch = articles.slice(startIndex, startIndex + BATCH_SIZE);
    const batchStartTime = Date.now();
    
    for (const article of batch) {
        // Check if we've spent too long on this batch
        if (Date.now() - batchStartTime > 30000) { // Increased from 10 to 30 seconds timeout per batch
            console.warn('Batch processing timeout after', (Date.now() - batchStartTime) / 1000, 'seconds');
            break;
        }

        const topicIndices = findArticleTopics(article, topics);
        const mappedTopicIndices = topicIndices.map(index => topicIds[index]);
        
        // Calculate topic scores with position-based weighting
        const topicScores = topicIndices.map((index, position) => ({
            score: Math.max(0.1, 1 - (position / topicIndices.length))  // Ensure minimum score of 0.1
        }));

        const result = await updateArticleTopics(article.id, mappedTopicIndices, topicScores);
        if (!result.success) {
            console.error('Failed to update topics for article:', article.id, result.error);
        }
    }

    logTimestamp(`Batch completed in ${(Date.now() - batchStartTime) / 1000}s`);
}

/**
 * Analyze articles and update topic models
 */
export async function updateTopicModel() {
    const startTime = Date.now();
    
    try {
        logTimestamp('Starting topic model update');
        
        // Get articles from the last 7 days (increased from 3)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        logTimestamp('Fetching recent articles');
        console.log('Date range:', sevenDaysAgo.toISOString(), 'to now');
        
        console.log('Fetching articles for topic analysis...');
        const articles = await getArticles({
            dateFrom: sevenDaysAgo.toISOString(),
            limit: 1000  // Increased from 500 to include more articles
        });

        console.log(`Retrieved ${articles.length} articles`);

        if (articles.length === 0) {
            console.log('No articles found for topic analysis');
            return;
        }

        // Check timeout
        if (Date.now() - startTime > ANALYSIS_TIMEOUT) {
            console.error('Topic analysis timeout during article fetch after', (Date.now() - startTime) / 1000, 'seconds');
            return;
        }

        logTimestamp('Starting topic extraction');
        console.log(`Processing ${articles.length} articles for ${TOPICS_COUNT} topics`);
        
        // Extract topics from articles
        const topics = extractTopics(articles, TOPICS_COUNT, TERMS_PER_TOPIC);
        
        if (topics.length === 0) {
            console.log('No topics could be extracted from the articles');
            return;
        }
        
        // Check timeout
        if (Date.now() - startTime > ANALYSIS_TIMEOUT) {
            console.error('Topic analysis timeout after topic extraction');
            return;
        }

        // Debug: Print discovered topics
        debugTopics(topics, articles);
        
        logTimestamp('Storing topics in database');
        // Store new topics
        console.log('Storing topics in database...');
        const { success, topicIds, error } = await storeTopics(topics);
        
        if (!success) {
            console.error('Failed to store topics:', error);
            return;
        }

        console.log('Topics stored successfully');
        console.log('Topic IDs:', topicIds);

        logTimestamp('Updating article topic relationships');
        
        // Process articles in smaller batches with timeouts
        console.log('Updating article topic relationships...');
        
        for (let i = 0; i < articles.length; i += BATCH_SIZE) {
            // Check overall timeout
            if (Date.now() - startTime > ANALYSIS_TIMEOUT) {
                console.error('Topic analysis timeout during batch processing');
                break;
            }

            await processBatch(articles, topics, topicIds, i);
            
            // Add a small delay between batches to allow other operations
            if (i + BATCH_SIZE < articles.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        logTimestamp(`Topic model update completed in ${duration}s`);
        return true; // Return success
        
    } catch (error) {
        console.error('Error updating topic model:', error);
        throw error; // Re-throw to allow caller to catch it
    }
}

export { TOPICS_COUNT, TERMS_PER_TOPIC };
