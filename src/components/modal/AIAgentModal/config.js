/**
 * AI Agent Modal Configuration
 * Customize the modal behavior and appearance
 */

export const AIAgentConfig = {
  // Long-press duration (milliseconds)
  LONG_PRESS_DURATION: 500,

  // Modal animations
  ANIMATION: {
    MODAL_SPRING: {
      type: "spring",
      damping: 25,
      stiffness: 300,
    },
    MESSAGE_DELAY: 0.05, // Stagger delay between messages
    ITEM_DELAY: 0.05, // Stagger delay for action items
  },

  // Chat settings
  CHAT: {
    MAX_MESSAGE_LENGTH: 2000,
    TYPING_SPEED: "normal", // 'fast', 'normal', 'slow'
    TYPING_INDICATOR_DURATION: 2000, // milliseconds
    AUTO_SCROLL_THRESHOLD: 100, // pixels from bottom
  },

  // Gemini API settings
  GEMINI: {
    MODEL: "gemini-3.5-flash",
    TEMPERATURE: 0.7,
    MAX_OUTPUT_TOKENS: 1024,
    TOP_K: 40,
    TOP_P: 0.95,
  },

  // UI Customization
  UI: {
    // Colors
    COLORS: {
      PRIMARY_GRADIENT_START: "#00d4ff",
      PRIMARY_GRADIENT_END: "#0099cc",
      SECONDARY_GRADIENT_START: "#33e0ff",
      SECONDARY_GRADIENT_END: "#00d4ff",
      TEXT_PRIMARY: "#e4e6eb",
      TEXT_SECONDARY: "#b0b3b8",
      BORDER: "rgba(255, 255, 255, 0.08)",
      BACKGROUND: "#1c1e21",
      BACKGROUND_SECONDARY: "#161718",
    },

    // Sizes
    SIZES: {
      MODAL_MIN_WIDTH: "300px",
      MODAL_MAX_WIDTH: "1200px",
      MODAL_MIN_HEIGHT: "400px",
      MODAL_MAX_HEIGHT: "800px",
      SIDEBAR_WIDTH: "300px",
      SIDEBAR_WIDTH_MOBILE: "280px",
      MESSAGE_MAX_WIDTH_DESKTOP: "70%",
      MESSAGE_MAX_WIDTH_TABLET: "80%",
      MESSAGE_MAX_WIDTH_MOBILE: "85%",
      MESSAGE_MAX_WIDTH_MOBILE_SMALL: "90%",
    },

    // Spacing
    SPACING: {
      PADDING_SMALL: "8px",
      PADDING_MEDIUM: "12px",
      PADDING_LARGE: "16px",
      PADDING_XLARGE: "20px",
      PADDING_HEADER: "20px 24px",
      GAP_SMALL: "4px",
      GAP_MEDIUM: "8px",
      GAP_LARGE: "12px",
    },

    // Border radius
    BORDER_RADIUS: {
      SMALL: "4px",
      MEDIUM: "8px",
      LARGE: "12px",
      XLARGE: "16px",
      FULL: "9999px",
    },

    // Font sizes
    FONT_SIZES: {
      TINY: "10px",
      SMALL: "11px",
      NORMAL: "12px",
      MEDIUM: "13px",
      LARGE: "14px",
      XLARGE: "18px",
      TITLE: "20px",
      HEADER: "24px",
    },
  },

  // Sidebar actions
  SIDEBAR_ACTIONS: [
    {
      category: "search",
      icon: "fa-search",
      label: "Search & Discover",
      items: [
        { id: 1, label: "Find users", icon: "fa-user" },
        { id: 2, label: "Search posts", icon: "fa-file-alt" },
        { id: 3, label: "Discover videos", icon: "fa-video" },
        { id: 4, label: "Find trending content", icon: "fa-fire" },
      ],
    },
    {
      category: "create",
      icon: "fa-plus-circle",
      label: "Create & Share",
      items: [
        { id: 5, label: "Create new post", icon: "fa-pen" },
        { id: 6, label: "Upload video", icon: "fa-cloud-upload" },
        { id: 7, label: "Start live stream", icon: "fa-broadcast-tower" },
        { id: 8, label: "Create story", icon: "fa-image" },
      ],
    },
    {
      category: "analyze",
      icon: "fa-chart-bar",
      label: "Analytics & Insights",
      items: [
        { id: 9, label: "Summarize content", icon: "fa-align-left" },
        { id: 10, label: "Get recommendations", icon: "fa-lightbulb" },
        { id: 11, label: "Analyze sentiment", icon: "fa-face-smile" },
        { id: 12, label: "View statistics", icon: "fa-chart-pie" },
      ],
    },
    {
      category: "assist",
      icon: "fa-life-ring",
      label: "Assistance",
      items: [
        { id: 13, label: "Write caption", icon: "fa-quote-left" },
        { id: 14, label: "Translate text", icon: "fa-language" },
        { id: 15, label: "Get help", icon: "fa-question-circle" },
        { id: 16, label: "Report issue", icon: "fa-exclamation-circle" },
      ],
    },
  ],

  // Quick suggestions
  SUGGESTIONS: [
    "What can you help with?",
    "Show recent posts",
    "Find users",
    "Summarize content",
  ],

  // Initial greeting message
  INITIAL_MESSAGE: {
    type: "agent",
    content:
      "Hello! I'm your AI Agent. I can help you with various tasks within the app. What would you like to do?",
  },

  // System prompt for AI
  SYSTEM_PROMPT: `You are a helpful AI Assistant within a social media and content sharing platform called "Connect".
You can help users with various actions such as:
- Searching for users, posts, and videos
- Creating new posts and videos
- Discovering content
- Analyzing sentiment and getting recommendations
- Writing captions
- Translating text
- Providing assistance with app features

Be conversational, helpful, and concise. When appropriate, suggest the next action they could take.
Always provide practical help related to the app's features.`,

  // Responsive breakpoints
  BREAKPOINTS: {
    MOBILE_SMALL: 480,
    MOBILE: 768,
    TABLET: 1024,
    DESKTOP: 1200,
  },

  // Feature flags
  FEATURES: {
    ENABLE_SIDEBAR: true,
    ENABLE_SUGGESTIONS: true,
    ENABLE_EMOJI_PICKER: false, // Set to true to implement emoji picker
    ENABLE_FILE_UPLOAD: false, // Set to true to implement file upload
    ENABLE_VOICE_INPUT: false, // Set to true to implement voice input
    ENABLE_DARK_MODE: true,
    ENABLE_ANIMATIONS: true,
  },

  // Debug settings
  DEBUG: {
    ENABLE_LOGS: false,
    SHOW_API_RESPONSES: false,
    MOCK_RESPONSES: false,
  },
};

export default AIAgentConfig;
