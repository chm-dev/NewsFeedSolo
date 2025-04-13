/**
 * OPML Parser Module
 * 
 * This module is responsible for parsing OPML files and extracting feed information.
 * It reads OPML files from the specified directory, parses them, and returns
 * structured data about the feeds they contain.
 */

import { promises as fs } from 'fs';
import path from 'path';
import xml2js from 'xml2js';

/**
 * Parse an OPML file and extract feed information
 * @param {string} filePath - Path to the OPML file
 * @returns {Promise<Array>} - Array of feed objects with category, title, url, etc.
 */
async function parseOpmlFile(filePath) {
  try {
    // Read the OPML file
    const fileContent = await fs.readFile(filePath, 'utf-8');
    
    // Get the category from the filename (without extension)
    const category = path.basename(filePath, path.extname(filePath));
    
    // Parse the XML content
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(fileContent);
    
    // Extract feeds from the parsed content
    const feeds = [];
    
    // Process outlines in the OPML body
    if (result.opml && result.opml.body && result.opml.body[0].outline) {
      // Handle nested outlines (common in OPML files)
      const processOutlines = (outlines, parentTitle = null) => {
        outlines.forEach(outline => {
          // Check if this is a feed outline (has xmlUrl)
          if (outline.$ && outline.$.xmlUrl) {
            feeds.push({
              category,
              title: outline.$.title || outline.$.text || 'Untitled Feed',
              xmlUrl: outline.$.xmlUrl,
              htmlUrl: outline.$.htmlUrl || null,
              parentTitle
            });
          }
          
          // Process nested outlines if they exist
          if (outline.outline) {
            processOutlines(outline.outline, outline.$.title || outline.$.text);
          }
        });
      };
      
      processOutlines(result.opml.body[0].outline);
    }
    
    return feeds;
  } catch (error) {
    console.error(`Error parsing OPML file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Read all OPML files from a directory and parse them
 * @param {string} opmlDir - Directory containing OPML files
 * @returns {Promise<Array>} - Array of feed objects from all OPML files
 */
async function parseOpmlDirectory(opmlDir) {
  try {
    // Read all files in the directory
    const files = await fs.readdir(opmlDir);
    
    // Filter for .opml files
    const opmlFiles = files.filter(file => path.extname(file).toLowerCase() === '.opml');
    
    // Parse each OPML file and combine the results
    const feedPromises = opmlFiles.map(file => parseOpmlFile(path.join(opmlDir, file)));
    const feedArrays = await Promise.all(feedPromises);
    
    // Flatten the array of arrays into a single array of feeds
    return feedArrays.flat();
  } catch (error) {
    console.error(`Error parsing OPML directory ${opmlDir}:`, error);
    throw error;
  }
}

export {
  parseOpmlFile,
  parseOpmlDirectory
};
