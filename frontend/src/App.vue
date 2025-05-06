<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white shadow-sm sticky top-0 z-10">
      <div class="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <h1 class="text-2xl font-bold text-gray-900">News Feed</h1>
        <div class="flex items-center space-x-4">
          <router-link to="/admin" class="text-blue-600 hover:text-blue-800">Admin Panel</router-link>
          
          <!-- Layout Toggle Button -->
          <div class="flex items-center space-x-2">
            <span class="text-sm text-gray-600">Layout:</span>
            <button 
              @click="layoutType = 'grid'"
              class="px-3 py-1 rounded-md text-sm"
              :class="layoutType === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
            >
              <svg class="w-4 h-4 inline-block mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Grid
            </button>
            <button 
              @click="layoutType = 'twitter'"
              class="px-3 py-1 rounded-md text-sm"
              :class="layoutType === 'twitter' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
            >
              <svg class="w-4 h-4 inline-block mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
              </svg>
              Twitter
            </button>
          </div>
          
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
            @click="selectedCategory = null; isForYou = true; fetchArticles(true)"
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

        <!-- Feed Layout -->
        <div class="px-4 sm:px-0">
          <!-- Grid Layout View -->
          <GridFeedView 
            v-if="layoutType === 'grid'"
            :articles="displayedArticles"
            :user-interactions="userInteractions"
            :user-profile="userProfile"
            :is-for-you="isForYou"
            @track-click="trackClick"
            @rate-article="rateArticle"
          />
          
          <!-- Twitter Layout View -->
          <TwitterFeedView 
            v-else
            :articles="displayedArticles"
            :user-interactions="userInteractions"
            :user-profile="userProfile"
            :is-for-you="isForYou"
            @track-click="trackClick"
            @rate-article="rateArticle"
          />
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
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue';
import { API_URL } from './config';
import GridFeedView from './components/GridFeedView.vue';
import TwitterFeedView from './components/TwitterFeedView.vue';

const articles = ref([]);
const categories = ref([]);
const selectedCategory = ref(null);
const offset = ref(0);
const hasMoreArticles = ref(true);
const sortBy = ref('stored_at');
const isForYou = ref(true); // Changed to true by default
const userInteractions = ref(new Map());
const userProfile = ref(null);
// Get layout preference from localStorage or use 'twitter' as default
const layoutType = ref(localStorage.getItem('preferred-layout') || 'twitter');

const LIMIT = 30;

// Save layout preference to localStorage whenever it changes
watch(layoutType, (newLayout) => {
  localStorage.setItem('preferred-layout', newLayout);
});

const displayedArticles = computed(() => {
  return articles.value;
});

function hasInteraction(articleId, type) {
  return userInteractions.value.get(articleId) === type;
}

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

function selectCategory(category) {
  selectedCategory.value = category;
  isForYou.value = false;
  // Fetch articles for the selected category
  fetchArticles(true);
}

function loadMore() {
  fetchArticles();
}

function handleSortChange() {
  fetchArticles(true);
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach(async (entry) => {
    if (entry.isIntersecting) {
      const articleId = entry.target.dataset.articleId;
      if (!articleId || viewedArticles.has(articleId)) return;

      viewedArticles.add(articleId);
      try {
        await fetch(`${API_URL}/articles/${articleId}/view`, {
          method: 'POST',
        });
        
        // Update local view count in UI without needing to refetch
        const articleIndex = articles.value.findIndex(a => a.id.toString() === articleId);
        if (articleIndex !== -1) {
          articles.value[articleIndex].view_count = (articles.value[articleIndex].view_count || 0) + 1;
        }
      } catch (error) {
        console.error('Error updating view count:', error);
      }
    }
  });
}, {
  threshold: 0.5, // Element must be at least 50% visible
  rootMargin: '0px' // No margin
});

const viewedArticles = new Set();

function observeArticles() {
  // Use nextTick to ensure DOM is updated
  nextTick(() => {
    const articleElements = document.querySelectorAll('[data-article-id]');
    articleElements.forEach((el) => {
      // Only observe elements that aren't already being observed
      if (!el._isObserved) {
        observer.observe(el);
        el._isObserved = true;
      }
    });
  });
}

// Clean up observer when component is unmounted
onUnmounted(() => {
  observer.disconnect();
});

watch(articles, () => {
  // When articles change (new ones loaded), observe the new elements
  observeArticles();
}, { deep: false });

// Watch for layout changes to re-observe articles
watch(layoutType, () => {
  // Give DOM time to update with new layout
  nextTick(() => {
    observeArticles();
  });
});

onMounted(() => {
  fetchCategories();
  fetchUserProfile();
  fetchArticles().then(() => {
    observeArticles();
  });
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