import express from 'express';
import GitaController from '../controllers/GitaController.js';

const router = express.Router();

/**
 * @route GET /api/v1/gita/quotes
 * @desc Get all Gita quotes
 * @access Public
 */
router.get('/quotes', GitaController.getAllQuotes);

/**
 * @route GET /api/v1/gita/quotes/random
 * @desc Get a random Gita quote
 * @access Public
 */
router.get('/quotes/random', GitaController.getRandomQuote);

/**
 * @route GET /api/v1/gita/quotes/search
 * @desc Search Gita quotes
 * @access Public
 * @query q - Search query
 */
router.get('/quotes/search', GitaController.searchQuotes);

/**
 * @route GET /api/v1/gita/quotes/:id
 * @desc Get quote by ID
 * @access Public
 */
router.get('/quotes/:id', GitaController.getQuoteById);

/**
 * @route GET /api/v1/gita/categories
 * @desc Get all quote categories
 * @access Public
 */
router.get('/categories', GitaController.getCategories);

/**
 * @route GET /api/v1/gita/categories/:category
 * @desc Get quotes by category
 * @access Public
 */
router.get('/categories/:category', GitaController.getQuotesByCategory);

/**
 * @route GET /api/v1/gita/tags
 * @desc Get all tags
 * @access Public
 */
router.get('/tags', GitaController.getTags);

/**
 * @route GET /api/v1/gita/tags/:tag
 * @desc Get quotes by tag
 * @access Public
 */
router.get('/tags/:tag', GitaController.getQuotesByTag);

export default router;
