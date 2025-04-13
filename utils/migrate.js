/**
 * Migration script to move articles from JSON files to SQLite database
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { storeArticle, initializeDatabase } from '../src/database.js';

// Get the directory name properly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use proper path resolution from utils directory
const STORAGE_DIR = path.join(__dirname, '..', 'storage');

async function* walkDir(dir) {
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
        const res = path.resolve(dir, file.name);
        if (file.isDirectory()) {
            yield* walkDir(res);
        } else if (file.name.endsWith('.json') && file.name !== 'metadata.json') {
            yield res;
        }
    }
}

async function migrateToDatabase() {
    console.log('Initializing database...');
    await initializeDatabase();

    let processed = 0;
    let successful = 0;
    let failed = 0;

    try {
        for await (const filePath of walkDir(STORAGE_DIR)) {
            try {
                processed++;
                const content = await fs.readFile(filePath, 'utf-8');
                const article = JSON.parse(content);
                
                const result = storeArticle(article);
                
                if (result.success) {
                    successful++;
                    console.log(`Migrated article: ${article.title}`);
                } else {
                    failed++;
                    console.error(`Failed to migrate article: ${article.title}`, result.error);
                }
            } catch (error) {
                failed++;
                console.error(`Error processing file ${filePath}:`, error);
            }
        }

        console.log('\nMigration complete!');
        console.log(`Processed: ${processed} articles`);
        console.log(`Successful: ${successful} articles`);
        console.log(`Failed: ${failed} articles`);

    } catch (error) {
        console.error('Migration failed:', error);
    }
}

// Run the migration
migrateToDatabase().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});