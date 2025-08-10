import logger from '../utils/logger.js';
import GeminiService from './GeminiService.js';

/**
 * Fallback chat service for when OpenAI is not available
 */
class FallbackChatService {
  constructor() {
    this.responses = [
      {
        text: "I understand you're reaching out for guidance. While I'm experiencing some technical difficulties connecting to my full knowledge base, I want you to know that every challenge you face is an opportunity for growth.",
        facialExpression: "smile",
        animation: "Alert"
      },
      {
        text: "Remember, as Krishna taught Arjuna in the Bhagavad Gita: 'You have the right to perform your actions, but you are not entitled to the fruits of action.' Focus on doing your best in this moment.",
        facialExpression: "default",
        animation: "Agree_Gesture"
      },
      {
        text: "Whatever situation you're facing, approach it with a calm mind and pure intention. The answers you seek often lie within your own wisdom and dharma.",
        facialExpression: "smile",
        animation: "Idle"
      }
    ];

    this.quickResponses = [
      {
        text: "I hear your question, and while I'm having some technical challenges right now, I want to remind you that every moment is a chance to practice patience and understanding.",
        facialExpression: "smile",
        animation: "Alert"
      },
      {
        text: "As the Gita teaches us, 'The mind is restless and difficult to restrain, but it is subdued by practice.' Take a moment to breathe and center yourself.",
        facialExpression: "default",
        animation: "Idle"
      }
    ];

    this.greetingResponses = [
      {
        text: "Radhe Radhe! I'm here to help guide you with wisdom from the Bhagavad Gita, though I'm experiencing some technical difficulties at the moment.",
        facialExpression: "smile",
        animation: "Alert"
      },
      {
        text: "Welcome, dear soul. While my full capabilities are temporarily limited, I'm still here to offer what guidance I can from the eternal teachings.",
        facialExpression: "smile",
        animation: "Agree_Gesture"
      }
    ];
  }

  /**
   * Generate a fallback chat response based on the user message
   */
  async generateChatCompletion(userMessage, options = {}) {
    try {
      logger.info('Generating fallback chat response', {
        messageLength: userMessage?.length || 0,
        fast: options.fast,
        contextAware: options.contextAware,
        contextLength: options.context?.length || 0
      });

      // First, try Gemini if available
      if (GeminiService.isAvailable()) {
        try {
          logger.info('Attempting Gemini fallback for chat completion');

          if (options.contextAware && options.context && options.context.length > 0) {
            return await GeminiService.generateChatCompletionWithContext(userMessage, options.context);
          } else {
            return await GeminiService.generateChatCompletion(userMessage);
          }
        } catch (geminiError) {
          logger.warn('Gemini fallback failed, using static responses', { error: geminiError.message });
        }
      }

      const message = userMessage?.toLowerCase() || '';
      let selectedResponses;

      // Use context to determine if this is a continuation
      const hasContext = options.context && options.context.length > 0;
      const isFollowUp = hasContext && this.isFollowUpMessage(message, options.context);

      // Determine response type based on message content and context
      if (this.isGreeting(message) && !hasContext) {
        selectedResponses = this.greetingResponses;
      } else if (options.fast || options.quick) {
        selectedResponses = this.quickResponses;
      } else if (isFollowUp) {
        // For follow-up messages, use more conversational responses
        selectedResponses = this.responses;
      } else {
        selectedResponses = this.responses;
      }

      // Select response(s) based on mode
      let messages;
      if ((options.fast || options.contextAware) && !options.allowMultipleResponses) {
        // Fast mode or context-aware: single response (unless multiple responses are explicitly allowed)
        messages = [this.selectRandomResponse(selectedResponses)];
      } else {
        // Full mode or multiple responses allowed: 1-3 responses
        const numResponses = Math.random() > 0.6 ? (Math.random() > 0.8 ? 3 : 2) : 1;
        messages = this.selectMultipleResponses(selectedResponses, numResponses);
      }

      // Add contextual elements based on user message and conversation history
      messages = this.addContextualElements(messages, message, options.context);

      // Add context-aware personalization
      if (options.contextAware && hasContext) {
        messages = this.addContextAwareElements(messages, options.context);
      }

      logger.info('Fallback chat response generated', {
        responseCount: messages.length,
        mode: options.fast ? 'fast' : options.contextAware ? 'context-aware' : 'full',
        hasContext
      });

      return messages;

    } catch (error) {
      logger.error('Fallback chat service failed', { error: error.message });

      // Ultimate fallback
      return [{
        text: "I'm experiencing technical difficulties, but I'm here with you. Take a moment to breathe and know that this too shall pass.",
        facialExpression: "default",
        animation: "Alert"
      }];
    }
  }

  /**
   * Check if message is a greeting
   */
  isGreeting(message) {
    const greetings = ['hello', 'hi', 'hey', 'namaste', 'radhe', 'greetings', 'good morning', 'good evening'];
    return greetings.some(greeting => message.includes(greeting));
  }

  /**
   * Select a random response from the array
   */
  selectRandomResponse(responses) {
    const index = Math.floor(Math.random() * responses.length);
    return { ...responses[index] };
  }

  /**
   * Select multiple unique responses
   */
  selectMultipleResponses(responses, count) {
    const shuffled = [...responses].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, responses.length)).map(r => ({ ...r }));
  }

  /**
   * Check if this is a follow-up message based on context
   */
  isFollowUpMessage(message, context) {
    if (!context || context.length === 0) return false;

    const followUpIndicators = ['yes', 'no', 'but', 'however', 'also', 'and', 'what about', 'how about'];
    return followUpIndicators.some(indicator => message.includes(indicator));
  }

  /**
   * Add contextual elements based on user message content
   */
  addContextualElements(messages, userMessage, context = []) {
    // Add specific guidance based on keywords
    if (userMessage.includes('stress') || userMessage.includes('anxiety') || userMessage.includes('worry')) {
      messages[0].text += " Remember, worry is like a rocking chair - it gives you something to do but doesn't get you anywhere.";
    } else if (userMessage.includes('decision') || userMessage.includes('choice') || userMessage.includes('confused')) {
      messages[0].text += " When facing difficult decisions, listen to your inner wisdom and consider what serves the greater good.";
    } else if (userMessage.includes('relationship') || userMessage.includes('family') || userMessage.includes('friend')) {
      messages[0].text += " In all relationships, practice compassion, understanding, and selfless love.";
    } else if (userMessage.includes('work') || userMessage.includes('job') || userMessage.includes('career')) {
      messages[0].text += " Approach your work as a form of service, doing your duty without attachment to results.";
    }

    return messages;
  }

  /**
   * Add context-aware personalization based on conversation history
   */
  addContextAwareElements(messages, context) {
    if (!context || context.length === 0) return messages;

    // Look for patterns in recent conversation
    const recentMessages = context.slice(-5);
    const userMessages = recentMessages.filter(msg => msg.role === 'user');

    if (userMessages.length > 1) {
      // This is a continuing conversation
      const commonThemes = this.extractCommonThemes(userMessages);

      if (commonThemes.includes('spiritual')) {
        messages[0].text = "Continuing our spiritual discussion, " + messages[0].text.toLowerCase();
      } else if (commonThemes.includes('practical')) {
        messages[0].text = "Building on what we discussed, " + messages[0].text.toLowerCase();
      }
    }

    return messages;
  }

  /**
   * Extract common themes from user messages
   */
  extractCommonThemes(userMessages) {
    const themes = [];
    const spiritualWords = ['god', 'divine', 'spiritual', 'soul', 'meditation', 'prayer', 'dharma'];
    const practicalWords = ['work', 'job', 'money', 'family', 'relationship', 'decision', 'problem'];

    const allText = userMessages.map(msg => msg.content.toLowerCase()).join(' ');

    if (spiritualWords.some(word => allText.includes(word))) {
      themes.push('spiritual');
    }
    if (practicalWords.some(word => allText.includes(word))) {
      themes.push('practical');
    }

    return themes;
  }

  /**
   * Generate a simple response for testing
   */
  async generateTestResponse(userMessage) {
    return [{
      text: `Thank you for your message: "${userMessage}". I'm currently in fallback mode, but I'm here to help guide you with wisdom and compassion.`,
      facialExpression: "smile",
      animation: "Talking"
    }];
  }

  /**
   * Check if the service is available (always true for fallback)
   */
  isAvailable() {
    return true;
  }
}

export default new FallbackChatService();
