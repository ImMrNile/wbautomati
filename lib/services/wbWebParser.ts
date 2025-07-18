import { chromium } from 'playwright';

/**
 * Simple web scraper for Wildberries product pages using Playwright.
 * This is a fallback when API calls fail due to anti-bot restrictions.
 */
export class WBWebParser {
  /**
   * Fetch product data by loading the product page in a headless browser.
   * @param url Full URL of the Wildberries product page.
   */
  async parseProduct(url: string) {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      // Wait for global state script that contains JSON data about product
      const stateHandle = await page.waitForSelector('script#__INITIAL_STATE__', {
        timeout: 5000,
      });
      const stateJson = await stateHandle.evaluate((el) => el.textContent || '');
      const state = JSON.parse(stateJson);
      const product = state?.product?.data || state?.productCard?.data;
      if (!product) throw new Error('No product data in page state');

      return {
        id: product.nmId?.toString() || '',
        name: product.nmName || product.name || '',
        brand: product.brandName || product.brand || '',
        price: product.salePriceU ? Math.round(product.salePriceU / 100) : 0,
        description: product.description || '',
      };
    } catch (error) {
      console.warn('Web parser failed:', error);
      return null;
    } finally {
      await browser.close();
    }
  }
}

export const wbWebParser = new WBWebParser();
export default wbWebParser;
