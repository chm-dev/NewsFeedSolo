<template>
  <div class="grid-feed-layout">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <article 
        v-for="article in articles" 
        :key="article.id"
        class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300"
        :data-article-id="article.id"
      >
        <!-- Clickable image -->
        <div class="aspect-w-16 aspect-h-9 bg-gray-100">
          <a v-if="article.image_url" :href="article.link" target="_blank" rel="noopener noreferrer" @click="$emit('trackClick', article.id)">
            <img 
              :src="article.image_url"
              :alt="article.title"
              class="w-full h-full object-cover cursor-pointer"
              loading="lazy"
              @error="handleImageError"
            >
          </a>
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

          <!-- Clickable title -->
          <a :href="article.link" target="_blank" rel="noopener noreferrer" @click="$emit('trackClick', article.id)" class="block hover:underline">
            <h3 class="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{{ article.title }}</h3>
          </a>

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
        
        <!-- Thumbs buttons outside of the link -->
        <div class="px-4 pb-4 flex justify-end space-x-2">
          <button 
            @click.stop="$emit('rateArticle', article.id, 'thumbs_up')"
            class="p-2 rounded-full hover:bg-gray-100"
            :class="{ 'text-green-600': hasInteraction(article.id, 'thumbs_up') }"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
            </svg>
          </button>
          <button 
            @click.stop="$emit('rateArticle', article.id, 'thumbs_down')"
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
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

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

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
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