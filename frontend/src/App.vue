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

        <!-- Profile Panel (shown only on FOR YOU page) -->
        <div v-if="isForYou && userProfile" class="mb-6 px-4 sm:px-0">
          <div class="bg-white p-4 rounded-lg shadow-sm">
            <h3 class="text-lg font-medium text-gray-900 mb-2">Your Interest Profile</h3>
            
            <div v-if="userProfile.keywords?.length > 0" class="mb-3">
              <h4 class="text-sm font-medium text-gray-700 mb-1">Top Keywords</h4>
              <div class="flex flex-wrap gap-1">
                <span v-for="keyword in userProfile.keywords.slice(0, 16)" :key="keyword.name"
                  class="px-2 py-1 rounded-full text-xs flex items-center"
                  :class="getKeywordClass(keyword.name)">
                  {{ keyword.name }} 
                  <span class="ml-1 font-medium">{{ keyword.weight.toFixed(1) }}</span>
                </span>
              </div>
            </div>
            
            <div v-if="userProfile.categories?.length > 0" class="mb-3">
              <h4 class="text-sm font-medium text-gray-700 mb-1">Category Preferences</h4>
              <div class="flex flex-wrap gap-1">
                <span v-for="category in userProfile.categories" :key="category.name"
                  class="px-2 py-1 rounded-full bg-green-100 text-xs text-green-700">
                  {{ category.name }} ({{ category.weight.toFixed(1) }})
                </span>
              </div>
            </div>
            
            <div v-if="userProfile.sources?.length > 0" class="mb-3">
              <h4 class="text-sm font-medium text-gray-700 mb-1">Source Preferences</h4>
              <div class="flex flex-wrap gap-1">
                <span v-for="source in userProfile.sources.slice(0, 5)" :key="source.name"
                  class="px-2 py-1 rounded-full bg-purple-100 text-xs text-purple-700">
                  {{ source.name }} ({{ source.weight.toFixed(1) }})
                </span>
              </div>
            </div>
            
            <p class="text-xs text-gray-500 mt-2">
              This profile is built automatically based on your article interactions.
              The more you interact with articles (clicking, rating), the more personalized your feed becomes.
            </p>
          </div>
        </div>

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
                  <span v-if="article.view_count !== undefined" class="flex items-center ml-auto">
                    <svg class="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span class="text-xs">{{ article.view_count }}</span>
                  </span>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{{ article.title }}</h3>
                <p class="text-gray-600 text-sm line-clamp-3 mb-3">{{ article.description }}</p>
                
                <!-- Keywords -->
                <div v-if="article.keywords" class="mb-2">
                  <div class="text-xs text-gray-500 mb-1">Keywords:</div>
                  <div class="flex flex-wrap gap-1">
                    <span v-for="(keyword, idx) in parseKeywords(article)" :key="`${article.id}-${idx}`"
                          class="px-2 py-1 rounded-full text-xs flex items-center"
                          :class="getKeywordClass(keyword)">
                      {{ keyword }}
                      <span v-if="getKeywordWeight(keyword) !== null" class="ml-1 font-medium">
                        {{ getKeywordWeight(keyword).toFixed(1) }}
                      </span>
                    </span>
                  </div>
                </div>

                <!-- Article Score (only in recommendations) -->
                <div v-if="isForYou && article.final_score" class="mb-2">
                  <div class="text-xs text-gray-500 mb-1">Relevance Scores:</div>
                  <div class="flex flex-wrap gap-2 text-xs">
                    <span v-if="article.keyword_score !== undefined" class="text-gray-600">
                      Keywords: {{ Number(article.keyword_score).toFixed(1) }}
                    </span>
                    <span v-if="article.category_score !== undefined" class="text-gray-600">
                      Category: {{ Number(article.category_score).toFixed(1) }}
                    </span>
                    <span v-if="article.source_score !== undefined" class="text-gray-600">
                      Source: {{ Number(article.source_score).toFixed(1) }}
                    </span>
                    <span v-if="article.recency_score !== undefined" class="text-gray-600">
                      Recency: {{ Number(article.recency_score).toFixed(1) }}
                    </span>
                    <span v-if="article.viewFatigueScore !== undefined && article.viewFatigueScore < 0" class="text-red-600">
                      Fatigue: {{ Number(article.viewFatigueScore).toFixed(1) }}
                    </span>
                    <span v-if="article.justInBoost !== undefined && article.justInBoost > 0" class="text-purple-600 font-medium">
                      Just In: {{ Number(article.justInBoost).toFixed(1) }}
                    </span>
                    <span class="font-bold text-blue-600">
                      Total: {{ Number(article.final_score).toFixed(1) }}
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
import { API_URL } from './config';

const articles = ref([]);
const categories = ref([]);
const selectedCategory = ref(null);
const offset = ref(0);
const hasMoreArticles = ref(true);
const sortBy = ref('stored_at');
const isForYou = ref(true); // Changed to true by default
const userInteractions = ref(new Map());
const userProfile = ref(null);

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

function parseKeywords(article) {
  try {
    if (article.keywords) {
      return JSON.parse(article.keywords).slice(0, 10); // Limit to 10 keywords
    }
    return [];
  } catch (e) {
    console.error('Error parsing keywords:', e);
    return [];
  }
}

function keywordMatch(keyword) {
  // Check if keyword is in user's profile with a positive weight
  if (!userProfile.value || !userProfile.value.keywords) return false;
  
  const match = userProfile.value.keywords.find(k => k.name === keyword);
  return match && match.weight > 0;
}

// Function to determine color class based on keyword weight
function getKeywordClass(keyword) {
  if (!userProfile.value || !userProfile.value.keywords) return 'bg-gray-100 text-gray-600';
  
  const match = userProfile.value.keywords.find(k => k.name === keyword);
  if (!match) return 'bg-gray-100 text-gray-600';
  
  if (match.weight >= 3) {
    return 'bg-blue-300 text-blue-800'; // Higher weight
  } else if (match.weight >= 1) {
    return 'bg-blue-200 text-blue-800'; // Medium weight
  } else if (match.weight > 0) {
    return 'bg-blue-100 text-blue-800'; // Lower weight
  } else {
    return 'bg-gray-100 text-gray-600'; // No weight or negative
  }
}

// Function to get keyword weight from user profile
function getKeywordWeight(keyword) {
  if (!userProfile.value || !userProfile.value.keywords) return null;
  
  const match = userProfile.value.keywords.find(k => k.name === keyword);
  return match ? match.weight : null;
}

async function fetchUserProfile() {
  try {
    const response = await fetch(`${API_URL}/profile`);
    userProfile.value = await response.json();
  } catch (error) {
    console.error('Error fetching user profile:', error);
  }
}

async function fetchArticles(reset = false) {
  if (reset) {
    offset.value = 0;
    articles.value = [];
    hasMoreArticles.value = true;
  }

  const endpoint = isForYou.value ? '/recommendations' : '/articles';
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
    const response = await fetch(`${API_URL}${endpoint}?${params}`);
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
    const response = await fetch(`${API_URL}/categories`);
    categories.value = await response.json();
  } catch (error) {
    console.error('Error fetching categories:', error);
  }
}

async function trackClick(articleId) {
  try {
    await fetch(`${API_URL}/articles/${articleId}/interaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'click' })
    });
    
    // Update user interactions and refresh profile
    userInteractions.value.set(articleId, 'click');
    if (isForYou.value) {
      setTimeout(() => fetchUserProfile(), 500); // Refresh profile after interaction
    }
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

    await fetch(`${API_URL}/articles/${articleId}/interaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });

    userInteractions.value.set(articleId, type);
    
    // Refresh user profile after interaction
    setTimeout(() => fetchUserProfile(), 500);
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

watch([selectedCategory, isForYou], () => {
  fetchArticles(true);
  if (isForYou.value) {
    fetchUserProfile();
  }
});

onMounted(() => {
  fetchCategories();
  fetchUserProfile();
  fetchArticles();
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