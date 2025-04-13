# News Collector

**IMPORTANT NOTE: This is currently a Proof of Concept (POC) project intended to demonstrate the feasibility of automated news collection and analysis. It is not intended for production use without further development and hardening.**

A full-stack Node.js application for collecting, analyzing, and serving news articles from RSS feeds. This application parses OPML files containing RSS feed URLs, fetches articles, extracts the main content, performs topic modeling, and serves content through a REST API with a Vue.js frontend.

## Current State

This project is a Proof of Concept that demonstrates:
- Automated news collection and content extraction
- Implementation of topic modeling for content categorization
- Basic recommendation system based on user interactions
- Simple web interface for content browsing

While functional, some areas would need further development for production use:
- Enhanced error handling and recovery
- Improved security measures
- Better scalability for larger article volumes
- Production-grade logging and monitoring
- Additional test coverage

## Features

- **OPML Parsing**: Parse OPML files to extract RSS feed information
- **RSS Feed Fetching**: Fetch articles from RSS feeds
- **Content Extraction**: Extract the main content from article URLs using [@extractus/article-extractor](https://github.com/extractus/article-extractor)
- **Topic Modeling**: Automatically analyze and categorize articles using LDA (Latent Dirichlet Allocation)
- **Keyword Extraction**: Extract relevant keywords from article content
- **REST API**: Serve articles and recommendations through a REST API
- **Vue.js Frontend**: Browse and interact with articles through a modern web interface
- **Admin Dashboard**: Monitor system statistics and topic analysis
- **SQLite Database**: Efficient storage and querying of articles and topic data
- **Article Recommendations**: Smart article recommendations based on topic analysis and user interactions

## Project Structure

```
NewsCollector/
├── src/                    # Backend source code
│   ├── index.js           # Main collector entry point
│   ├── server.js          # API server
│   ├── database.js        # Database operations
│   ├── opmlParser.js      # OPML file parsing
│   ├── rssFetcher.js      # RSS feed fetching
│   ├── contentFetcher.js  # Content fetching
│   ├── articleExtractor.js # Article extraction
│   ├── keywordExtractor.js # Keyword extraction
│   ├── topicAnalyzer.js   # Topic analysis orchestration
│   ├── topicModeling.js   # LDA implementation
│   └── storage.js         # File storage management
├── frontend/              # Vue.js frontend application
│   ├── src/              # Frontend source code
│   │   ├── App.vue       # Main application component
│   │   ├── Admin.vue     # Admin dashboard
│   │   └── main.js       # Frontend entry point
│   └── index.html        # Frontend HTML template
├── opml/                 # OPML feed configuration
│   ├── development.opml  # Development news feeds
│   └── diy.opml         # DIY project feeds
├── storage/              # Article storage
│   ├── news.db          # SQLite database
│   └── category/        # Raw article content by category
└── utils/               # Utility scripts
    └── migrate.js       # Database migration tools
```

## Storage Architecture

The application uses a hybrid storage approach:

1. **SQLite Database** (`storage/news.db`):
   - Article metadata and content
   - Topic modeling results
   - User interactions
   - Article recommendations

2. **File System** (`storage/category/`):
   - Raw article content
   - Organized by category/date/source
   - JSON format with extracted content

## Topic Modeling

The application performs automated topic analysis:

- Uses LDA (Latent Dirichlet Allocation) for topic discovery
- Processes articles in chunks to manage memory usage
- Updates topic models every 6 hours
- Tracks topic relevance scores per article
- Uses topic analysis for article recommendations

## API Endpoints

- `GET /api/articles` - Get articles with optional filtering
- `GET /api/categories` - Get available article categories
- `GET /api/recommendations` - Get personalized article recommendations
- `POST /api/articles/:id/interaction` - Track user interactions
- `GET /api/topics` - Get current active topics
- `GET /api/admin/topics` - Get detailed topic information
- `GET /api/admin/stats` - Get system statistics
- `GET /api/admin/topic-weights` - Get topic interaction weights

## Prerequisites

- Node.js 16.x or higher
- npm or yarn
- SQLite 3

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/news-collector.git
   cd news-collector
   ```

2. Install backend dependencies:
   ```bash
   npm install
   ```

3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

## Usage

1. Start the backend services:
   ```bash
   # Start the collector and API server
   npm start
   ```

2. Start the frontend development server:
   ```bash
   cd frontend
   npm run dev
   ```

3. Access the application:
   - Frontend: http://localhost:5173
   - API: http://localhost:3000

## Configuration

Configure the application through environment variables or modify the source files:

- `src/index.js`: Collector settings
- `src/server.js`: API server configuration
- `src/topicAnalyzer.js`: Topic modeling parameters
- `frontend/vite.config.js`: Frontend build configuration

## License

MIT
