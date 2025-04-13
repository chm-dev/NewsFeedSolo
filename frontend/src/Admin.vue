<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white shadow-sm sticky top-0 z-10">
      <div class="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <h1 class="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <router-link to="/" class="text-blue-600 hover:text-blue-800">Back to News Feed</router-link>
      </div>
    </header>

    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <!-- System Stats -->
      <div class="bg-white shadow rounded-lg p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">System Statistics</h2>
        <div v-if="stats" class="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      <!-- Topics -->
      <div class="bg-white shadow rounded-lg p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-gray-900">Current Topics</h2>
          <button 
            @click="refreshTopics"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Refresh Topics
          </button>
        </div>
        
        <div v-if="topics.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="topic in topics" :key="topic.id" 
               class="p-4 bg-gray-50 rounded-lg">
            <h3 class="font-medium text-gray-900 mb-2">Topic {{ topic.id }}</h3>
            <div class="text-sm text-gray-500 mb-2">
              Interaction Score: {{ topicWeights[topic.id] || 0 }}
            </div>
            <ul class="space-y-1">
              <li v-for="term in JSON.parse(topic.terms)" :key="term.term" 
                  class="text-sm">
                <span class="text-gray-700">{{ term.term }}</span>
                <span class="text-gray-400 ml-1">({{ (term.probability * 100).toFixed(1) }}%)</span>
              </li>
            </ul>
          </div>
        </div>
        <div v-else class="text-gray-500 text-center py-4">
          No topics available. Try refreshing.
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const topics = ref([]);
const stats = ref(null);
const topicWeights = ref({});

async function fetchTopicWeights() {
  try {
    const response = await fetch('http://localhost:3000/api/admin/topic-weights');
    const weights = await response.json();
    topicWeights.value = weights;
  } catch (error) {
    console.error('Error fetching topic weights:', error);
  }
}

async function fetchTopics() {
  try {
    const response = await fetch('http://localhost:3000/api/admin/topics');
    topics.value = await response.json();
  } catch (error) {
    console.error('Error fetching topics:', error);
  }
}

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

async function refreshTopics() {
  await Promise.all([
    fetchTopics(),
    fetchStats(),
    fetchTopicWeights()
  ]);
}

onMounted(() => {
  refreshTopics();
});
</script>