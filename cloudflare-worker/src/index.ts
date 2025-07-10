import { RSSManager } from './rss/manager';
import { TelegramBot } from './bots/telegram';

// 环境变量接口定义
interface Env {
  RSS_STORAGE: DurableObjectNamespace;
  SITEMAP_KV: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_TARGET_CHAT: string;
}

export default {
  // 处理HTTP请求（Webhook和API）
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Telegram webhook 处理
    if (url.pathname.includes('/telegram-webhook')) {
      return await handleTelegramWebhook(request, env);
    }
    
    // API 处理
    if (url.pathname.startsWith('/api/')) {
      return await handleAPI(request, env);
    }
    
    return new Response('Sitemap Diff Worker is running!', { status: 200 });
  },
  
  // 定时任务处理
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Running scheduled task');
    
    // 获取RSS管理器实例
    const rssManager = new RSSManager(env.SITEMAP_KV, env.RSS_STORAGE);
    const telegramBot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_TARGET_CHAT);
    
    // 获取所有feeds并检查更新
    const feeds = await rssManager.getFeeds();
    console.log(`检查订阅源更新，共 ${feeds.length} 个订阅`);
    
    // 用于存储所有新增的URL
    const allNewUrls: string[] = [];
    
    for (const url of feeds) {
      console.log(`正在检查订阅源: ${url}`);
      try {
        // 下载并比较sitemap
        const { success, errorMsg, newUrls } = await rssManager.checkFeed(url);
        
        if (success) {
          // 发送通知
          await telegramBot.sendUpdateNotification(url, newUrls);
          if (newUrls.length > 0) {
            console.log(`订阅源 ${url} 更新成功，发现 ${newUrls.length} 个新URL，已发送通知。`);
            allNewUrls.push(...newUrls);
          } else {
            console.log(`订阅源 ${url} 更新成功，无新增URL，已发送通知。`);
          }
        } else {
          console.warn(`订阅源 ${url} 更新失败: ${errorMsg}`);
        }
      } catch (error) {
        console.error(`处理订阅源 ${url} 时出错:`, error);
      }
    }
    
    // 发送关键词汇总
    if (allNewUrls.length > 0) {
      await telegramBot.sendKeywordsSummary(allNewUrls);
    }
    
    console.log('所有订阅源检查完成');
  }
};

// 处理Telegram Webhook
async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  try {
    const update = await request.json();
    const telegramBot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_TARGET_CHAT);
    const rssManager = new RSSManager(env.SITEMAP_KV, env.RSS_STORAGE);
    
    // 处理命令
    if (update.message && update.message.text && update.message.text.startsWith('/')) {
      const command = update.message.text.split(' ')[0].substring(1);
      const args = update.message.text.split(' ').slice(1);
      
      switch (command) {
        case 'start':
        case 'help':
          await telegramBot.sendHelpMessage(update.message.chat.id);
          break;
        case 'rss':
          if (args[0] === 'list') {
            const feeds = await rssManager.getFeeds();
            await telegramBot.sendMessage(update.message.chat.id, 
              `监控的sitemap列表 (${feeds.length}):\n${feeds.join('\n')}`);
          } else if (args[0] === 'add' && args[1]) {
            const result = await rssManager.addFeed(args[1]);
            await telegramBot.sendMessage(update.message.chat.id, 
              result.success ? `成功添加sitemap: ${args[1]}` : `添加失败: ${result.errorMsg}`);
          } else if (args[0] === 'del' && args[1]) {
            const result = await rssManager.removeFeed(args[1]);
            await telegramBot.sendMessage(update.message.chat.id, 
              result.success ? `成功删除sitemap: ${args[1]}` : `删除失败: ${result.errorMsg}`);
          }
          break;
        case 'news':
          const feeds = await rssManager.getFeeds();
          const allNewUrls: string[] = [];
          
          for (const url of feeds) {
            const { newUrls } = await rssManager.compareCurrentAndLatest(url);
            allNewUrls.push(...newUrls);
          }
          
          await telegramBot.sendKeywordsSummary(allNewUrls);
          await telegramBot.sendMessage(update.message.chat.id, 
            `已手动触发关键词汇总，共发现 ${allNewUrls.length} 个新URL。`);
          break;
      }
    }
    
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('处理Telegram webhook时出错:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// 处理API请求
async function handleAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  
  if (url.pathname === '/api/feeds' && request.method === 'GET') {
    const rssManager = new RSSManager(env.SITEMAP_KV, env.RSS_STORAGE);
    const feeds = await rssManager.getFeeds();
    return new Response(JSON.stringify(feeds), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Not Found', { status: 404 });
}

// 定义Durable Object存储类
export class RSSStorage {
  state: DurableObjectState;
  
  constructor(state: DurableObjectState) {
    this.state = state;
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path === '/feeds' && request.method === 'GET') {
      const feeds = await this.state.storage.get('feeds') || [];
      return new Response(JSON.stringify(feeds), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (path === '/feeds' && request.method === 'POST') {
      const data = await request.json();
      await this.state.storage.put('feeds', data);
      return new Response('OK');
    }
    
    return new Response('Not Found', { status: 404 });
  }
} 