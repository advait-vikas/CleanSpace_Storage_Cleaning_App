import React, { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: string; }

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: '' };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error: error.message };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('App crashed:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', height: '100vh', padding: '2rem',
                    background: '#0f172a', color: 'white', fontFamily: 'system-ui'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                        Something went wrong
                    </h1>
                    <p style={{ color: '#94a3b8', marginBottom: '1.5rem', maxWidth: '500px', textAlign: 'center' }}>
                        {this.state.error}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: '' })}
                        style={{
                            padding: '0.5rem 1.5rem', background: '#3b82f6',
                            border: 'none', borderRadius: '0.5rem', color: 'white',
                            cursor: 'pointer', fontSize: '1rem'
                        }}
                    >
                        Try Again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
