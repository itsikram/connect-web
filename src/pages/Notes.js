import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api';
import { showErrorToast } from '../utils/toastUtils';
import { openCreatePost } from '../utils/openComposer';

const Notes = () => {
    const navigate = useNavigate();
    const [notes, setNotes] = useState([]);
    const [selectedNote, setSelectedNote] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Handle responsive layout
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load notes from API
    useEffect(() => {
        loadNotes();
    }, []);

    const loadNotes = async () => {
        try {
            setLoading(true);
            const response = await api.get('/notes');
            if (response.data.success) {
                setNotes(response.data.notes || []);
            }
        } catch (error) {
            console.error('Error loading notes:', error);
            showErrorToast('Failed to load notes');
        } finally {
            setLoading(false);
        }
    };

    const filteredNotes = notes.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateNote = async () => {
        try {
            setSaving(true);
            const response = await api.post('/notes', {
                title: 'Untitled Note',
                content: ''
            });
            if (response.data.success) {
                const newNote = response.data.note;
                setNotes([newNote, ...notes]);
                setSelectedNote(newNote);
                setIsCreating(true);
            }
        } catch (error) {
            console.error('Error creating note:', error);
            showErrorToast('Failed to create note');
        } finally {
            setSaving(false);
        }
    };

    const handleSelectNote = (note) => {
        setSelectedNote(note);
        setIsCreating(false);
    };

    const handleUpdateNote = async (field, value) => {
        if (!selectedNote) return;
        
        // Optimistic update
        const updatedNote = {
            ...selectedNote,
            [field]: value,
            updatedAt: new Date().toISOString()
        };
        setSelectedNote(updatedNote);
        setNotes(notes.map(note => note._id === updatedNote._id ? updatedNote : note));

        // Save to API with debounce
        clearTimeout(handleUpdateNote.timeout);
        handleUpdateNote.timeout = setTimeout(async () => {
            try {
                const response = await api.put(`/notes/${selectedNote._id}`, {
                    [field]: value
                });
                if (response.data.success) {
                    const savedNote = response.data.note;
                    setSelectedNote(savedNote);
                    setNotes(notes.map(note => note._id === savedNote._id ? savedNote : note));
                }
            } catch (error) {
                console.error('Error updating note:', error);
                showErrorToast('Failed to update note');
                // Reload notes to get correct state
                loadNotes();
            }
        }, 1000);
    };

    const handleDeleteNote = async () => {
        if (!selectedNote) return;
        if (window.confirm('Are you sure you want to delete this note?')) {
            try {
                setSaving(true);
                const response = await api.delete(`/notes/${selectedNote._id}`);
                if (response.data.success) {
                    setNotes(notes.filter(note => note._id !== selectedNote._id));
                    setSelectedNote(null);
                }
            } catch (error) {
                console.error('Error deleting note:', error);
                showErrorToast('Failed to delete note');
            } finally {
                setSaving(false);
            }
        }
    };

    const pageStyle = {
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0B1220 0%, #0F172A 100%)',
        color: '#E5E7EB',
        display: 'flex',
        flexDirection: 'column'
    };

    const headerStyle = {
        padding: 'clamp(12px, 3vw, 24px)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: 'clamp(12px, 3vw, 16px)'
    };

    const headerLeftStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: 'clamp(12px, 3vw, 16px)',
        flex: 1,
        flexWrap: 'wrap'
    };

    const backButtonStyle = {
        padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#E5E7EB',
        textDecoration: 'none',
        fontSize: 'clamp(12px, 3vw, 14px)',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s'
    };

    const titleStyle = {
        margin: 0,
        fontSize: 'clamp(18px, 4vw, 24px)',
        fontWeight: 700
    };

    const searchInputStyle = {
        padding: 'clamp(8px, 2vw, 10px) clamp(12px, 3vw, 16px)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#E5E7EB',
        fontSize: 'clamp(12px, 3vw, 14px)',
        flex: 1,
        maxWidth: isMobile ? 'none' : '400px',
        minWidth: '200px'
    };

    const createButtonStyle = {
        padding: 'clamp(8px, 2vw, 10px) clamp(16px, 4vw, 20px)',
        background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
        border: 'none',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: 'clamp(12px, 3vw, 14px)',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'transform 0.2s',
        whiteSpace: 'nowrap'
    };

    const containerStyle = {
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        flexDirection: isMobile ? 'column' : 'row'
    };

    const sidebarStyle = {
        width: isMobile ? '100%' : '300px',
        height: isMobile ? '300px' : 'auto',
        borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.1)',
        borderBottom: isMobile ? '1px solid rgba(255,255,255,0.1)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    };

    const notesListStyle = {
        flex: 1,
        overflowY: 'auto',
        padding: '8px'
    };

    const noteItemStyle = {
        padding: 'clamp(10px, 2.5vw, 16px)',
        marginBottom: 'clamp(6px, 1.5vw, 8px)',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s'
    };

    const noteItemActiveStyle = {
        ...noteItemStyle,
        background: 'rgba(99,102,241,0.2)',
        borderColor: 'rgba(99,102,241,0.4)'
    };

    const noteTitleStyle = {
        margin: '0 0 8px 0',
        fontSize: 'clamp(14px, 3.5vw, 16px)',
        fontWeight: 600,
        color: '#E5E7EB',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    };

    const notePreviewStyle = {
        margin: 0,
        fontSize: 'clamp(11px, 2.5vw, 13px)',
        color: 'rgba(229,231,235,0.7)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    };

    const noteDateStyle = {
        margin: '8px 0 0 0',
        fontSize: 'clamp(9px, 2vw, 11px)',
        color: 'rgba(229,231,235,0.5)'
    };

    const editorStyle = {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    };

    const editorToolbarStyle = {
        padding: 'clamp(12px, 3vw, 16px) clamp(16px, 4vw, 24px)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 'clamp(8px, 2vw, 12px)'
    };

    const editorContentStyle = {
        flex: 1,
        padding: 'clamp(16px, 4vw, 24px)',
        overflowY: 'auto'
    };

    const titleInputStyle = {
        width: '100%',
        padding: 'clamp(8px, 2vw, 12px)',
        background: 'transparent',
        border: 'none',
        borderBottom: '2px solid rgba(255,255,255,0.1)',
        color: '#E5E7EB',
        fontSize: 'clamp(20px, 5vw, 28px)',
        fontWeight: 700,
        marginBottom: 'clamp(16px, 4vw, 24px)',
        outline: 'none'
    };

    const contentTextareaStyle = {
        width: '100%',
        minHeight: 'clamp(300px, 40vh, 400px)',
        padding: 'clamp(8px, 2vw, 12px)',
        background: 'transparent',
        border: 'none',
        color: '#E5E7EB',
        fontSize: 'clamp(14px, 3.5vw, 16px)',
        lineHeight: '1.6',
        outline: 'none',
        resize: 'none',
        fontFamily: 'inherit'
    };

    const deleteButtonStyle = {
        padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px)',
        background: 'rgba(239,68,68,0.2)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '8px',
        color: '#EF4444',
        fontSize: 'clamp(12px, 3vw, 14px)',
        fontWeight: 500,
        cursor: 'pointer'
    };

    const emptyStateStyle = {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(24px, 6vw, 48px)',
        textAlign: 'center'
    };

    const emptyIconStyle = {
        fontSize: 'clamp(40px, 8vw, 64px)',
        marginBottom: '16px',
        opacity: 0.5
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div style={pageStyle}>
            <div style={headerStyle}>
                <div style={headerLeftStyle}>
                    <Link to="/menu" style={backButtonStyle}>
                        ← Back
                    </Link>
                    <h1 style={titleStyle}>Notes</h1>
                </div>
                <input
                    type="text"
                    placeholder="Search notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={searchInputStyle}
                />
                <button onClick={handleCreateNote} style={createButtonStyle}>
                    + New Note
                </button>
            </div>

            <div style={containerStyle}>
                <div style={sidebarStyle}>
                    <div style={notesListStyle}>
                        {loading ? (
                            <div style={{ padding: '24px', textAlign: 'center', opacity: 0.6 }}>
                                Loading notes...
                            </div>
                        ) : filteredNotes.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', opacity: 0.6 }}>
                                {searchQuery ? 'No notes found' : 'No notes yet. Create one!'}
                            </div>
                        ) : (
                            filteredNotes.map((note) => (
                                <div
                                    key={note._id}
                                    onClick={() => handleSelectNote(note)}
                                    style={selectedNote?._id === note._id ? noteItemActiveStyle : noteItemStyle}
                                    onMouseEnter={(e) => {
                                        if (selectedNote?._id !== note._id) {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (selectedNote?._id !== note._id) {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                        }
                                    }}
                                >
                                    <h3 style={noteTitleStyle}>{note.title}</h3>
                                    <p style={notePreviewStyle}>{note.content || 'No content'}</p>
                                    <p style={noteDateStyle}>{formatDate(note.updatedAt)}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div style={editorStyle}>
                    {selectedNote ? (
                        <>
                            <div style={editorToolbarStyle}>
                                    <span style={{ fontSize: '13px', opacity: 0.7 }}>
                                    {selectedNote.updatedAt ? `Last updated: ${formatDate(selectedNote.updatedAt)}` : ''}
                                </span>
                                <button onClick={handleDeleteNote} style={deleteButtonStyle}>
                                    Delete
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        openCreatePost({
                                            caption: selectedNote.title && selectedNote.title !== 'Untitled Note'
                                                ? `From my notes: ${selectedNote.title}`
                                                : String(selectedNote.content || '').slice(0, 180),
                                            audience: 3,
                                            navigate,
                                        })
                                    }
                                    style={{
                                        ...deleteButtonStyle,
                                        background: 'rgba(0, 212, 255, 0.12)',
                                        border: '1px solid rgba(0, 212, 255, 0.3)',
                                        color: '#7ce7ff',
                                    }}
                                >
                                    Share as post
                                </button>
                            </div>
                            <div style={editorContentStyle}>
                                <input
                                    type="text"
                                    value={selectedNote.title || ''}
                                    onChange={(e) => handleUpdateNote('title', e.target.value)}
                                    style={titleInputStyle}
                                    placeholder="Note title..."
                                />
                                <textarea
                                    value={selectedNote.content || ''}
                                    onChange={(e) => handleUpdateNote('content', e.target.value)}
                                    style={contentTextareaStyle}
                                    placeholder="Start writing your note..."
                                />
                            </div>
                        </>
                    ) : (
                        <div style={emptyStateStyle}>
                            <div style={emptyIconStyle}>📝</div>
                            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>No note selected</h2>
                            <p style={{ opacity: 0.7, margin: 0 }}>Select a note from the sidebar or create a new one</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Notes;