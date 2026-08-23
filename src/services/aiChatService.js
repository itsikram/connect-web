import api from "../api/api";

/**
 * Save AI chat messages to database
 * @param {Array} messages - Array of chat messages
 * @returns {Promise} API response
 */
export const saveAIChat = async (messages) => {
  try {
    const response = await api.post("ai-chat/save", {
      messages: messages,
      timestamp: new Date(),
    });
    return response.data;
  } catch (error) {
    console.error("Error saving AI chat:", error);
    throw error;
  }
};

/**
 * Fetch all AI chat history for current user
 * @returns {Promise} Array of chat histories
 */
export const fetchAIChatHistory = async () => {
  try {
    const response = await api.get("ai-chat/history");
    return response.data;
  } catch (error) {
    console.error("Error fetching AI chat history:", error);
    throw error;
  }
};

/**
 * Fetch latest AI chat session
 * @returns {Promise} Latest chat session data
 */
export const fetchLatestAIChat = async () => {
  try {
    const response = await api.get("ai-chat/latest");
    return response.data;
  } catch (error) {
    console.error("Error fetching latest AI chat:", error);
    throw error;
  }
};

/**
 * Delete AI chat history
 * @param {String} chatId - Chat session ID (optional, if not provided, deletes all)
 * @returns {Promise} API response
 */
export const deleteAIChat = async (chatId = null) => {
  try {
    const response = await api.delete("ai-chat/delete", {
      params: chatId ? { chatId } : {},
    });
    return response.data;
  } catch (error) {
    console.error("Error deleting AI chat:", error);
    throw error;
  }
};

export default {
  saveAIChat,
  fetchAIChatHistory,
  fetchLatestAIChat,
  deleteAIChat,
};
