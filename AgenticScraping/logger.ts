import * as fs from 'fs';
import * as path from 'path';

interface OpenAILogEntry {
    timestamp: string;
    function_name: string;
    model: string;
    url: string;
    prompt: string;
    response?: any;
    error?: any;
}

class Logger {
    private logDir: string;
    private currentLogFile: string;

    constructor() {
        this.logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir);
        }
        this.currentLogFile = this.initializeLogFile();
    }

    private initializeLogFile(): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFile = path.join(this.logDir, `openai_logs_${timestamp}.json`);
        
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
}

// Export a singleton instance
export const logger = new Logger();
