# News Recommendation System: Scoring Parameters Explained

This document explains the recommendation system parameters available in the `.env` file and how they impact article scoring and recommendations.

## Overview

The recommendation system combines several factors to rank articles for users:

1. **Keyword Matching**: How well article keywords match the user's interest profile
2. **Category Preferences**: How much the user interacts with specific content categories
3. **Source Preferences**: How much the user interacts with specific content sources 
4. **Article Recency**: How recently an article was published
5. **Direct Interactions**: Whether the user has directly interacted with the article

Each of these factors can be tuned through environment variables to customize the recommendation algorithm.

## Scoring Weights

### Factor Weights

These parameters control how much each component contributes to the final article score:

#### `KEYWORD_MATCH_WEIGHT` (Default: 0.4)

Controls the importance of keyword matching between articles and user profiles.

**Base Score Calculation:**
```javascript
// Raw calculation before applying weight
let keywordScore = 0;
const keywords = JSON.parse(article.keywords || '[]');
keywords.forEach(keyword => {
    const weight = keywordMap.get(keyword) || 0;
    keywordScore += weight;
});

// Normalization to avoid favoring articles with many keywords
if (keywords.length > 0) {
    keywordScore = keywordScore / Math.sqrt(keywords.length);
}

// Final calculation with weight applied
keywordScore = keywordScore * KEYWORD_MATCH_WEIGHT;
```

**Value Range:** 
- Base keywordScore typically ranges from 0 to ~10 depending on:
  - How many keywords match the user profile
  - How strongly those keywords are weighted in the profile
  - A highly relevant article might have a raw score of 5-10 before weight application
  - Articles with no matching keywords will have a score of 0

**Practical Effects:**
- **Higher values** (e.g., 1.0+): Recommendations become more topic-driven, showing content that closely matches the user's keyword interests regardless of recency or source
- **Lower values** (e.g., 0.1): Reduces the importance of content topics, allowing other factors to have more influence

#### `CATEGORY_WEIGHT` (Default: 0.2)

Controls how much a user's category preferences influence recommendations.

**Base Score Calculation:**
```javascript
// Raw calculation before applying weight
const categoryScore = (categoryMap.get(article.feed_category) || 0) * CATEGORY_WEIGHT;
```

**Value Range:**
- Base category preference values typically range from -5 to +10
  - Positive values indicate categories the user has positively engaged with
  - Negative values indicate categories the user has given thumbs down to
  - A frequently visited category might have a raw score of 3-10 before weight application
  - Categories the user has never interacted with will have a score of 0

**Practical Effects:**
- **Higher values** (e.g., 0.5+): Strongly favors content from categories the user frequently interacts with
- **Lower values** (e.g., 0.05): Allows more content diversity across different categories

#### `SOURCE_WEIGHT` (Default: 0.2)

Determines how strongly the system should favor sources the user frequently engages with.

**Base Score Calculation:**
```javascript
// Raw calculation before applying weight
const sourceScore = (sourceMap.get(article.feed_title) || 0) * SOURCE_WEIGHT;
```

**Value Range:**
- Base source preference values typically range from -5 to +10
  - Values are accumulated from user interactions with content from that source
  - A favorite source might have a raw score of 3-10 before weight application
  - Sources the user has never interacted with will have a score of 0
  - Sources that received many thumbs down will have negative scores

**Practical Effects:**
- **Higher values** (e.g., 0.5+): Creates a "bubble effect" where users primarily see content from their preferred sources
- **Lower values** (e.g., 0.05): Promotes source diversity in recommendations

#### `RECENCY_WEIGHT` (Default: 0.2)

Controls how much preference is given to recently published content.

**Base Score Calculation:**
```javascript
// Raw calculation before applying weight
const publishDate = new Date(article.published_at);
const daysSincePublished = (Date.now() - publishDate) / (1000 * 60 * 60 * 24);
const baseRecencyScore = Math.exp(-daysSincePublished / RECENCY_HALF_LIFE_DAYS);

// Final calculation with weight applied
recencyScore = baseRecencyScore * RECENCY_WEIGHT;
```

**Value Range:**
- Base recency score (before weight) always falls between 0 and 1
  - Brand new articles (0 days old): score = 1.0
  - Articles published RECENCY_HALF_LIFE_DAYS ago: score = 0.5
  - Older articles approach 0 as they age

**Practical Effects:**
- **Higher values** (e.g., 10+): Strongly prioritizes fresh content, with older articles quickly dropping in relevance
- **Lower values** (e.g., 0.1): Creates a more "timeless" feed where publish date matters less than other factors

## Time Decay Parameters

### `RECENCY_HALF_LIFE_DAYS` (Default: 7)

Controls how quickly the recency score decays for older articles.

**Base Score Calculation:**
```javascript
baseRecencyScore = Math.exp(-daysSincePublished / RECENCY_HALF_LIFE_DAYS);
```

The half-life defines how many days it takes for an article's recency score to drop to half its original value.

**Value Range:**
- Always between 0 and 1, with 1 being a brand new article and approaching 0 as the article ages

**Practical Effects:**
- **Shorter half-life** (e.g., 3 days): Creates a very time-sensitive system where content becomes "old" quickly
- **Longer half-life** (e.g., 14 days): Gives articles a longer "shelf life" in recommendations
- With a 7-day half-life:
  - A just-published article has a recency score of 1.0
  - A 7-day old article has a recency score of 0.5
  - A 14-day old article has a recency score of 0.25
  - A 21-day old article has a recency score of 0.125

### `INTERACTION_DECAY_DAYS` (Default: 30)

Controls how quickly user interactions lose importance over time when building the user profile.

**Base Score Calculation:**
```javascript
const interactionDate = new Date(interaction.created_at);
const daysSinceInteraction = (Date.now() - interactionDate) / (1000 * 60 * 60 * 24);
const decayFactor = Math.exp(-daysSinceInteraction / INTERACTION_DECAY_DAYS);

// The decay factor is then applied to the interaction weight
const weight = baseWeight * decayFactor;
```

**Value Range:**
- Decay factor is always between 0 and 1
  - New interactions have a factor of 1.0
  - Interactions INTERACTION_DECAY_DAYS days old have a factor of 0.5
  - Very old interactions approach 0

**Practical Effects:**
- **Shorter decay period** (e.g., 7 days): Creates a highly adaptive system that focuses on very recent user behavior
- **Longer decay period** (e.g., 60 days): Creates a more stable user profile that incorporates longer-term interests
- With a 30-day half-life:
  - A just-performed interaction has full weight
  - An interaction from 30 days ago has half weight
  - An interaction from 60 days ago has quarter weight

## Interaction Weights

These parameters determine how different types of user interactions affect their profile:

### `THUMBS_UP_WEIGHT` (Default: 5.0)

The weight assigned to a "thumbs up" interaction.

**Base Score Calculation:**
```javascript
// In buildKeywordProfile()
let baseWeight = 0;
switch (interaction.interaction_type) {
    case 'thumbs_up': baseWeight = THUMBS_UP_WEIGHT; break;
    // ...other cases
}
const weight = baseWeight * decayFactor;

// This weight is then added to the keyword, source, and category maps in the user profile
```

**Value Range:**
- Raw value is exactly 5.0 (default), modified only by the time decay factor
- After decay, the effective range is 0-5.0

**Practical Effects:**
- **Higher values**: Makes explicit positive feedback dramatically shift user profiles
- **Lower values**: Reduces the impact of explicit positive feedback

### `THUMBS_DOWN_WEIGHT` (Default: -3.0)

The weight assigned to a "thumbs down" interaction (negative value reduces keyword/source/category scores).

**Base Score Calculation:**
```javascript
// In buildKeywordProfile()
let baseWeight = 0;
switch (interaction.interaction_type) {
    case 'thumbs_down': baseWeight = THUMBS_DOWN_WEIGHT; break;
    // ...other cases
}
const weight = baseWeight * decayFactor;

// This negative weight is then added to the keyword, source, and category maps in the user profile
```

**Value Range:**
- Raw value is exactly -3.0 (default), modified only by the time decay factor
- After decay, the effective range is -3.0 to 0

**Practical Effects:**
- **More negative values** (e.g., -5.0): Makes negative feedback strongly reduce the likelihood of similar content
- **Less negative values** (e.g., -1.0): Makes negative feedback more of a gentle suggestion

### `CLICK_WEIGHT` (Default: 1.0)

The weight assigned when a user clicks on an article.

**Base Score Calculation:**
```javascript
// In buildKeywordProfile()
let baseWeight = 0;
switch (interaction.interaction_type) {
    case 'click': baseWeight = CLICK_WEIGHT; break;
    // ...other cases
}
const weight = baseWeight * decayFactor;

// This weight is then added to the keyword, source, and category maps in the user profile
```

**Value Range:**
- Raw value is exactly 1.0 (default), modified only by the time decay factor
- After decay, the effective range is 0-1.0

**Practical Effects:**
- **Higher values** (e.g., 3.0): Makes implicit engagement (clicks) a stronger signal
- **Lower values** (e.g., 0.5): Reduces the impact of casual browsing on recommendations

## Direct Interaction Score

Besides the user profile-based scores, there's also a direct interaction score that boosts articles the user has previously interacted with.

**Base Score Calculation:**
```javascript
// In SQL query in getArticles() and getRecommendedArticles()
(
    SELECT COALESCE(SUM(
        CASE 
            WHEN interaction_type = 'thumbs_up' THEN ${THUMBS_UP_WEIGHT} * EXP(-(julianday('now') - julianday(created_at))/${INTERACTION_DECAY_DAYS}.0)
            WHEN interaction_type = 'thumbs_down' THEN ${THUMBS_DOWN_WEIGHT} * EXP(-(julianday('now') - julianday(created_at))/${INTERACTION_DECAY_DAYS}.0)
            WHEN interaction_type = 'click' THEN ${CLICK_WEIGHT} * EXP(-(julianday('now') - julianday(created_at))/${INTERACTION_DECAY_DAYS}.0)
            ELSE 0 
        END
    ), 0)
    FROM article_interactions ai
    WHERE ai.article_id = a.id
) as direct_interaction_score
```

**Value Range:**
- Typically -3.0 to 5.0 depending on interaction types and recency
- Multiple interactions with the same article can accumulate

## Final Score Calculation

The final score for an article is calculated by combining all these weighted components:

```javascript
finalScore = keywordScore + sourceScore + categoryScore + recencyScore + directInteractionScore;
```

**Typical Total Score Range:**
- A highly recommended article might have a score of 5-15
- An average article might have a score of 0.5-5
- Articles the system would recommend against might have negative scores
- The actual range depends greatly on user interaction patterns and configured weights

## Balancing the Parameters

When tuning these parameters, consider:

1. **Temporal vs. Topical Balance**: Higher recency weights create a more "news-like" experience, while higher keyword weights create a more "interest-based" experience.

2. **Exploration vs. Exploitation**: Lower source/category weights enable more exploration, while higher values reinforce existing preferences.

3. **Explicit vs. Implicit Feedback**: The ratio between thumbs up/down weights and click weights controls how much explicit feedback matters compared to browsing behavior.

4. **Adaptation Speed**: The interaction decay value determines how quickly the system adapts to changing user interests.

For the best personalization experience, these parameters should be tuned based on user behavior analytics and feedback from actual usage.