<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white shadow-sm sticky top-0 z-10">
      <div class="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <h1 class="text-2xl font-bold text-gray-900">News Feed</h1>
        <div class="flex items-center space-x-4">
          <router-link to="/admin" class="text-blue-600 hover:text-blue-800">Admin Panel</router-link>
          <div class="flex items-center space-x-2">
            <label class="text-sm text-gray-600">Sort by:</label>
            <select 
              v-model="sortBy"
              class="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              @change="handleSortChange"
            >
              <option value="stored_at">Recently Added</option>
              <option value="published_at">Publication Date</option>
            </select>
          </div>
        </div>
      </div>
    </header>
    <main>
      <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <!-- Category Navigation -->
        <nav class="flex space-x-4 mb-6 px-4 sm:px-0 overflow-x-auto sticky top-16 bg-gray-100 py-2">
          <button 
            @click="selectedCategory = null; isForYou = true"
            :class="[
              'px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap',
              isForYou 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            ]"
          >
            FOR YOU
          </button>
          <button 
            v-for="cat in categories" 
            :key="cat"
            @click="selectCategory(cat)"
            :class="[
              'px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap',
              selectedCategory === cat && !isForYou
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            ]"
          >
            {{ cat }}
          </button>
        </nav>

        <!-- Articles Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 sm:px-0">
          <article 
            v-for="article in displayedArticles" 
            :key="article.id"
            class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300"
          >
            <a :href="article.link" target="_blank" rel="noopener noreferrer" class="block" @click="trackClick(article.id)">
              <div class="aspect-w-16 aspect-h-9 bg-gray-100">
                <img 
                  v-if="article.image_url" 
                  :src="article.image_url"
                  :alt="article.title"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  @error="handleImageError"
                >
                <div v-else class="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
                  <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" 
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div class="p-4">
                <div class="flex items-center text-sm text-gray-500 mb-2">
                  <span class="truncate">{{ article.feed_title }}</span>
                  <span class="mx-2 flex-shrink-0">•</span>
                  <span class="flex-shrink-0">{{ formatDate(article.published_at) }}</span>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{{ article.title }}</h3>
                <p class="text-gray-600 text-sm line-clamp-3 mb-3">{{ article.description }}</p>
                
                <!-- Keywords -->
                <div v-if="article.keywords" class="mb-2">
                  <div class="text-xs text-gray-500 mb-1">Keywords:</div>
                  <div class="flex flex-wrap gap-1">
                    <span v-for="keyword in JSON.parse(article.keywords)" :key="keyword"
                          class="px-2 py-1 rounded-full bg-gray-100 text-xs text-gray-600">
                      {{ keyword }}
                    </span>
                  </div>
                </div>

                <!-- Topics -->
                <div v-if="article.topic_indices" class="mb-2">
                  <div class="text-xs text-gray-500 mb-1">Related Topics:</div>
                  <div class="flex flex-wrap gap-1">
                    <span v-for="(topicId, idx) in getArticleTopicsWithScores(article)" :key="topicId.id"
                          class="px-2 py-1 rounded-full bg-blue-100 text-xs text-blue-600">
                      Topic {{ topicId.id }} [{{ topicId.score.toFixed(2) }}]
                    </span>
                  </div>
                </div>

                <!-- Article Score -->
                <div v-if="article.topic_scores" class="mb-2">
                  <div class="text-xs text-gray-500 mb-1">Article Score:</div>
                  <div class="flex flex-wrap gap-2 text-xs">
                    <span class="text-gray-600">
                      Topic Score: {{ article.topic_score || 0 }}
                    </span>
                    <span class="text-gray-600">
                      Interaction Score: {{ article.direct_interaction_score || 0 }}
                    </span>
                    <span class="font-bold text-blue-600">
                      Total: {{ article.final_score || 0 }}
                    </span>
                  </div>
                  <div class="text-xs text-gray-500 mt-1">
                    ID: {{ article.id }}
                  </div>
                </div>
              </div>
            </a>
            
            <!-- Thumbs buttons outside of the link -->
            <div class="px-4 pb-4 flex justify-end space-x-2">
              <button 
                @click.stop="rateArticle(article.id, 'thumbs_up')"
                class="p-2 rounded-full hover:bg-gray-100"
                :class="{ 'text-green-600': hasInteraction(article.id, 'thumbs_up') }"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                </svg>
              </button>
              <button 
                @click.stop="rateArticle(article.id, 'thumbs_down')"
                class="p-2 rounded-full hover:bg-gray-100"
                :class="{ 'text-red-600': hasInteraction(article.id, 'thumbs_down') }"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.105-1.79l-.05-.025A4 4 0 0011.055 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
                </svg>
              </button>
            </div>
          </article>
        </div>

        <!-- Load More Button -->
        <div class="flex justify-center mt-8" v-if="hasMoreArticles">
          <button 
            @click="loadMore"
            class="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Load More
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';

const articles = ref([]);
const categories = ref([]);
const selectedCategory = ref(null);
const offset = ref(0);
const hasMoreArticles = ref(true);
const sortBy = ref('stored_at');
const isForYou = ref(true); // Changed to true by default
const userInteractions = ref(new Map());
const topics = ref([]); // Add topics state

const LIMIT = 30;

const displayedArticles = computed(() => {
  return articles.value;
});

function hasInteraction(articleId, type) {
  return userInteractions.value.get(articleId) === type;
}

function handleImageError(event) {
  event.target.style.display = 'none';
}

async function fetchArticles(reset = false) {
  if (reset) {
    offset.value = 0;
    articles.value = [];
    hasMoreArticles.value = true;
  }

  const endpoint = isForYou.value ? '/api/recommendations' : '/api/articles';
  const params = new URLSearchParams({
    limit: LIMIT,
    offset: offset.value
  });

  if (!isForYou.value) {
    params.append('sort', sortBy.value);
    if (selectedCategory.value) {
      params.append('category', selectedCategory.value);
    }
  }

  try {
    const response = await fetch(`http://localhost:3000${endpoint}?${params}`);
    const newArticles = await response.json();
    articles.value = reset ? newArticles : [...articles.value, ...newArticles];
    offset.value += LIMIT;
    hasMoreArticles.value = newArticles.length === LIMIT;
  } catch (error) {
    console.error('Error fetching articles:', error);
  }
}

async function fetchCategories() {
  try {
    const response = await fetch('http://localhost:3000/api/categories');
    categories.value = await response.json();
  } catch (error) {
    console.error('Error fetching categories:', error);
  }
}

async function fetchTopics() {
  try {
    const response = await fetch('http://localhost:3000/api/topics');
    topics.value = await response.json();
  } catch (error) {
    console.error('Error fetching topics:', error);
  }
}

async function trackClick(articleId) {
  try {
    await fetch(`http://localhost:3000/api/articles/${articleId}/interaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'click' })
    });
  } catch (error) {
    console.error('Error tracking click:', error);
  }
}

async function rateArticle(articleId, type) {
  try {
    const currentInteraction = userInteractions.value.get(articleId);
    if (currentInteraction === type) {
      return; // Already rated
    }

    await fetch(`http://localhost:3000/api/articles/${articleId}/interaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });

    userInteractions.value.set(articleId, type);
  } catch (error) {
    console.error('Error rating article:', error);
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function selectCategory(category) {
  selectedCategory.value = category;
  isForYou.value = false;
}

function loadMore() {
  fetchArticles();
}

function handleSortChange() {
  fetchArticles(true);
}

function getTopicTerms(topicId) {
  const topic = topics.value.find(t => t.id === topicId);
  if (!topic) return '';
  
  // Parse the terms and get the top 3 most probable terms
  const terms = JSON.parse(topic.terms)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3)
    .map(t => t.term)
    .join(', ');
    
  return terms;
}

function getArticleTopics(article) {
  if (!article.topic_indices || !article.topic_scores) return [];
  
  const topicIndices = JSON.parse(article.topic_indices);
  const topicScores = JSON.parse(article.topic_scores);
  
  // Only show topics with score > 0.2 (20% relevance)
  return topicIndices.filter((topicId, index) => {
    return topicScores[index].score > 0.2 && topics.value.find(t => t.id === topicId);
  });
}

function getArticleTopicsWithScores(article) {
  if (!article.topic_indices || !article.topic_scores) return [];
  
  const topicIndices = JSON.parse(article.topic_indices);
  const topicScores = JSON.parse(article.topic_scores);
  
  // Only show topics with score > 0.2 (20% relevance)
  return topicIndices.map((topicId, index) => {
    return {
      id: topicId,
      score: topicScores[index].score
    };
  }).filter(topic => topic.score > 0.2 && topics.value.find(t => t.id === topic.id));
}

function getTopicTotalScore(article) {
  if (!article.topic_scores) return 0;
  const scores = JSON.parse(article.topic_scores);
  return scores.reduce((total, score) => total + score.score, 0);
}

watch([selectedCategory, isForYou], () => {
  fetchArticles(true);
});

onMounted(() => {
  fetchCategories();
  fetchArticles();
  fetchTopics(); // Add topics fetch
});
</script>

<style>
/* Add support for aspect ratio if browser doesn't support it */
.aspect-w-16 {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 Aspect Ratio */
}

.aspect-w-16 > * {
  position: absolute;
  height: 100%;
  width: 100%;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}
</style>