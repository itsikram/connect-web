import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import webNotificationService from '../services/webNotificationService';
import { 
    sendNotificationToAllBrowsers, 
    sendNotificationToBrowsers, 
    getBrowserIds,
    createNotificationData 
} from '../utils/notificationUtils';
import api from '../api/api';

const NotificationTest = () => {
    const [browserIds, setBrowserIds] = useState([]);
    const [selectedBrowserIds, setSelectedBrowserIds] = useState([]);
    const [notificationText, setNotificationText] = useState('Test notification from Connect App');
    const [notificationTitle, setNotificationTitle] = useState('Connect Test');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    
    const userInfo = JSON.parse((localStorage.getItem('user') || '{}'));
    const profileId = userInfo.profile;

    // Load browser IDs on component mount
    useEffect(() => {
        if (profileId) {
            loadBrowserIds();
        }
    }, [profileId]);

    const loadBrowserIds = async () => {
        try {
            const response = await getBrowserIds(profileId);
            setBrowserIds(response.data.browserIds || []);
        } catch (error) {
            console.error('Error loading browser IDs:', error);
            setStatus('Error loading browser IDs');
        }
    };

    const handleBrowserIdToggle = (browserId) => {
        setSelectedBrowserIds(prev => 
            prev.includes(browserId) 
                ? prev.filter(id => id !== browserId)
                : [...prev, browserId]
        );
    };

    const handleSelectAll = () => {
        setSelectedBrowserIds(browserIds.map(browser => browser.browserId));
    };

    const handleDeselectAll = () => {
        setSelectedBrowserIds([]);
    };

    const sendTestNotification = async (type = 'all') => {
        if (!profileId) {
            setStatus('Profile ID not found');
            return;
        }

        setLoading(true);
        setStatus('');

        try {
            const notificationData = createNotificationData({
                title: notificationTitle,
                text: notificationText,
                icon: '/logo192.png',
                link: '/',
                type: 'test',
                requireInteraction: true
            });

            let result;
            if (type === 'all') {
                result = await sendNotificationToAllBrowsers(profileId, notificationData);
            } else {
                if (selectedBrowserIds.length === 0) {
                    setStatus('Please select at least one browser ID');
                    setLoading(false);
                    return;
                }
                result = await sendNotificationToBrowsers(profileId, selectedBrowserIds, notificationData);
            }

            setStatus(`✅ Notification sent successfully! Sent to ${result.data.sentToBrowsers} browser(s)`);
        } catch (error) {
            setStatus(`❌ Error: ${error.response?.data?.message || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const sendLocalTestNotification = async () => {
        try {
            await webNotificationService.sendTestNotification(notificationTitle, notificationText);
            setStatus('✅ Local test notification sent');
        } catch (error) {
            setStatus(`❌ Local notification failed: ${error.message}`);
        }
    };

    const checkNotificationStatus = () => {
        const status = webNotificationService.getStatus();
        const statusText = `
            Supported: ${status.isSupported ? '✅' : '❌'}
            Permission: ${status.isPermissionGranted ? '✅' : '❌'}
            Browser ID: ${status.browserId ? '✅' : '❌'}
            Service Worker: ${status.registration ? '✅' : '❌'}
        `;
        setStatus(statusText);
    };

    if (!profileId) {
        return (
            <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px' }}>
                <h3>Web Notification Test</h3>
                <p>Please log in to test web notifications.</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px' }}>
            <h3>Web Notification Test</h3>
            
            <div style={{ marginBottom: '20px' }}>
                <h4>Notification Content</h4>
                <div style={{ marginBottom: '10px' }}>
                    <label>Title: </label>
                    <input 
                        type="text" 
                        value={notificationTitle} 
                        onChange={(e) => setNotificationTitle(e.target.value)}
                        style={{ width: '200px', padding: '5px' }}
                    />
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label>Text: </label>
                    <input 
                        type="text" 
                        value={notificationText} 
                        onChange={(e) => setNotificationText(e.target.value)}
                        style={{ width: '300px', padding: '5px' }}
                    />
                </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h4>Browser IDs ({browserIds.length} found)</h4>
                <div style={{ marginBottom: '10px' }}>
                    <button onClick={handleSelectAll} style={{ marginRight: '10px', padding: '5px 10px' }}>
                        Select All
                    </button>
                    <button onClick={handleDeselectAll} style={{ padding: '5px 10px' }}>
                        Deselect All
                    </button>
                </div>
                
                {browserIds.length === 0 ? (
                    <p>No browser IDs found. Make sure you&apos;ve initialized the notification service.</p>
                ) : (
                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', padding: '10px' }}>
                        {browserIds.map((browser, index) => (
                            <div key={browser.browserId} style={{ marginBottom: '5px' }}>
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedBrowserIds.includes(browser.browserId)}
                                        onChange={() => handleBrowserIdToggle(browser.browserId)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    {browser.browserId} 
                                    <small style={{ color: '#666', marginLeft: '10px' }}>
                                        ({browser.isActive ? 'Active' : 'Inactive'}) - 
                                        {new Date(browser.lastActive).toLocaleString()}
                                    </small>
                                </label>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h4>Test Actions</h4>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button 
                        onClick={() => sendTestNotification('all')} 
                        disabled={loading || browserIds.length === 0}
                        style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                        Send to All Browsers
                    </button>
                    
                    <button 
                        onClick={() => sendTestNotification('selected')} 
                        disabled={loading || selectedBrowserIds.length === 0}
                        style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                        Send to Selected ({selectedBrowserIds.length})
                    </button>
                    
                    <button 
                        onClick={sendLocalTestNotification}
                        style={{ padding: '8px 16px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px' }}
                    >
                        Local Test
                    </button>
                    
                    <button 
                        onClick={checkNotificationStatus}
                        style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                        Check Status
                    </button>
                    
                    <button 
                        onClick={loadBrowserIds}
                        style={{ padding: '8px 16px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                        Refresh Browser IDs
                    </button>
                </div>
            </div>

            {status && (
                <div style={{ 
                    padding: '10px', 
                    backgroundColor: '#f8f9fa', 
                    border: '1px solid #dee2e6', 
                    borderRadius: '4px',
                    whiteSpace: 'pre-line'
                }}>
                    <strong>Status:</strong><br />
                    {status}
                </div>
            )}

            {loading && (
                <div style={{ marginTop: '10px', color: '#007bff' }}>
                    Sending notification...
                </div>
            )}
        </div>
    );
};

export default NotificationTest;
