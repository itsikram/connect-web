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
        background: apiKeyStatus.hasKey ? '#ecfdf5' : '#fef2f2',
        border: `1px solid ${apiKeyStatus.hasKey ? '#d1fae5' : '#fecaca'}`,
        borderRadius: '8px',
        fontSize: '12px',
        color: apiKeyStatus.hasKey ? '#065f46' : '#7f1d1d',
        fontFamily: 'monospace',
      }}
    >
      {apiKeyStatus.message}
    </div>
  );
};

export default APIKeyCheck;
