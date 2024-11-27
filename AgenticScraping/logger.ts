import * as fs from 'fs';
import * as path from 'path';

interface OpenAILogEntry {
    timestamp: string;
    function_name: string;
    model?: string;
    url?: string;
    prompt?: string;
    response?: any;
    error?: any;
    quote?: any;
    article_metadata?: any;
}

class Logger {
    private logDir: string;
    private currentLogFile: string;
    private errorLogFile: string;

    constructor() {
        this.logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir);
        }
        this.currentLogFile = this.initializeLogFile('openai_logs');
        this.errorLogFile = this.initializeLogFile('error_logs');
    }

    private initializeLogFile(prefix: string): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFile = path.join(this.logDir, `${prefix}_${timestamp}.json`);
        
        // Initialize the file with an empty array
        fs.writeFileSync(logFile, '[]');
        return logFile;
    }

    public logOpenAICall(entry: Omit<OpenAILogEntry, 'timestamp'>) {
        try {
            const logEntry: OpenAILogEntry = {
                timestamp: new Date().toISOString(),
                ...entry
            };

            // Read existing logs
            const logs = JSON.parse(fs.readFileSync(this.currentLogFile, 'utf-8'));
            
            // Add new log
            logs.push(logEntry);

            // Write back to file
            fs.writeFileSync(this.currentLogFile, JSON.stringify(logs, null, 2));
        } catch (error) {
            console.error('Error writing to log file:', error);
        }
    }

    public logError(entry: Omit<OpenAILogEntry, 'timestamp'>) {
        try {
            const logEntry: OpenAILogEntry = {
                timestamp: new Date().toISOString(),
                ...entry
            };

            // Read existing logs
            const logs = JSON.parse(fs.readFileSync(this.errorLogFile, 'utf-8'));
            
            // Add new log
            logs.push(logEntry);

            // Write back to file
            fs.writeFileSync(this.errorLogFile, JSON.stringify(logs, null, 2));
        } catch (error) {
            console.error('Error writing to error log file:', error);
        }
    }
}

// Export a singleton instance
export const logger = new Logger();
