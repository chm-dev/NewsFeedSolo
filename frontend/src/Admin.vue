<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white shadow">
      <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <h1 class="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
      </div>
    </header>
    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      <!-- Stats -->
      <div class="bg-white shadow rounded-lg p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-gray-900">System Statistics</h2>
          <button @click="fetchStats" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Refresh Stats
          </button>
        </div>
        <div v-if="stats" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div class="p-4 bg-gray-50 rounded-lg">
            <div class="text-sm text-gray-600">Recent Articles</div>
            <div class="text-2xl font-semibold">{{ stats.recentArticlesCount }}</div>
          </div>
          <div v-for="interaction in stats.interactions" :key="interaction.interaction_type" class="p-4 bg-gray-50 rounded-lg">
            <div class="text-sm text-gray-600">{{ formatInteractionType(interaction.interaction_type) }}</div>
            <div class="text-2xl font-semibold">{{ interaction.count }}</div>
            <div class="text-sm text-gray-500">{{ interaction.unique_articles }} unique articles</div>
          </div>
        </div>
      </div>

      <!-- User Preferences -->
      <div class="bg-white shadow rounded-lg p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-gray-900">User Preferences</h2>
        </div>
        <div v-if="stats && stats.profile" class="space-y-6">
          <!-- Category Preferences and Keywords stacked vertically -->
          <div class="space-y-6">
            <!-- Category Preferences -->
            <div>
              <h3 class="text-md font-medium text-gray-700 mb-2">Category Preferences</h3>
              <div class="space-y-2 max-h-60 overflow-y-auto">
                <div v-for="category in stats.profile.categoryPreferences" :key="category.name" class="flex items-center">
                  <div class="w-32 truncate">{{ category.name }}</div>
                  <div class="flex-1">
                    <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div class="h-full bg-blue-600 rounded-full" :style="{ width: `${Math.min(100, Math.abs(category.weight) * 20)}%` }"></div>
                    </div>
                  </div>
                  <div class="ml-2 text-sm text-gray-500">{{ category.weight.toFixed(1) }}</div>
                </div>
              </div>
            </div>
            
            <!-- Keywords -->
            <div>
              <h3 class="text-md font-medium text-gray-700 mb-2">Keywords ( {{ stats.profile.keywordCount }})</h3>
              <div class="flex flex-wrap gap-2 max-h-96 overflow-y-auto">
                <span v-for="keyword in stats.profile.keywords" :key="keyword.name"
                      class="px-2 py-1 rounded-md text-sm flex items-center"
                      :class="getKeywordClass(keyword.weight)">
                  {{ keyword.name }} 
                  <span class="ml-1 font-medium">{{ keyword.weight.toFixed(1) }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-gray-500 text-center py-4">
          No statistics available. Try refreshing.
        </div>
      </div>

      <!-- Explanation of weights -->
      <div class="mt-6 bg-white shadow rounded-lg p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Recommendation System Info</h2>
        <div class="text-sm text-gray-700 space-y-2">
          <p>
            <strong>Keywords:</strong> Only positive-weighted keywords are used in recommendations. Negative feedback removes keywords from your profile.
          </p>
          <p>
            <strong>Minimum Weight:</strong> Keywords with weights below <span class="font-medium">{{ keywordProfileMinWeight }}</span> are filtered out from your profile.
          </p>
          <p>
            <strong>Weights:</strong> 
            <span class="inline-block bg-blue-100 text-blue-800 rounded px-1">Lower (0-1)</span>
            <span class="inline-block bg-blue-200 text-blue-800 rounded px-1">Medium (1-3)</span>
            <span class="inline-block bg-blue-300 text-blue-800 rounded px-1">Higher (3+)</span>
          </p>
          <p>
            <strong>Decay:</strong> All interaction weights decay over time with a {{ Math.round(interactionDecayDays) }}-day half-life.
          </p>
          <p>
            <strong>More info:</strong> See <a href="./RECOMMENDATION_SYSTEM.md" class="text-blue-600 hover:underline">RECOMMENDATION_SYSTEM.md</a> for detailed explanation.
          </p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const stats = ref(null);
// Get interaction decay days from environment variables or use the default
const interactionDecayDays = 30; // Default value
const keywordProfileMinWeight = 0.2; // Default value from .env

async function fetchStats() {
  try {
    const response = await fetch('http://localhost:3000/api/admin/stats');
    stats.value = await response.json();
  } catch(error) {
    console.error('Error fetching stats:', error);
  }
}

function formatInteractionType(type) {
  const formats = {
    'click': 'Article Clicks',
    'thumbs_up': 'Thumbs Up',
    'thumbs_down': 'Thumbs Down'
  };
  return formats[type] || type;
}

// Function to determine color class based on weight
function getKeywordClass(weight) {
  if (weight >= 3) {
    return 'bg-blue-300 text-blue-800'; // Higher weight
  } else if (weight >= 1) {
    return 'bg-blue-200 text-blue-800'; // Medium weight
  } else {
    return 'bg-blue-100 text-blue-800'; // Lower weight
  }
}

onMounted(() => {
  fetchStats();
});
</script>