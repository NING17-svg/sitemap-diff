export class TelegramBot {
  private token: string;
  private targetChat: string;
  private apiBaseUrl: string;

  constructor(token: string, targetChat: string) {
    this.token = token;
    this.targetChat = targetChat;
    this.apiBaseUrl = `https://api.telegram.org/bot${token}`;
  }

  /**
   * 发送消息
   */
  async sendMessage(chatId: string | number, text: string, options: any = {}): Promise<any> {
    const url = `${this.apiBaseUrl}/sendMessage`;
    const body = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...options
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('发送Telegram消息失败:', error);
      throw error;
    }
  }

  /**
   * 发送帮助消息
   */
  async sendHelpMessage(chatId: string | number): Promise<any> {
    const helpText = `
<b>站点监控机器人</b>

<b>可用命令:</b>
/help - 显示此帮助信息
/rss list - 显示所有监控的sitemap列表
/rss add URL - 添加新的sitemap监控（URL必须以sitemap.xml结尾）
/rss del URL - 删除指定的sitemap监控
/news - 手动触发关键词汇总的生成和发送
`;

    return await this.sendMessage(chatId, helpText);
  }

  /**
   * 发送更新通知
   */
  async sendUpdateNotification(url: string, newUrls: string[]): Promise<any> {
    let message = `<b>站点更新通知</b>\n\n`;
    message += `<b>站点:</b> ${url}\n`;
    
    if (newUrls.length > 0) {
      message += `<b>新增URL数量:</b> ${newUrls.length}\n\n`;
      
      // 最多显示10个URL
      const displayUrls = newUrls.slice(0, 10);
      message += `<b>新增URL:</b>\n`;
      displayUrls.forEach(url => {
        message += `- ${url}\n`;
      });
      
      if (newUrls.length > 10) {
        message += `\n... 以及 ${newUrls.length - 10} 个更多URL`;
      }
    } else {
      message += `<b>无新增URL</b>`;
    }
    
    return await this.sendMessage(this.targetChat, message);
  }

  /**
   * 发送关键词汇总
   */
  async sendKeywordsSummary(urls: string[]): Promise<any> {
    if (urls.length === 0) {
      return null;
    }
    
    let message = `<b>新增内容关键词汇总</b>\n\n`;
    message += `<b>新增URL总数:</b> ${urls.length}\n\n`;
    
    // 提取所有URL的域名
    const domains = new Map<string, number>();
    urls.forEach(url => {
      try {
        const domain = new URL(url).hostname;
        domains.set(domain, (domains.get(domain) || 0) + 1);
      } catch (error) {
        console.error(`解析URL失败: ${url}`, error);
      }
    });
    
    // 添加域名统计
    message += `<b>域名分布:</b>\n`;
    Array.from(domains.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([domain, count]) => {
        message += `- ${domain}: ${count}个URL\n`;
      });
    
    // 最多显示20个URL
    if (urls.length > 0) {
      message += `\n<b>部分URL示例:</b>\n`;
      urls.slice(0, 20).forEach(url => {
        message += `- ${url}\n`;
      });
      
      if (urls.length > 20) {
        message += `\n... 以及 ${urls.length - 20} 个更多URL`;
      }
    }
    
    return await this.sendMessage(this.targetChat, message);
  }
} 