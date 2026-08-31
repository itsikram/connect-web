import React, { useEffect, useState } from 'react';

const APIKeyCheck = () => {
  const [apiKeyStatus, setApiKeyStatus] = useState({
    hasKey: false,
    keyLength: 0,
    message: '',
  });

  useEffect(() => {
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    
    if (!apiKey) {
      setApiKeyStatus({
        hasKey: false,
        keyLength: 0,
        message: '❌ API Key Missing! Add REACT_APP_GEMINI_API_KEY to your .env file',
      });
    } else {
      const hiddenKey = apiKey.substring(0, 10) + '*'.repeat(20);
      setApiKeyStatus({
        hasKey: true,
        keyLength: apiKey.length,
        message: `✅ API Key found (${apiKey.length} chars): ${hiddenKey}...`,
      });
    }
  }, []);

  return (
    <div
      style={{
        padding: '12px',
        marginBottom: '12px',
        background: apiKeyStatus.hasKey ? 'rgba(0, 200, 81, 0.16)' : 'rgba(255, 68, 68, 0.16)',
        border: `1px solid ${apiKeyStatus.hasKey ? 'rgba(0, 200, 81, 0.35)' : 'rgba(255, 68, 68, 0.35)'}`,
        borderRadius: '8px',
        fontSize: '12px',
        color: apiKeyStatus.hasKey ? '#6ee7b7' : '#ff8a8a',
        fontFamily: 'monospace',
      }}
    >
      {apiKeyStatus.message}
    </div>
  );
};

export default APIKeyCheck;
