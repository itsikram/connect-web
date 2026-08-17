import React, { useState } from 'react';
import { motion } from 'framer-motion';

const ActionPanel = ({ onActionClick }) => {
  const [expandedCategory, setExpandedCategory] = useState('search');

  const actions = [
    {
      category: 'search',
      icon: 'fa-search',
      label: 'Search & Discover',
      items: [
        { id: 1, label: 'Find users', icon: 'fa-user' },
        { id: 2, label: 'Search posts', icon: 'fa-file-alt' },
        { id: 3, label: 'Discover videos', icon: 'fa-video' },
        { id: 4, label: 'Find trending content', icon: 'fa-fire' },
      ],
    },
    {
      category: 'create',
      icon: 'fa-plus-circle',
      label: 'Create & Share',
      items: [
        { id: 5, label: 'Create new post', icon: 'fa-pen' },
        { id: 6, label: 'Upload video', icon: 'fa-cloud-upload' },
        { id: 7, label: 'Start live stream', icon: 'fa-broadcast-tower' },
        { id: 8, label: 'Create story', icon: 'fa-image' },
      ],
    },
    {
      category: 'analyze',
      icon: 'fa-chart-bar',
      label: 'Analytics & Insights',
      items: [
        { id: 9, label: 'Summarize content', icon: 'fa-align-left' },
        { id: 10, label: 'Get recommendations', icon: 'fa-lightbulb' },
        { id: 11, label: 'Analyze sentiment', icon: 'fa-face-smile' },
        { id: 12, label: 'View statistics', icon: 'fa-chart-pie' },
      ],
    },
    {
      category: 'assist',
      icon: 'fa-life-ring',
      label: 'Assistance',
      items: [
        { id: 13, label: 'Write caption', icon: 'fa-quote-left' },
        { id: 14, label: 'Translate text', icon: 'fa-language' },
        { id: 15, label: 'Get help', icon: 'fa-question-circle' },
        { id: 16, label: 'Report issue', icon: 'fa-exclamation-circle' },
      ],
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <div className="ai-agent-action-panel">
      <div className="action-panel-header">
        <h3>Quick Actions</h3>
      </div>

      <motion.div
        className="action-categories"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {actions.map((category) => (
          <motion.div
            key={category.category}
            className="action-category"
            variants={itemVariants}
          >
            <motion.button
              className={`category-header ${
                expandedCategory === category.category ? 'expanded' : ''
              }`}
              onClick={() =>
                setExpandedCategory(
                  expandedCategory === category.category ? null : category.category
                )
              }
              whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="category-icon">
                <i className={`fas ${category.icon}`}></i>
              </div>
              <span className="category-label">{category.label}</span>
              <i
                className={`fas fa-chevron-right category-chevron ${
                  expandedCategory === category.category ? 'rotate' : ''
                }`}
              ></i>
            </motion.button>

            <motion.div
              className="category-items"
              initial={{ height: 0, opacity: 0 }}
              animate={{
                height:
                  expandedCategory === category.category ? 'auto' : 0,
                opacity: expandedCategory === category.category ? 1 : 0,
              }}
              transition={{ duration: 0.3 }}
              style={{ overflow: 'hidden' }}
            >
              {category.items.map((item, index) => (
                <motion.button
                  key={item.id}
                  className="action-item"
                  onClick={() => onActionClick(item)}
                  whileHover={{ x: 5, backgroundColor: 'rgba(99, 102, 241, 0.1)' }}
                  whileTap={{ scale: 0.98 }}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: index * 0.05 }}
                >
                  <i className={`fas ${item.icon}`}></i>
                  <span>{item.label}</span>
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        ))}
      </motion.div>

      <div className="action-panel-footer">
        <p className="footer-hint">Click any action to interact with AI Agent</p>
      </div>
    </div>
  );
};

export default ActionPanel;
