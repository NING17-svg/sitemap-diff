// 不使用 xml2js，改用更简单的方法解析 XML
// import { parseString } from 'xml2js';

export class RSSManager {
  private sitemapKV: KVNamespace;
  private rssStorage: DurableObjectNamespace;

  constructor(sitemapKV: KVNamespace, rssStorage: DurableObjectNamespace) {
    this.sitemapKV = sitemapKV;
    this.rssStorage = rssStorage;
  }

  /**
   * 获取所有监控的feeds
   */
  async getFeeds(): Promise<string[]> {
    try {
      const id = this.rssStorage.idFromName('feeds');
      const obj = this.rssStorage.get(id);
      const response = await obj.fetch('http://feeds');
      const feeds = await response.json() as string[];
      return feeds || [];
    } catch (error) {
      console.error('读取feeds失败', error);
      return [];
    }
  }

  /**
   * 添加sitemap监控
   */
  async addFeed(url: string): Promise<{ success: boolean; errorMsg: string; newUrls: string[] }> {
    try {
      console.log(`尝试添加sitemap监控: ${url}`);

      // 验证是否已存在
      const feeds = await this.getFeeds();
      
      // 下载sitemap
      const { success, errorMsg, newUrls } = await this.downloadSitemap(url);
      
      if (!success) {
        return { success: false, errorMsg, newUrls: [] };
      }

      if (!feeds.includes(url)) {
        // 添加到监控列表
        feeds.push(url);
        const id = this.rssStorage.idFromName('feeds');
        const obj = this.rssStorage.get(id);
        await obj.fetch('http://feeds', {
          method: 'POST',
          body: JSON.stringify(feeds)
        });
        console.log(`成功添加sitemap监控: ${url}`);
      } else {
        console.log(`已存在的feed更新成功: ${url}`);
      }
      
      return { success: true, errorMsg: '', newUrls };
    } catch (error) {
      console.error(`添加sitemap监控失败: ${url}`, error);
      return { success: false, errorMsg: `添加失败: ${error}`, newUrls: [] };
    }
  }

  /**
   * 删除RSS订阅
   */
  async removeFeed(url: string): Promise<{ success: boolean; errorMsg: string }> {
    try {
      console.log(`尝试删除RSS订阅: ${url}`);
      const feeds = await this.getFeeds();

      if (!feeds.includes(url)) {
        console.warn(`RSS订阅不存在: ${url}`);
        return { success: false, errorMsg: '该RSS订阅不存在' };
      }

      const newFeeds = feeds.filter(feed => feed !== url);
      const id = this.rssStorage.idFromName('feeds');
      const obj = this.rssStorage.get(id);
      await obj.fetch('http://feeds', {
        method: 'POST',
        body: JSON.stringify(newFeeds)
      });
      
      console.log(`成功删除RSS订阅: ${url}`);
      return { success: true, errorMsg: '' };
    } catch (error) {
      console.error(`删除RSS订阅失败: ${url}`, error);
      return { success: false, errorMsg: `删除失败: ${error}` };
    }
  }

  /**
   * 检查feed更新
   */
  async checkFeed(url: string): Promise<{ success: boolean; errorMsg: string; newUrls: string[] }> {
    return await this.downloadSitemap(url);
  }

  /**
   * 下载并保存sitemap文件
   */
  async downloadSitemap(url: string): Promise<{ success: boolean; errorMsg: string; newUrls: string[] }> {
    try {
      console.log(`尝试下载sitemap: ${url}`);
      
      // 获取域名作为键名
      const domain = new URL(url).hostname;
      const currentKey = `${domain}:current`;
      const latestKey = `${domain}:latest`;
      const lastUpdateKey = `${domain}:lastUpdate`;
      
      // 检查今天是否已经更新过
      const today = new Date().toISOString().split('T')[0];
      const lastUpdate = await this.sitemapKV.get(lastUpdateKey);
      
      console.log(`今天的日期: ${today}, 上次更新日期: ${lastUpdate}`);
      
      if (lastUpdate === today) {
        // 比较current和latest
        const currentContent = await this.sitemapKV.get(currentKey);
        const latestContent = await this.sitemapKV.get(latestKey);
        
        if (currentContent && latestContent) {
          const newUrls = await this.compareSitemaps(currentContent, latestContent);
          return { success: true, errorMsg: '今天已经更新过此sitemap', newUrls };
        }
        
        return { success: true, errorMsg: '今天已经更新过此sitemap', newUrls: [] };
      }
      
      // 下载新文件
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const content = await response.text();
      
      // 如果存在current文件，比较差异
      let newUrls: string[] = [];
      const currentContent = await this.sitemapKV.get(currentKey);
      
      if (currentContent) {
        newUrls = await this.compareSitemaps(content, currentContent);
        // 将current移动到latest
        await this.sitemapKV.put(latestKey, currentContent);
      }
      
      // 保存新文件
      await this.sitemapKV.put(currentKey, content);
      await this.sitemapKV.put(lastUpdateKey, today);
      
      console.log(`sitemap已保存: ${url}`);
      return { success: true, errorMsg: '', newUrls };
    } catch (error) {
      console.error(`下载sitemap失败: ${url}`, error);
      return { success: false, errorMsg: `下载失败: ${error}`, newUrls: [] };
    }
  }

  /**
   * 比较当前和最新的sitemap
   */
  async compareCurrentAndLatest(url: string): Promise<{ newUrls: string[] }> {
    try {
      const domain = new URL(url).hostname;
      const currentKey = `${domain}:current`;
      const latestKey = `${domain}:latest`;
      
      const currentContent = await this.sitemapKV.get(currentKey);
      const latestContent = await this.sitemapKV.get(latestKey);
      
      if (!currentContent || !latestContent) {
        return { newUrls: [] };
      }
      
      const newUrls = await this.compareSitemaps(currentContent, latestContent);
      return { newUrls };
    } catch (error) {
      console.error(`比较sitemap失败`, error);
      return { newUrls: [] };
    }
  }

  /**
   * 比较新旧sitemap，返回新增的URL列表
   * 使用简单的正则表达式解析XML而不是xml2js
   */
  private async compareSitemaps(currentContent: string, oldContent: string): Promise<string[]> {
    try {
      // 使用正则表达式提取所有URL
      const extractUrls = (content: string): Set<string> => {
        const urlRegex = /<loc>(.*?)<\/loc>/g;
        const urls = new Set<string>();
        let match;
        
        while ((match = urlRegex.exec(content)) !== null) {
          if (match[1]) {
            urls.add(match[1]);
          }
        }
        
        return urls;
      };
      
      const currentUrls = extractUrls(currentContent);
      const oldUrls = extractUrls(oldContent);
      
      // 找出新增的URL
      const newUrls = Array.from(currentUrls).filter(url => !oldUrls.has(url));
      return newUrls;
    } catch (error) {
      console.error(`比较sitemap失败:`, error);
      return [];
    }
  }
} 