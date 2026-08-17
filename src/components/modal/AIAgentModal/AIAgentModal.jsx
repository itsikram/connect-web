import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./AIAgentModal.css";
import ChatArea from "./ChatArea";
import ActionPanel from "./ActionPanel";
import ModalHeader from "./ModalHeader";
import { sendToGemini } from "../../../services/geminiService";

const AIAgentModal = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "agent",
      content:
        "Hello! I'm your AI Agent. I can help you with various tasks within the app. What would you like to do?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (message) => {
    // Handle message parameter - can be string or undefined
    const finalMessage = typeof message === "string" ? message : inputValue;
    if (!finalMessage || !finalMessage.trim()) return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: "user",
      content: finalMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Call Gemini API
      const conversationHistory = messages.map((m) => ({
        role: m.type === "user" ? "user" : "assistant",
        content: m.content,
      }));

      const result = await sendToGemini(finalMessage, conversationHistory);

      const agentMessage = {
        id: Date.now() + 1,
        type: "agent",
        content: result.response,
        timestamp: new Date(),
        action: result.suggestedAction,
      };

      setMessages((prev) => [...prev, agentMessage]);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage = {
        id: Date.now() + 1,
        type: "agent",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action) => {
    setSelectedAction(action);
    handleSendMessage(`Execute: ${action.label}`);
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 300,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.2 },
    },
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="ai-agent-modal-backdrop"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <motion.div
            className="ai-agent-modal-container"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            style={{
              margin: "auto",
            }}
          >
            <ModalHeader onClose={onClose} />

            <div className="ai-agent-modal-body">
              <div
                className={`ai-agent-sidebar ${
                  isSidebarOpen ? "open" : "closed"
                }`}
              >
                <ActionPanel onActionClick={handleActionClick} />
              </div>

              <div className="ai-agent-main-content">
                <ChatArea
                  messages={messages}
                  isLoading={isLoading}
                  onSendMessage={handleSendMessage}
                  inputValue={inputValue}
                  onInputChange={setInputValue}
                  messagesEndRef={messagesEndRef}
                />
              </div>
            </div>

            <button
              className="ai-agent-sidebar-toggle"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Toggle sidebar"
            >
              <i
                className={`fas fa-${isSidebarOpen ? "chevron-left" : "chevron-right"}`}
              ></i>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AIAgentModal;
