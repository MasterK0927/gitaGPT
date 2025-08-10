import logger from '../utils/logger.js';
import { catchAsync } from '../middleware/errorHandler.js';
import { 
  gitaQuotes, 
  getRandomQuote, 
  getQuoteById, 
  getQuotesByCategory, 
  getQuotesByTag, 
  searchQuotes 
} from '../data/gitaQuotes.js';

class GitaController {
  /**
   * Get all Gita quotes
   */
  getAllQuotes = catchAsync(async (req, res) => {
    try {
      logger.info('All Gita quotes requested');

      res.json({
        success: true,
        data: {
          quotes: gitaQuotes,
          total: gitaQuotes.length
        }
      });
    } catch (error) {
      logger.error('Failed to get all quotes', {
        error: error.message
      });

      throw error;
    }
  });

  /**
   * Get a random Gita quote
   */
  getRandomQuote = catchAsync(async (req, res) => {
    try {
      logger.info('Random Gita quote requested');

      const quote = getRandomQuote();

      res.json({
        success: true,
        data: {
          quote
        }
      });
    } catch (error) {
      logger.error('Failed to get random quote', {
        error: error.message
      });

      throw error;
    }
  });

  /**
   * Get quote by ID
   */
  getQuoteById = catchAsync(async (req, res) => {
    try {
      const { id } = req.params;
      const quoteId = parseInt(id);

      logger.info('Gita quote by ID requested', { quoteId });

      const quote = getQuoteById(quoteId);

      if (!quote) {
        return res.status(404).json({
          success: false,
          error: 'Quote not found'
        });
      }

      res.json({
        success: true,
        data: {
          quote
        }
      });
    } catch (error) {
      logger.error('Failed to get quote by ID', {
        error: error.message
      });

      throw error;
    }
  });

  /**
   * Get quotes by category
   */
  getQuotesByCategory = catchAsync(async (req, res) => {
    try {
      const { category } = req.params;

      logger.info('Gita quotes by category requested', { category });

      const quotes = getQuotesByCategory(category);

      res.json({
        success: true,
        data: {
          quotes,
          category,
          total: quotes.length
        }
      });
    } catch (error) {
      logger.error('Failed to get quotes by category', {
        error: error.message
      });

      throw error;
    }
  });

  /**
   * Get quotes by tag
   */
  getQuotesByTag = catchAsync(async (req, res) => {
    try {
      const { tag } = req.params;

      logger.info('Gita quotes by tag requested', { tag });

      const quotes = getQuotesByTag(tag);

      res.json({
        success: true,
        data: {
          quotes,
          tag,
          total: quotes.length
        }
      });
    } catch (error) {
      logger.error('Failed to get quotes by tag', {
        error: error.message
      });

      throw error;
    }
  });

  /**
   * Search quotes
   */
  searchQuotes = catchAsync(async (req, res) => {
    try {
      const { q } = req.query;

      if (!q || q.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      logger.info('Gita quotes search requested', { query: q });

      const quotes = searchQuotes(q);

      res.json({
        success: true,
        data: {
          quotes,
          query: q,
          total: quotes.length
        }
      });
    } catch (error) {
      logger.error('Failed to search quotes', {
        error: error.message
      });

      throw error;
    }
  });

  /**
   * Get quote categories
   */
  getCategories = catchAsync(async (req, res) => {
    try {
      logger.info('Gita quote categories requested');

      const categories = [...new Set(gitaQuotes.map(quote => quote.category))];

      res.json({
        success: true,
        data: {
          categories,
          total: categories.length
        }
      });
    } catch (error) {
      logger.error('Failed to get categories', {
        error: error.message
      });

      throw error;
    }
  });

  /**
   * Get all tags
   */
  getTags = catchAsync(async (req, res) => {
    try {
      logger.info('Gita quote tags requested');

      const allTags = gitaQuotes.flatMap(quote => quote.tags);
      const uniqueTags = [...new Set(allTags)].sort();

      res.json({
        success: true,
        data: {
          tags: uniqueTags,
          total: uniqueTags.length
        }
      });
    } catch (error) {
      logger.error('Failed to get tags', {
        error: error.message
      });

      throw error;
    }
  });
}

export default new GitaController();
