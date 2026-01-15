import React, { useState, useEffect, useCallback, useRef } from 'react';
import StickyChatBox from './StickyChatBox';
import api from '../../api/api';
import './StickyChatBox.css';

const StickyChatBoxContainer = () => {
    const [openChats, setOpenChats] = useState([]);
    const [maxChats] = useState(5); // Maximum number of open chats
    const openChatsRef = useRef(openChats);

    // Keep ref in sync with state
    useEffect(() => {
        openChatsRef.current = openChats;
    }, [openChats]);

    // Expose function to check if chat is open (for external use)
    useEffect(() => {
        window.isStickyChatOpen = (profileId) => {
            return openChatsRef.current.some(chat => chat.friendProfile?._id === profileId);
        };
        return () => {
            delete window.isStickyChatOpen;
        };
    }, []);

    const closeChat = useCallback((profileId) => {
        setOpenChats(prev => prev.filter(chat => chat.friendProfile?._id !== profileId));
    }, []);

    const openChat = useCallback(async (profileId) => {
        // Check if chat is already open using ref to get latest state
        const existingChat = openChatsRef.current.find(chat => chat.friendProfile?._id === profileId);
        if (existingChat && existingChat.friendProfile?._id) {
            // If minimized, maximize it
            setOpenChats(prev => prev.map(chat => 
                chat.friendProfile?._id === profileId 
                    ? { ...chat, isMinimized: false }
                    : chat
            ));
            return true; // Return true to indicate chat was already open
        }

        // If max chats reached, close the oldest minimized chat or the last one
        if (openChatsRef.current.length >= maxChats) {
            const minimizedChat = openChatsRef.current.find(chat => chat.isMinimized);
            if (minimizedChat) {
                setOpenChats(prev => prev.filter(chat => chat.friendProfile?._id !== minimizedChat.friendProfile?._id));
            } else {
                const lastChat = openChatsRef.current[openChatsRef.current.length - 1];
                setOpenChats(prev => prev.filter(chat => chat.friendProfile?._id !== lastChat.friendProfile?._id));
            }
        }

        // Create chat immediately with loading state
        const loadingProfile = {
            _id: profileId,
            isLoading: true,
            fullName: 'Loading...',
            profilePic: null,
            user: {
                firstName: '',
                surname: ''
            }
        };

        const newChat = {
            id: Date.now(),
            friendProfile: loadingProfile,
            isMinimized: false,
            isLoading: true
        };

        setOpenChats(prev => [...prev, newChat]);

        // Fetch friend profile in background
        try {
            const response = await api.get('/profile', {
                params: { profileId }
            });

            // Update the chat with real profile data
            setOpenChats(prev => prev.map(chat => 
                chat.id === newChat.id
                    ? { ...chat, friendProfile: response.data, isLoading: false }
                    : chat
            ));
        } catch (error) {
            console.error('Error opening chat:', error);
            // Remove chat on error or show error state
            setOpenChats(prev => prev.filter(chat => chat.id !== newChat.id));
        }
        return false; // Return false to indicate new chat was opened
    }, []);

    const minimizeChat = useCallback((profileId) => {
        setOpenChats(prev => prev.map(chat => 
            chat.friendProfile?._id === profileId 
                ? { ...chat, isMinimized: !chat.isMinimized }
                : chat
        ));
    }, []);

    // Listen for open chat events from anywhere in the app
    useEffect(() => {
        const handleOpenChat = (event) => {
            const { profileId } = event.detail;
            openChat(profileId);
        };

        window.addEventListener('openStickyChat', handleOpenChat);

        return () => {
            window.removeEventListener('openStickyChat', handleOpenChat);
        };
    }, [openChat]);

    // Calculate positions for chat boxes
    const getChatPosition = (index, total) => {
        const baseRight = 20;
        const baseBottom = 20;
        const chatWidth = 360;
        const chatHeight = 500;
        const minimizedHeight = 60;
        const spacing = 20;

        const right = baseRight + (total - index - 1) * (chatWidth + spacing);
        const bottom = baseBottom;

        return { right, bottom };
    };

    if (openChats.length === 0) {
        return null;
    }

    return (
        <div className="sticky-chat-container">
            {openChats.map((chat, index) => {
                const position = getChatPosition(index, openChats.length);
                const zIndex = 1000 + index;

                return (
                    <div
                        key={chat.id}
                        className="sticky-chat-wrapper"
                        style={{
                            right: `${position.right}px`,
                            bottom: `${position.bottom}px`,
                            zIndex
                        }}
                    >
                        <StickyChatBox
                            friendProfile={chat.friendProfile}
                            onClose={() => closeChat(chat.friendProfile?._id)}
                            onMinimize={() => minimizeChat(chat.friendProfile?._id)}
                            isMinimized={chat.isMinimized}
                            zIndex={zIndex}
                            isLoading={chat.isLoading}
                        />
                    </div>
                );
            })}
        </div>
    );
};

export default StickyChatBoxContainer;
