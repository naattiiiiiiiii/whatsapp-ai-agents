// Agente Web simplificado - usa fetch en lugar de Puppeteer para mayor compatibilidad

export class WebAgent {
  async execute(tool: string, args: Record<string, unknown>): Promise<unknown> {
    switch (tool) {
      case 'web_search':
        return this.search(args.query as string, args.numResults as number);
      case 'web_scrape':
        return this.scrape(args.url as string, args.selector as string);
      case 'web_screenshot':
        return { error: 'Screenshots require browser - not available in lite mode' };
      case 'web_fill_form':
        return { error: 'Form filling requires browser - not available in lite mode' };
      case 'web_monitor':
        return this.monitor(args.url as string);
      default:
        throw new Error(`Unknown web tool: ${tool}`);
    }
  }

  async close(): Promise<void> {
    // No browser to close in lite mode
  }

  private async search(query: string, numResults?: number): Promise<object> {
    try {
      // Usar DuckDuckGo Instant Answer API
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1`,
        {
          headers: {
            'User-Agent': 'WhatsAppAIAgents/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json() as any;

      const results: Array<{ title: string; url: string; snippet: string }> = [];

      // Abstract (respuesta directa)
      if (data.Abstract) {
        results.push({
          title: data.Heading || 'Result',
          url: data.AbstractURL || '',
          snippet: data.Abstract,
        });
      }

      // Related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, (numResults || 5) - results.length)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || 'Related',
              url: topic.FirstURL,
              snippet: topic.Text,
            });
          }
        }
      }

      // Si no hay resultados, buscar con scraping básico
      if (results.length === 0) {
        return this.searchFallback(query, numResults);
      }

      return {
        query,
        results: results.slice(0, numResults || 5),
        totalResults: results.length,
      };
    } catch (error) {
      console.error('Search error:', error);
      return this.searchFallback(query, numResults);
    }
  }

  private async searchFallback(query: string, numResults?: number): Promise<object> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodedQuery}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
        }
      );

      const html = await response.text();
      const results: Array<{ title: string; url: string; snippet: string }> = [];

      // Extraer resultados con regex simple
      const resultRegex = /<a class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
      const snippetRegex = /<a class="result__snippet"[^>]*>([^<]*)<\/a>/g;

      let match;
      const urls: string[] = [];
      const titles: string[] = [];
      const snippets: string[] = [];

      while ((match = resultRegex.exec(html)) !== null) {
        urls.push(match[1]);
        titles.push(match[2]);
      }

      while ((match = snippetRegex.exec(html)) !== null) {
        snippets.push(match[1]);
      }

      for (let i = 0; i < Math.min(urls.length, numResults || 5); i++) {
        results.push({
          title: titles[i] || 'Result',
          url: urls[i] || '',
          snippet: snippets[i] || '',
        });
      }

      return {
        query,
        results,
        totalResults: results.length,
        note: 'Results from fallback search',
      };
    } catch (error) {
      return {
        query,
        results: [],
        totalResults: 0,
        error: `Search failed: ${error}`,
      };
    }
  }

  private async scrape(url: string, selector?: string): Promise<object> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const html = await response.text();

      // Extraer título
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : 'No title';

      // Extraer contenido de texto (remover scripts, styles, tags)
      let content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Limitar contenido
      content = content.substring(0, 5000);

      return {
        url,
        title,
        content,
        truncated: content.length >= 5000,
        note: 'Basic scraping (no JavaScript rendering)',
      };
    } catch (error) {
      return {
        url,
        error: `Scrape failed: ${error}`,
      };
    }
  }

  private async monitor(url: string): Promise<object> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      const html = await response.text();
      const hash = await this.hashContent(html);

      return {
        url,
        contentHash: hash,
        contentPreview: html.substring(0, 200).replace(/<[^>]+>/g, ''),
        message: 'Page hash captured. Compare later to detect changes.',
      };
    } catch (error) {
      return {
        url,
        error: `Monitor failed: ${error}`,
      };
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
