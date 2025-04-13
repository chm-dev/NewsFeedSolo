/**
 * Migration script to normalize date formats in the database
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'storage', 'news.db');

async function migrateDates() {
    const db = new Database(DB_FILE);

    try {
        // Start a transaction
        db.prepare('BEGIN TRANSACTION').run();

        // Update published_at dates to ISO 8601
        const articles = db.prepare('SELECT id, published_at FROM articles').all();
        const updateStmt = db.prepare('UPDATE articles SET published_at = ? WHERE id = ?');

        let updated = 0;
        for (const article of articles) {
            if (article.published_at) {
                try {
                    const isoDate = new Date(article.published_at).toISOString();
                    updateStmt.run(isoDate, article.id);
                    updated++;
                } catch (error) {
                    console.error(`Error updating date for article ${article.id}:`, error);
                }
            }
        }

        // Update stored_at dates to ISO 8601
        db.prepare(`
            UPDATE articles 
            SET stored_at = datetime(stored_at)
            WHERE stored_at NOT LIKE '%T%'
        `).run();

        // Commit the transaction
        db.prepare('COMMIT').run();

        console.log(`Successfully normalized dates for ${updated} articles`);
    } catch (error) {
        // Rollback on error
        db.prepare('ROLLBACK').run();
        console.error('Error during migration:', error);
    } finally {
        db.close();
    }
}

// Run the migration
migrateDates().catch(console.error);