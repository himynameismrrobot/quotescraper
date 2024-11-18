import { createClient } from '@/utils/supabase/client'
import { Database } from '@/types/supabase'

interface SchedulerConfig {
  enabled: boolean;
  frequencyHours: number;
  lastRunTime?: Date;
}

class SchedulerService {
  private static instance: SchedulerService;
  private supabase;
  private config: SchedulerConfig = {
    enabled: false,
    frequencyHours: 24,
  };
  private timer: NodeJS.Timeout | null = null;

  private constructor() {
    this.supabase = createClient();
    this.loadConfig();
  }

  public static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  private async loadConfig() {
    const { data: config } = await this.supabase
      .from('agent_config')
      .select('*')
      .single();

    if (config) {
      this.config = {
        enabled: config.auto_run_enabled,
        frequencyHours: config.run_frequency_hours,
        lastRunTime: config.last_run_time,
      };
    }

    if (this.config.enabled) {
      this.startScheduler();
    }
  }

  private async saveConfig() {
    await this.supabase
      .from('agent_config')
      .upsert({
        auto_run_enabled: this.config.enabled,
        run_frequency_hours: this.config.frequencyHours,
        last_run_time: this.config.lastRunTime?.toISOString(),
      });
  }

  public async updateConfig(config: Partial<SchedulerConfig>) {
    this.config = { ...this.config, ...config };
    await this.saveConfig();

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.config.enabled) {
      this.startScheduler();
    }
  }

  private startScheduler() {
    const now = new Date();
    const lastRun = this.config.lastRunTime ? new Date(this.config.lastRunTime) : new Date(0);
    const nextRun = new Date(lastRun.getTime() + this.config.frequencyHours * 60 * 60 * 1000);
    const delay = Math.max(0, nextRun.getTime() - now.getTime());

    this.timer = setTimeout(async () => {
      await this.runCrawler();
      this.startScheduler(); // Schedule next run
    }, delay);
  }

  private async runCrawler() {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session) {
        console.error('No session available for scheduled run');
        return;
      }

      const response = await fetch('/api/admin/agents/crawler', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scheduled: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Scheduled run failed: ${response.statusText}`);
      }

      this.config.lastRunTime = new Date();
      await this.saveConfig();
    } catch (error) {
      console.error('Error in scheduled run:', error);
    }
  }

  public getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  public stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export const schedulerService = SchedulerService.getInstance();
