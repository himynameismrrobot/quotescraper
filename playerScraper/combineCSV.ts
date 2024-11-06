import * as fs from 'fs';
import * as path from 'path';

const outputDir = path.join(__dirname, 'output');
const combinedFilePath = path.join(__dirname, 'output', 'all_players.csv');

// Read all CSV files from the output directory
const files = fs.readdirSync(outputDir).filter(file => file.endsWith('.csv'));

// Initialize array to store all rows
let allRows: string[] = ['Team Name,Player Name,Player Image URL']; // Header row

// Process each file
files.forEach(file => {
    if (file === 'all_players.csv') return; // Skip the combined file if it exists
    
    const filePath = path.join(outputDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Split into lines and remove header from all files except the first
    const lines = content.split('\n');
    const dataLines = lines.slice(1); // Skip header row
    
    // Add lines to our array
    allRows = allRows.concat(dataLines.filter(line => line.trim() !== ''));
});

// Write combined content to new file
fs.writeFileSync(combinedFilePath, allRows.join('\n'));

console.log(`Combined ${files.length} files into all_players.csv`);
console.log(`Total entries: ${allRows.length - 1}`); // Subtract 1 for header row