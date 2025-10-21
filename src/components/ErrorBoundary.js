import React from 'react';
import { showErrorToast } from '../utils/toastUtils';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError() {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log error details
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        
        this.setState({
            error: error,
            errorInfo: errorInfo
        });

        // Show user-friendly error message
        showErrorToast('Something went wrong. Please refresh the page or try again.', {
            title: 'Application Error',
            autoClose: 10000
        });
    }

    render() {
        if (this.state.hasError) {
            // Fallback UI
            return (
                <div className="error-boundary" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '200px',
                    padding: '20px',
                    textAlign: 'center',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    margin: '20px'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                    <h3 style={{ color: '#dc3545', marginBottom: '16px' }}>Oops! Something went wrong</h3>
                    <p style={{ color: '#6c757d', marginBottom: '20px' }}>
                        We&apos;re sorry, but something unexpected happened. Please try refreshing the page.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        Refresh Page
                    </button>
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <details style={{ marginTop: '20px', textAlign: 'left' }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                                Error Details (Development Only)
                            </summary>
                            <pre style={{ 
                                backgroundColor: '#f8f9fa', 
                                padding: '10px', 
                                borderRadius: '4px',
                                overflow: 'auto',
                                fontSize: '12px',
                                marginTop: '10px'
                            }}>
                                {this.state.error && this.state.error.toString()}
                                <br />
                                {this.state.errorInfo.componentStack}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
