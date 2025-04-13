/**
 * Cleanup script to keep only a few sample articles per category
 */
import { promises as fs } from 'fs';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const ARTICLES_PER_CATEGORY = 3; // Keep only 3 articles per category

async function cleanup() {
    try {
        // Get all category directories
        const categoryDirs = await fs.readdir(path.join(STORAGE_DIR, 'development'));
        
        for (const dateDir of categoryDirs) {
            const datePath = path.join(STORAGE_DIR, 'development', dateDir);
            const stats = await fs.stat(datePath);
            
            if (!stats.isDirectory()) continue;
            
            // Get all source directories
            const sourceDirs = await fs.readdir(datePath);
            
            for (const sourceDir of sourceDirs) {
                const sourcePath = path.join(datePath, sourceDir);
                const stats = await fs.stat(sourcePath);
                
                if (!stats.isDirectory() || sourceDir === 'metadata.json') continue;
                
                // Get all articles in the source directory
                const articles = await fs.readdir(sourcePath);
                const articleFiles = articles.filter(f => f.endsWith('.json'));
                
                // Keep only the first few articles
                const toDelete = articleFiles.slice(ARTICLES_PER_CATEGORY);
                
                // Delete excess articles
                for (const file of toDelete) {
                    await fs.unlink(path.join(sourcePath, file));
                    console.log(`Deleted: ${path.join(sourceDir, file)}`);
                }
                
                console.log(`Kept ${ARTICLES_PER_CATEGORY} articles in ${sourceDir}`);
            }
        }
        
        console.log('Cleanup complete!');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

cleanup();