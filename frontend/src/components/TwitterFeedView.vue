<template>
  <div class="twitter-feed-layout">
    <div class="space-y-4">
      <article 
        v-for="article in articles" 
        :key="article.id"
        class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 p-4"
        :data-article-id="article.id"
      >
        <!-- Header: Source and time -->
        <div class="mb-2">
          <div class="flex items-center">
            <span class="font-bold text-gray-900">{{ article.feed_title }}</span>
            <span class="mx-2 text-gray-500">•</span>
            <span class="text-gray-500">{{ formatRelativeTime(article.published_at) }}</span>
          </div>
        </div>
        
        <!-- Title - Now clickable -->
        <a :href="article.link" target="_blank" rel="noopener noreferrer" @click="$emit('trackClick', article.id)" class="block mb-2 hover:underline">
          <h3 class="text-lg font-semibold text-gray-900">{{ article.title }}</h3>
        </a>
        
        <!-- Content Preview - Truncated and converted from markdown -->
        <div class="mb-3 text-gray-700" v-html="formatContent(article.extracted_content || article.description)"></div>
        
        <!-- Image (if available) - Now clickable -->
        <div v-if="article.image_url" class="mb-3 rounded-lg overflow-hidden">
          <a :href="article.link" target="_blank" rel="noopener noreferrer" @click="$emit('trackClick', article.id)">
            <img 
              :src="article.image_url"
              :alt="article.title"
              class="w-full h-auto max-h-80 object-cover cursor-pointer"
              loading="lazy"
              @error="handleImageError"
            >
          </a>
        </div>
        
        <!-- Interaction Buttons - Removed Open button -->
        <div class="flex justify-end items-center text-gray-500 py-2 border-t border-b border-gray-100 mb-2">
          <div class="flex">
            <button 
              @click="$emit('rateArticle', article.id, 'thumbs_up')"
              class="px-2 py-1 hover:bg-gray-100 rounded-full flex items-center"
              :class="{ 'text-green-600': hasInteraction(article.id, 'thumbs_up') }"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
            </button>
            <button 
              @click="$emit('rateArticle', article.id, 'thumbs_down')"
              class="px-2 py-1 hover:bg-gray-100 rounded-full flex items-center"
              :class="{ 'text-red-600': hasInteraction(article.id, 'thumbs_down') }"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.105-1.79l-.05-.025A4 4 0 0011.055 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
              </svg>
            </button>
            <div class="px-2 py-1 flex items-center" v-if="article.view_count !== undefined">
              <svg class="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span class="text-xs">{{ article.view_count }}</span>
            </div>
          </div>
        </div>
        
        <!-- Statistics Section -->
        <div class="text-xs text-gray-500">
          <!-- Keywords -->
          <div v-if="article.keywords" class="mb-2">
            <div class="mb-1">Keywords:</div>
            <div class="flex flex-wrap gap-1">
              <span v-for="(keyword, idx) in parseKeywords(article)" :key="`${article.id}-${idx}`"
                    class="px-2 py-1 rounded-full flex items-center"
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
            <div class="mb-1">Relevance Scores:</div>
            <div class="flex flex-wrap gap-2">
              <span v-if="article.keyword_score !== undefined">
                Keywords: {{ Number(article.keyword_score).toFixed(1) }}
              </span>
              <span v-if="article.category_score !== undefined">
                Category: {{ Number(article.category_score).toFixed(1) }}
              </span>
              <span v-if="article.source_score !== undefined">
                Source: {{ Number(article.source_score).toFixed(1) }}
              </span>
              <span v-if="article.recency_score !== undefined">
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
            <div class="mt-1">
              ID: {{ article.id }}
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import { marked } from 'marked';

const props = defineProps({
  articles: {
    type: Array,
    required: true
  },
  userInteractions: {
    type: Map,
    required: true
  },
  userProfile: {
    type: Object,
    default: null
  },
  isForYou: {
    type: Boolean,
    default: false
  }
});

defineEmits(['trackClick', 'rateArticle']);

function handleImageError(event) {
  event.target.style.display = 'none';
}

function formatContent(content) {
  if (!content) return '';
  
  // Truncate content to around 200 characters
  let truncated = content.length > 500 ? content.substring(0, 500) + '...' : content;
  
  // Convert markdown to HTML
  try {
    return marked(truncated);
  } catch (error) {
    console.error('Error converting markdown:', error);
    return truncated;
  }
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffDay > 30) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  } else if (diffDay > 0) {
    return `${diffDay}d`;
  } else if (diffHour > 0) {
    return `${diffHour}h`;
  } else if (diffMin > 0) {
    return `${diffMin}m`;
  } else {
    return 'Just now';
  }
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

function hasInteraction(articleId, type) {
  return props.userInteractions.get(articleId) === type;
}

function getKeywordClass(keyword) {
  if (!props.userProfile || !props.userProfile.keywords) return 'bg-gray-100 text-gray-600';
  
  const match = props.userProfile.keywords.find(k => k.name === keyword);
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

function getKeywordWeight(keyword) {
  if (!props.userProfile || !props.userProfile.keywords) return null;
  
  const match = props.userProfile.keywords.find(k => k.name === keyword);
  return match ? match.weight : null;
}
</script>