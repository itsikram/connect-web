import OpenAI from 'openai';

class OpenAIService {
  constructor() {
    this.openai = null;
    this.isInitialized = false;
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize OpenAI with API key from environment
      this.openai = new OpenAI({
        apiKey: process.env.REACT_APP_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true // Note: This is for client-side usage
      });
      this.isInitialized = true;
      console.log('OpenAI service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenAI service:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Convert video frame to base64 image
   * @param {HTMLVideoElement} videoElement - Video element to capture frame from
   * @returns {string} Base64 encoded image
   */
  captureFrameAsBase64(videoElement) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size to video size
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      
      // Draw video frame to canvas
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // Convert to base64
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error('Error capturing frame:', error);
      return null;
    }
  }

  /**
   * Analyze emotion from image using OpenAI Vision API
   * @param {string} base64Image - Base64 encoded image
   * @returns {Object} Emotion analysis result
   */
  async analyzeEmotion(base64Image) {
    if (!this.isInitialized || !this.openai) {
      throw new Error('OpenAI service not initialized');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // or "gpt-4o-mini" for faster/cheaper analysis
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze the facial expression in this image and determine the primary emotion. 
                
                Please respond with a JSON object containing:
                - emotion: the primary emotion (happy, sad, angry, surprised, fearful, disgusted, neutral, etc.)
                - confidence: confidence score from 0.0 to 1.0
                - intensity: intensity level (low, medium, high)
                - additional_emotions: array of other emotions present
                - facial_features: object describing key facial features (eyes, mouth, eyebrows)
                - analysis: brief explanation of the analysis
                
                Be precise and detailed in your analysis.`
              },
              {
                type: "image_url",
                image_url: {
                  url: base64Image
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1 // Low temperature for more consistent results
      });

      const content = response.choices[0].message.content;
      
      try {
        // Try to parse JSON response
        const emotionData = JSON.parse(content);
        return {
          success: true,
          data: emotionData,
          rawResponse: content
        };
      } catch (parseError) {
        // If JSON parsing fails, extract emotion from text
        const emotionMatch = content.match(/(?:emotion|primary emotion)[:\s]+(\w+)/i);
        const confidenceMatch = content.match(/(?:confidence|confidence score)[:\s]+([0-9.]+)/i);
        
        return {
          success: true,
          data: {
            emotion: emotionMatch ? emotionMatch[1].toLowerCase() : 'unknown',
            confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
            intensity: 'medium',
            additional_emotions: [],
            facial_features: {},
            analysis: content
          },
          rawResponse: content
        };
      }
    } catch (error) {
      console.error('OpenAI emotion analysis error:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Analyze emotion from video element
   * @param {HTMLVideoElement} videoElement - Video element to analyze
   * @returns {Object} Emotion analysis result
   */
  async analyzeEmotionFromVideo(videoElement) {
    const base64Image = this.captureFrameAsBase64(videoElement);
    if (!base64Image) {
      return {
        success: false,
        error: 'Failed to capture frame from video',
        data: null
      };
    }

    return await this.analyzeEmotion(base64Image);
  }

  /**
   * Get emotion analysis with retry logic
   * @param {HTMLVideoElement} videoElement - Video element to analyze
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Object} Emotion analysis result
   */
  async analyzeEmotionWithRetry(videoElement, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.analyzeEmotionFromVideo(videoElement);
        
        if (result.success) {
          return result;
        }
        
        if (attempt === maxRetries) {
          return result;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } catch (error) {
        if (attempt === maxRetries) {
          return {
            success: false,
            error: error.message,
            data: null
          };
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * Check if service is ready
   * @returns {boolean} Service readiness status
   */
  isReady() {
    return this.isInitialized && this.openai !== null;
  }

  /**
   * Get service status
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      ready: this.isReady(),
      hasApiKey: !!process.env.REACT_APP_OPENAI_API_KEY
    };
  }
}

// Create singleton instance
const openaiService = new OpenAIService();

export default openaiService;
