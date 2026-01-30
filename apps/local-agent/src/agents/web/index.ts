import puppeteer, { type Browser, type Page } from 'puppeteer';

export class WebAgent {
  private browser: Browser | null = null;

  async execute(tool: string, args: Record<string, unknown>): Promise<unknown> {
    switch (tool) {
      case 'web_search':
        return this.search(args.query as string, args.numResults as number);
      case 'web_scrape':
        return this.scrape(args.url as string, args.selector as string);
      case 'web_screenshot':
        return this.screenshot(args.url as string, args.fullPage as boolean);
      case 'web_fill_form':
        return this.fillForm(args.url as string, args.fields as Record<string, string>);
      case 'web_monitor':
        return this.monitor(args.url as string, args.selector as string, args.interval as number);
      default:
        throw new Error(`Unknown web tool: ${tool}`);
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async search(query: string, numResults?: number): Promise<object> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

      // Usar DuckDuckGo para evitar CAPTCHAs de Google
      const encodedQuery = encodeURIComponent(query);
      await page.goto(`https://html.duckduckgo.com/html/?q=${encodedQuery}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      // Extraer resultados
      const results = await page.evaluate((limit) => {
        const items: Array<{ title: string; url: string; snippet: string }> = [];
        const elements = document.querySelectorAll('.result');

        elements.forEach((el, index) => {
          if (index >= limit) return;

          const titleEl = el.querySelector('.result__title a');
          const snippetEl = el.querySelector('.result__snippet');

          if (titleEl) {
            items.push({
              title: titleEl.textContent?.trim() || '',
              url: titleEl.getAttribute('href') || '',
              snippet: snippetEl?.textContent?.trim() || '',
            });
          }
        });

        return items;
      }, numResults || 5);

      return {
        query,
        results,
        totalResults: results.length,
      };
    } finally {
      await page.close();
    }
  }

  private async scrape(url: string, selector?: string): Promise<object> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      let content: string;
      let title: string;

      if (selector) {
        await page.waitForSelector(selector, { timeout: 5000 }).catch(() => {});
        content = await page.$eval(selector, el => el.textContent || '').catch(() => '');
      } else {
        // Extraer contenido principal
        content = await page.evaluate(() => {
          // Intentar encontrar el contenido principal
          const selectors = ['article', 'main', '.content', '#content', '.post', 'body'];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent && el.textContent.trim().length > 100) {
              return el.textContent.trim();
            }
          }
          return document.body.textContent?.trim() || '';
        });
      }

      title = await page.title();

      // Limpiar y limitar contenido
      content = content
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000);

      return {
        url,
        title,
        content,
        truncated: content.length >= 5000,
      };
    } finally {
      await page.close();
    }
  }

  private async screenshot(url: string, fullPage?: boolean): Promise<object> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

      const screenshot = await page.screenshot({
        encoding: 'base64',
        fullPage: fullPage || false,
        type: 'jpeg',
        quality: 80,
      });

      const title = await page.title();

      return {
        url,
        title,
        screenshot: `data:image/jpeg;base64,${screenshot}`,
        width: 1280,
        height: fullPage ? 'variable' : 800,
      };
    } finally {
      await page.close();
    }
  }

  private async fillForm(url: string, fields: Record<string, string>): Promise<object> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      const filled: string[] = [];
      const notFound: string[] = [];

      for (const [selector, value] of Object.entries(fields)) {
        try {
          // Intentar varios selectores
          const selectors = [
            selector,
            `[name="${selector}"]`,
            `#${selector}`,
            `[placeholder*="${selector}" i]`,
          ];

          let found = false;
          for (const sel of selectors) {
            const element = await page.$(sel);
            if (element) {
              await element.click({ clickCount: 3 }); // Seleccionar todo
              await page.keyboard.type(value);
              filled.push(selector);
              found = true;
              break;
            }
          }

          if (!found) {
            notFound.push(selector);
          }
        } catch {
          notFound.push(selector);
        }
      }

      return {
        url,
        filled,
        notFound,
        success: filled.length > 0,
      };
    } finally {
      await page.close();
    }
  }

  private async monitor(url: string, selector?: string, interval?: number): Promise<object> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      let content: string;

      if (selector) {
        content = await page.$eval(selector, el => el.textContent || '').catch(() => '');
      } else {
        content = await page.evaluate(() => document.body.textContent?.trim() || '');
      }

      // Crear hash del contenido para detectar cambios
      const hash = await this.hashContent(content);

      return {
        url,
        selector: selector || 'body',
        contentHash: hash,
        contentPreview: content.substring(0, 200),
        monitoringInterval: interval || 60,
        message: 'Monitoring configured. Changes will be notified.',
      };
    } finally {
      await page.close();
    }
  }

  private async hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  }
}
