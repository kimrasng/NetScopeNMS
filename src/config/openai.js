/**
 * OpenAI Configuration
 * OpenAI API client setup
 */

const OpenAI = require('openai');
const logger = require('../utils/logger');

// Configuration
const config = {
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || 'gpt-4',
  maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 1000,
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.3,
  timeout: 30000, // 30 seconds
  maxRetries: 3,
};

// OpenAI client instance
let client = null;

/**
 * Get or create OpenAI client
 */
const getClient = () => {
  if (!client) {
    if (!config.apiKey) {
      logger.warn('OpenAI API key not configured');
      return null;
    }
    client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    });
  }
  return client;
};

/**
 * Check if OpenAI is configured
 */
const isConfigured = () => {
  return !!config.apiKey && config.apiKey !== 'sk-your_api_key_here';
};

/**
 * Make a chat completion request
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @param {object} options - Additional options
 * @returns {Promise<object>} - OpenAI response
 */
const createCompletion = async (systemPrompt, userPrompt, options = {}) => {
  const openai = getClient();
  if (!openai) {
    throw new Error('OpenAI client not configured');
  }

  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: options.model || config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: options.maxTokens || config.maxTokens,
      temperature: options.temperature || config.temperature,
      response_format: options.jsonMode ? { type: 'json_object' } : undefined,
    });

    const responseTime = Date.now() - startTime;
    const usage = response.usage;

    logger.info(`OpenAI API call completed`, {
      model: config.model,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      responseTimeMs: responseTime,
    });

    return {
      content: response.choices[0]?.message?.content,
      usage: {
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
      },
      responseTimeMs: responseTime,
      model: response.model,
    };
  } catch (error) {
    logger.error('OpenAI API error:', {
      error: error.message,
      code: error.code,
      status: error.status,
    });
    throw error;
  }
};

/**
 * Parse JSON response from OpenAI
 * @param {string} content - Response content
 * @returns {object|null} - Parsed JSON or null
 */
const parseJsonResponse = (content) => {
  if (!content) return null;

  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    // Try direct parse
    return JSON.parse(content);
  } catch (error) {
    logger.warn('Failed to parse JSON from OpenAI response:', error.message);
    return null;
  }
};

module.exports = {
  config,
  getClient,
  isConfigured,
  createCompletion,
  parseJsonResponse,
};
