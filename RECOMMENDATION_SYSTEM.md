# News Recommendation System: Scoring Parameters Explained

This document explains the recommendation system parameters available in the `.env` file and how they impact article scoring and recommendations.

## Table of Contents

- [News Recommendation System: Scoring Parameters Explained](#news-recommendation-system-scoring-parameters-explained)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [User Profile Keywords and Time Decay](#user-profile-keywords-and-time-decay)
    - [How Profile Keywords Work](#how-profile-keywords-work)
    - [Time Decay Mechanism](#time-decay-mechanism)
    - [Keyword Filtering and Cutoffs](#keyword-filtering-and-cutoffs)
  - [Scoring Weights](#scoring-weights)
    - [Factor Weights](#factor-weights)
      - [`KEYWORD_MATCH_WEIGHT` (Default: 0.4)](#keyword_match_weight-default-04)
      - [`CATEGORY_WEIGHT` (Default: 0.2)](#category_weight-default-02)
      - [`SOURCE_WEIGHT` (Default: 0.2)](#source_weight-default-02)
      - [`RECENCY_WEIGHT` (Default: 0.2)](#recency_weight-default-02)
  - [Time Decay Parameters](#time-decay-parameters)
    - [`RECENCY_HALF_LIFE_DAYS` (Default: 7)](#recency_half_life_days-default-7)
    - [`INTERACTION_DECAY_DAYS` (Default: 30)](#interaction_decay_days-default-30)
    - [`KEYWORD_PROFILE_MIN_WEIGHT` (Default: 0.2)](#keyword_profile_min_weight-default-02)
  - [Interaction Weights](#interaction-weights)
    - [`THUMBS_UP_WEIGHT` (Default: 5.0)](#thumbs_up_weight-default-50)
    - [`THUMBS_DOWN_WEIGHT` (Default: -3.0)](#thumbs_down_weight-default--30)
    - [`CLICK_WEIGHT` (Default: 1.0)](#click_weight-default-10)
  - [Direct Interaction Score](#direct-interaction-score)
  - [Final Score Calculation](#final-score-calculation)
  - ["Just in" BOOST Parameters](#just-in-boost-parameters)
    - [`JUST_IN_BOOST_WEIGHT` (Default: 5.0)](#just_in_boost_weight-default-50)
    - [`JUST_IN_MIN_KEYWORD_MATCHES` (Default: 2)](#just_in_min_keyword_matches-default-2)
    - [`JUST_IN_MAX_VIEWS` (Default: 5)](#just_in_max_views-default-5)
  - [View Fatigue Parameters](#view-fatigue-parameters)
    - [`VIEW_FATIGUE_FACTOR` (Default: 0.2)](#view_fatigue_factor-default-02)
  - [Final Score Calculation](#final-score-calculation-1)
  - [Balancing the Parameters](#balancing-the-parameters)

## Overview

The recommendation system combines several factors to rank articles for users:

1. **Keyword Matching**: How well article keywords match the user's interest profile
2. **Category Preferences**: How much the user interacts with specific content categories
3. **Source Preferences**: How much the user interacts with specific content sources 
4. **Article Recency**: How recently an article was published
5. **Direct Interactions**: Whether the user has directly interacted with the article
6. **View Fatigue**: Gradually decreases ranking as articles accumulate more views
7. **"Just In" Boost**: Temporarily boosts new articles that match user interests

Each of these factors can be tuned through environment variables to customize the recommendation algorithm.

## User Profile Keywords and Time Decay

### How Profile Keywords Work

The system builds a user profile based on interactions with content. Each time a user interacts with an article (clicking, giving thumbs up/down), the keywords from that article are added to the user's profile with weights determined by:

1. **Interaction type**: Thumbs up (+5.0), clicks (+1.0), or thumbs down (-3.0)
2. **Time decay**: More recent interactions have stronger influence
3. **Accumulation**: Multiple interactions with articles containing the same keyword strengthen that keyword's weight

Over time, the system builds a weighted list of keywords representing the user's interests. Articles are then scored based on how well their keywords match the user's profile.

### Time Decay Mechanism

All user interactions naturally decay over time using an exponential decay function:

```
weight = baseWeight * Math.exp(-daysSinceInteraction / INTERACTION_DECAY_DAYS)
```

This means:
- A keyword from a recent interaction has nearly full weight
- After `INTERACTION_DECAY_DAYS` days (default: 30), its influence drops to 50%
- After 60 days, it drops to 25%, and so on

This decay ensures your recommendations adapt to changing interests while still respecting long-term preferences.

### Keyword Filtering and Cutoffs

The system applies two levels of filtering to maintain a clean user profile:

1. **Zero threshold**: Keywords with non-positive weights (≤0) are automatically removed
2. **Minimum weight threshold**: Keywords below `KEYWORD_PROFILE_MIN_WEIGHT` (default: 0.2) are filtered out

These filters help prevent profile pollution from minor interactions or negative feedback, ensuring only meaningful preferences influence recommendations.

## Scoring Weights

### Factor Weights

These parameters control how much each component contributes to the final article score:

#### `KEYWORD_MATCH_WEIGHT` (Default: 0.4)

Controls the importance of keyword matching between articles and user profiles.

<details>
<summary><strong>Base Score Calculation</strong> (click to expand)</summary>

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
</details>

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

<details>
<summary><strong>Base Score Calculation</strong> (click to expand)</summary>

```javascript
// Raw calculation before applying weight
const categoryScore = (categoryMap.get(article.feed_category) || 0) * CATEGORY_WEIGHT;
```
</details>

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

<details>
<summary><strong>Base Score Calculation</strong> (click to expand)</summary>

```javascript
// Raw calculation before applying weight
const sourceScore = (sourceMap.get(article.feed_title) || 0) * SOURCE_WEIGHT;
```
</details>

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

<details>
<summary><strong>Base Score Calculation</strong> (click to expand)</summary>

```javascript
// Raw calculation before applying weight
const publishDate = new Date(article.published_at);
const daysSincePublished = (Date.now() - publishDate) / (1000 * 60 * 60 * 24);
const baseRecencyScore = Math.exp(-daysSincePublished / RECENCY_HALF_LIFE_DAYS);

// Final calculation with weight applied
recencyScore = baseRecencyScore * RECENCY_WEIGHT;
```
</details>

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

<details>
<summary><strong>Base Score Calculation</strong> (click to expand)</summary>

```javascript
baseRecencyScore = Math.exp(-daysSincePublished / RECENCY_HALF_LIFE_DAYS);
```
</details>

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

<details>
<summary><strong>Base Score Calculation</strong> (click to expand)</summary>

```javascript
const interactionDate = new Date(interaction.created_at);
const daysSinceInteraction = (Date.now() - interactionDate) / (1000 * 60 * 60 * 24);
const decayFactor = Math.exp(-daysSinceInteraction / INTERACTION_DECAY_DAYS);

// The decay factor is then applied to the interaction weight
const weight = baseWeight * decayFactor;
```
</details>

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

### `KEYWORD_PROFILE_MIN_WEIGHT` (Default: 0.2)

Controls the minimum weight threshold for keywords in the user profile. Keywords with weights below this value are removed from the profile.

<details>
<summary><strong>Base Score Calculation</strong> (click to expand)</summary>

```javascript
// In buildKeywordProfile()
const sortMapByWeight = map => 
    [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, weight]) => ({ name, weight }))
        .filter(item => item.weight >= KEYWORD_PROFILE_MIN_WEIGHT);

const result = {
    keywords: sortMapByWeight(profile.keywords),
    sources: sortMapByWeight(profile.sources),
    categories: sortMapByWeight(profile.categories)
};
```
</details>

**Value Range:**
- Any positive number, typically between 0.1 and 1.0
- Lower values retain more low-weight keywords
- Higher values create a more focused profile with only strong preferences

**Practical Effects:**
- **Lower values** (e.g., 0.1): Creates a more diverse recommendation profile that includes marginal interests
- **Higher values** (e.g., 0.5+): Creates a more focused profile that only includes strong interests
- This acts as a "noise filter" to remove weakly weighted keywords from influencing recommendations
- Helps prevent keyword accumulation from minor or decayed interactions

## Interaction Weights

These parameters determine how different types of user interactions affect their profile:

### `THUMBS_UP_WEIGHT` (Default: 5.0)

The weight assigned to a "thumbs up" interaction.

<details>
<summary><strong>Base Score Calculation</strong> (click to expand)</summary>

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
</details>

**Value Range:**
- Raw value is exactly 5.0 (default), modified only by the time decay factor
- After decay, the effective range is 0-5.0

**Practical Effects:**
- **Higher values**: Makes explicit positive feedback dramatically shift user profiles
- **Lower values**: Reduces the impact of explicit positive feedback

### `THUMBS_DOWN_WEIGHT` (Default: -3.0)

The weight assigned to a "thumbs down" interaction (negative value reduces keyword/source/category scores).

<details>
<summary><strong>Base Score Calculation</strong> (click to expand)</summary>

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
</details>

**Value Range:**
- Raw value is exactly -3.0 (default), modified only by the time decay factor
- After decay, the effective range is -3.0 to 0

**Practical Effects:**
- **More negative values** (e.g., -5.0): Makes negative feedback strongly reduce the likelihood of similar content
- **Less negative values** (e.g., -1.0): Makes negative feedback more of a gentle suggestion

### `CLICK_WEIGHT` (Default: 1.0)

The weight assigned when a user clicks on an article.

<details>
<summary><strong>Base Score Calculation</strong> (click to expand)</summary>

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
</details>

**Value Range:**
- Raw value is exactly 1.0 (default), modified only by the time decay factor
- After decay, the effective range is 0-1.0

**Practical Effects:**
- **Higher values** (e.g., 3.0): Makes implicit engagement (clicks) a stronger signal
- **Lower values** (e.g., 0.5): Reduces the impact of casual browsing on recommendations

## Direct Interaction Score

Besides the user profile-based scores, there's also a direct interaction score that boosts articles the user has previously interacted with.

<details>
<summary><strong>Base Score Calculation</strong> (click to expand)</summary>

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
</details>

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

## "Just in" BOOST Parameters

The "Just in" BOOST feature gives temporary prominence to new articles that match the user's interests, with the boost decaying as the article is viewed more times.

### `JUST_IN_BOOST_WEIGHT` (Default: 5.0)

Controls the maximum initial boost given to new articles that match the user's profile.

<details>
<summary><strong>Base Score Calculation</strong> (click to expand)</summary>

```javascript
// In scoreArticle function
let justInBoost = 0;
if (
  article.view_count < JUST_IN_MAX_VIEWS && 
  keywordMatchCount >= JUST_IN_MIN_KEYWORD_MATCHES
) {
  // Linear decay based on views
  const viewDecayFactor = 1 - (article.view_count / JUST_IN_MAX_VIEWS);
  justInBoost = JUST_IN_BOOST_WEIGHT * viewDecayFactor;
}
```
</details>

**Value Range:**
- Initial boost starts at the full JUST_IN_BOOST_WEIGHT value
- Decays linearly with each view until reaching 0 after JUST_IN_MAX_VIEWS

**Practical Effects:**
- **Higher values** (e.g., 10.0): Creates dramatic temporary promotion of new articles
- **Lower values** (e.g., 2.0): Creates subtle "freshness" nudges in the feed

### `JUST_IN_MIN_KEYWORD_MATCHES` (Default: 2)

The minimum number of keyword matches required between an article and the user profile before the "Just in" BOOST is applied.

**Value Range:**
- Positive integer, typically 1-5
- Should be set based on the average number of keywords per article

**Practical Effects:**
- **Higher values** (e.g., 4+): More selective, only boosting highly relevant articles
- **Lower values** (e.g., 1): More inclusive, boosting more articles with lower relevance threshold

### `JUST_IN_MAX_VIEWS` (Default: 5)

Controls how quickly the "Just in" BOOST decays as the article is viewed.

**Value Range:**
- Positive integer, typically 3-10
- Each view reduces the boost by 1/JUST_IN_MAX_VIEWS of its original value

**Practical Effects:**
- **Higher values** (e.g., 10): Creates a more gradual decay, with articles remaining boosted longer
- **Lower values** (e.g., 3): Creates a sharper decay, with articles quickly returning to their base ranking

## View Fatigue Parameters

### `VIEW_FATIGUE_FACTOR` (Default: 0.2)

Controls how strongly articles are penalized for repeated views, ensuring that even highly relevant content gradually moves down in the feed as it's viewed repeatedly.

<details>
<summary><strong>Base Score Calculation</strong> (click to expand)</summary>

```javascript
// In scoreArticle function
let viewFatigueScore = 0;
const viewCount = article.view_count || 0;
if (viewCount > 0) {
    // Apply increasing penalty based on view count
    viewFatigueScore = -Math.pow(viewCount, 1.5) * VIEW_FATIGUE_FACTOR;
}

// This negative score is then added to the article's final score
```
</details>

**Value Range:**
- Calculated as a negative value that grows stronger with more views
- Uses a power function (1.5 exponent) to create an accelerating penalty
- For default factor (0.2):
  - 1 view: -0.2 (minimal impact)
  - 2 views: -0.57 (small impact)
  - 5 views: -2.24 (noticeable impact)
  - 10 views: -6.32 (significant impact)
  - 20 views: -17.9 (likely pushes to bottom of feed)

**Practical Effects:**
- **Higher values** (e.g., 0.5): Aggressively pushes viewed content down, creating very high content turnover
- **Lower values** (e.g., 0.1): More gently reduces prominence of viewed content, allowing good matches to remain visible longer
- Ensures feed stays fresh by gradually removing repeatedly viewed content
- Creates space for new content discovery while maintaining relevance-based ordering
- Prevents the "same articles" problem in personalized feeds

## Final Score Calculation

The final score for an article is calculated by combining all these weighted components:

```javascript
finalScore = keywordScore + sourceScore + categoryScore + recencyScore + directInteractionScore + justInBoost + viewFatigueScore;
```

## Balancing the Parameters

When tuning these parameters, consider:

1. **Temporal vs. Topical Balance**: Higher recency weights create a more "news-like" experience, while higher keyword weights create a more "interest-based" experience.

2. **Exploration vs. Exploitation**: Lower source/category weights enable more exploration, while higher values reinforce existing preferences.

3. **Explicit vs. Implicit Feedback**: The ratio between thumbs up/down weights and click weights controls how much explicit feedback matters compared to browsing behavior.

4. **Adaptation Speed**: The interaction decay value determines how quickly the system adapts to changing user interests.

5. **Feed Freshness vs. Stability**: Higher JUST_IN_BOOST_WEIGHT and JUST_IN_MAX_VIEWS create more dynamic feeds, while lower values maintain more consistent rankings.

For the best personalization experience, these parameters should be tuned based on user behavior analytics and feedback from actual usage.