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
          <button 
            @click="fetchStats"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Refresh Stats
          </button>
        </div>
        <div v-if="stats" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div class="p-4 bg-gray-50 rounded-lg">
            <div class="text-sm text-gray-600">Recent Articles</div>
            <div class="text-2xl font-semibold">{{ stats.recentArticlesCount }}</div>
          </div>
          <div v-for="interaction in stats.interactions" :key="interaction.interaction_type" 
               class="p-4 bg-gray-50 rounded-lg">
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
          <!-- Top Keywords -->
          <div>
            <h3 class="text-md font-medium text-gray-700 mb-2">Top Keywords</h3>
            <div class="flex flex-wrap gap-2">
              <span v-for="keyword in stats.profile.topKeywords" :key="keyword.name"
                   class="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">
                {{ keyword.name }} ({{ keyword.weight.toFixed(1) }})
              </span>
            </div>
          </div>
          
          <!-- Category Preferences -->
          <div>
            <h3 class="text-md font-medium text-gray-700 mb-2">Category Preferences</h3>
            <div class="space-y-2">
              <div v-for="category in stats.profile.categoryPreferences" :key="category.name"
                   class="flex items-center">
                <div class="w-32 truncate">{{ category.name }}</div>
                <div class="flex-1">
                  <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-600 rounded-full" 
                         :style="{ width: `${Math.min(100, Math.abs(category.weight) * 20)}%` }"></div>
                  </div>
                </div>
                <div class="ml-2 text-sm text-gray-500">{{ category.weight.toFixed(1) }}</div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-gray-500 text-center py-4">
          No statistics available. Try refreshing.
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const stats = ref(null);

async function fetchStats() {
  try {
    const response = await fetch('http://localhost:3000/api/admin/stats');
    stats.value = await response.json();
  } catch (error) {
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

onMounted(() => {
  fetchStats();
});
</script>