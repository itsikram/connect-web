import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Flashcards = () => {
    const [decks, setDecks] = useState([]);
    const [selectedDeck, setSelectedDeck] = useState(null);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [showDeckForm, setShowDeckForm] = useState(false);
    const [newDeckName, setNewDeckName] = useState('');
    const [newCardFront, setNewCardFront] = useState('');
    const [newCardBack, setNewCardBack] = useState('');
    const [showCardForm, setShowCardForm] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Handle responsive layout
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load decks from localStorage
    useEffect(() => {
        const savedDecks = localStorage.getItem('flashcardsApp');
        if (savedDecks) {
            try {
                const parsed = JSON.parse(savedDecks);
                setDecks(parsed);
            } catch (e) {
                console.error('Error loading flashcards:', e);
            }
        }
    }, []);

    // Save decks to localStorage
    useEffect(() => {
        if (decks.length >= 0) {
            localStorage.setItem('flashcardsApp', JSON.stringify(decks));
        }
    }, [decks]);

    const handleCreateDeck = () => {
        if (newDeckName.trim()) {
            const newDeck = {
                id: Date.now(),
                name: newDeckName.trim(),
                cards: [],
                createdAt: new Date().toISOString()
            };
            setDecks([...decks, newDeck]);
            setNewDeckName('');
            setShowDeckForm(false);
            setSelectedDeck(newDeck);
        }
    };

    const handleSelectDeck = (deck) => {
        setSelectedDeck(deck);
        setCurrentCardIndex(0);
        setIsFlipped(false);
        setShowCardForm(false);
    };

    const handleAddCard = () => {
        if (!selectedDeck || !newCardFront.trim() || !newCardBack.trim()) return;

        const newCard = {
            id: Date.now(),
            front: newCardFront.trim(),
            back: newCardBack.trim(),
            createdAt: new Date().toISOString()
        };

        const updatedDecks = decks.map(deck =>
            deck.id === selectedDeck.id
                ? { ...deck, cards: [...deck.cards, newCard] }
                : deck
        );

        setDecks(updatedDecks);
        setSelectedDeck(updatedDecks.find(d => d.id === selectedDeck.id));
        setNewCardFront('');
        setNewCardBack('');
        setShowCardForm(false);
    };

    const handleDeleteCard = (cardId) => {
        if (!selectedDeck) return;
        const updatedDecks = decks.map(deck =>
            deck.id === selectedDeck.id
                ? { ...deck, cards: deck.cards.filter(card => card.id !== cardId) }
                : deck
        );
        setDecks(updatedDecks);
        const updatedDeck = updatedDecks.find(d => d.id === selectedDeck.id);
        setSelectedDeck(updatedDeck);
        if (currentCardIndex >= updatedDeck.cards.length) {
            setCurrentCardIndex(Math.max(0, updatedDeck.cards.length - 1));
        }
    };

    const handleDeleteDeck = (deckId) => {
        if (window.confirm('Are you sure you want to delete this deck?')) {
            const updatedDecks = decks.filter(deck => deck.id !== deckId);
            setDecks(updatedDecks);
            if (selectedDeck?.id === deckId) {
                setSelectedDeck(null);
            }
        }
    };

    const handleNextCard = () => {
        if (!selectedDeck || selectedDeck.cards.length === 0) return;
        setCurrentCardIndex((prev) => (prev + 1) % selectedDeck.cards.length);
        setIsFlipped(false);
    };

    const handlePrevCard = () => {
        if (!selectedDeck || selectedDeck.cards.length === 0) return;
        setCurrentCardIndex((prev) => (prev - 1 + selectedDeck.cards.length) % selectedDeck.cards.length);
        setIsFlipped(false);
    };

    const currentCard = selectedDeck && selectedDeck.cards.length > 0
        ? selectedDeck.cards[currentCardIndex]
        : null;

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

    const buttonStyle = {
        padding: 'clamp(8px, 2vw, 10px) clamp(16px, 4vw, 20px)',
        background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
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
        overflow: 'hidden',
        padding: 'clamp(12px, 3vw, 16px)'
    };

    const deckListStyle = {
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    };

    const deckItemStyle = {
        padding: 'clamp(10px, 2.5vw, 16px)',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s'
    };

    const deckItemActiveStyle = {
        ...deckItemStyle,
        background: 'rgba(59,130,246,0.2)',
        borderColor: 'rgba(59,130,246,0.4)'
    };

    const deckNameStyle = {
        margin: '0 0 4px 0',
        fontSize: 'clamp(14px, 3.5vw, 16px)',
        fontWeight: 600
    };

    const deckCountStyle = {
        margin: 0,
        fontSize: 'clamp(11px, 2.5vw, 13px)',
        opacity: 0.7
    };

    const deleteButtonStyle = {
        padding: 'clamp(4px, 1vw, 6px) clamp(8px, 2vw, 12px)',
        background: 'rgba(239,68,68,0.2)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '6px',
        color: '#EF4444',
        fontSize: 'clamp(10px, 2.5vw, 12px)',
        cursor: 'pointer',
        marginTop: '8px'
    };

    const mainContentStyle = {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(24px, 6vw, 48px)',
        gap: 'clamp(20px, 5vw, 32px)'
    };

    const cardContainerStyle = {
        perspective: '1000px',
        width: '100%',
        maxWidth: 'clamp(400px, 80vw, 600px)',
        height: 'clamp(250px, 50vh, 400px)'
    };

    const cardStyle = {
        width: '100%',
        height: '100%',
        position: 'relative',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.6s',
        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
    };

    const cardFaceStyle = {
        position: 'absolute',
        width: '100%',
        height: '100%',
        backfaceVisibility: 'hidden',
        borderRadius: '16px',
        padding: 'clamp(20px, 5vw, 32px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
    };

    const cardBackStyle = {
        ...cardFaceStyle,
        transform: 'rotateY(180deg)',
        background: 'linear-gradient(135deg, #3B82F6, #06B6D4)'
    };

    const cardTextStyle = {
        fontSize: 'clamp(18px, 4vw, 24px)',
        fontWeight: 600,
        textAlign: 'center',
        lineHeight: '1.5'
    };

    const controlsStyle = {
        display: 'flex',
        gap: 'clamp(8px, 2vw, 12px)',
        alignItems: 'center',
        flexWrap: 'wrap'
    };

    const navButtonStyle = {
        padding: 'clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#E5E7EB',
        fontSize: 'clamp(12px, 3vw, 14px)',
        fontWeight: 500,
        cursor: 'pointer'
    };

    const flipButtonStyle = {
        padding: 'clamp(8px, 2vw, 12px) clamp(20px, 5vw, 32px)',
        background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
        border: 'none',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: 'clamp(14px, 3.5vw, 16px)',
        fontWeight: 600,
        cursor: 'pointer'
    };

    const inputStyle = {
        padding: 'clamp(8px, 2vw, 12px)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#E5E7EB',
        fontSize: 'clamp(12px, 3vw, 14px)',
        width: '100%',
        marginBottom: 'clamp(8px, 2vw, 12px)'
    };

    const formButtonStyle = {
        padding: 'clamp(8px, 2vw, 10px) clamp(16px, 4vw, 20px)',
        background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
        border: 'none',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: 'clamp(12px, 3vw, 14px)',
        fontWeight: 600,
        cursor: 'pointer'
    };

    const emptyStateStyle = {
        textAlign: 'center',
        opacity: 0.6
    };

    const emptyIconStyle = {
        fontSize: 'clamp(40px, 8vw, 64px)',
        marginBottom: '16px'
    };

    return (
        <div style={pageStyle}>
            <div style={headerStyle}>
                <div style={headerLeftStyle}>
                    <Link to="/menu" style={backButtonStyle}>
                        ← Back
                    </Link>
                    <h1 style={titleStyle}>Flashcards</h1>
                </div>
                <button onClick={() => setShowDeckForm(!showDeckForm)} style={buttonStyle}>
                    + New Deck
                </button>
            </div>

            <div style={containerStyle}>
                <div style={sidebarStyle}>
                    {showDeckForm && (
                        <div style={{ marginBottom: '16px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            <input
                                type="text"
                                placeholder="Deck name..."
                                value={newDeckName}
                                onChange={(e) => setNewDeckName(e.target.value)}
                                style={inputStyle}
                                onKeyPress={(e) => e.key === 'Enter' && handleCreateDeck()}
                            />
                            <button onClick={handleCreateDeck} style={formButtonStyle}>
                                Create
                            </button>
                        </div>
                    )}

                    <div style={deckListStyle}>
                        {decks.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px', opacity: 0.6 }}>
                                No decks yet. Create one!
                            </div>
                        ) : (
                            decks.map((deck) => (
                                <div key={deck.id}>
                                    <div
                                        onClick={() => handleSelectDeck(deck)}
                                        style={selectedDeck?.id === deck.id ? deckItemActiveStyle : deckItemStyle}
                                        onMouseEnter={(e) => {
                                            if (selectedDeck?.id !== deck.id) {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (selectedDeck?.id !== deck.id) {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                            }
                                        }}
                                    >
                                        <h3 style={deckNameStyle}>{deck.name}</h3>
                                        <p style={deckCountStyle}>{deck.cards.length} cards</p>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteDeck(deck.id)}
                                        style={deleteButtonStyle}
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div style={mainContentStyle}>
                    {!selectedDeck ? (
                        <div style={emptyStateStyle}>
                            <div style={emptyIconStyle}>🧠</div>
                            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>No deck selected</h2>
                            <p style={{ margin: 0 }}>Select a deck from the sidebar or create a new one</p>
                        </div>
                    ) : selectedDeck.cards.length === 0 ? (
                        <div style={emptyStateStyle}>
                            {showCardForm ? (
                                <div style={{ width: '100%', maxWidth: '500px' }}>
                                    <input
                                        type="text"
                                        placeholder="Front of card..."
                                        value={newCardFront}
                                        onChange={(e) => setNewCardFront(e.target.value)}
                                        style={inputStyle}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Back of card..."
                                        value={newCardBack}
                                        onChange={(e) => setNewCardBack(e.target.value)}
                                        style={inputStyle}
                                    />
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button onClick={handleAddCard} style={formButtonStyle}>
                                            Add Card
                                        </button>
                                        <button
                                            onClick={() => setShowCardForm(false)}
                                            style={{ ...formButtonStyle, background: 'rgba(255,255,255,0.1)' }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div style={emptyIconStyle}>📝</div>
                                    <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>No cards yet</h2>
                                    <p style={{ margin: '0 0 24px 0' }}>Add your first card to get started!</p>
                                    <button onClick={() => setShowCardForm(true)} style={buttonStyle}>
                                        + Add Card
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            {showCardForm ? (
                                <div style={{ width: '100%', maxWidth: '500px' }}>
                                    <input
                                        type="text"
                                        placeholder="Front of card..."
                                        value={newCardFront}
                                        onChange={(e) => setNewCardFront(e.target.value)}
                                        style={inputStyle}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Back of card..."
                                        value={newCardBack}
                                        onChange={(e) => setNewCardBack(e.target.value)}
                                        style={inputStyle}
                                    />
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button onClick={handleAddCard} style={formButtonStyle}>
                                            Add Card
                                        </button>
                                        <button
                                            onClick={() => setShowCardForm(false)}
                                            style={{ ...formButtonStyle, background: 'rgba(255,255,255,0.1)' }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div style={cardContainerStyle}>
                                        <div style={cardStyle} onClick={() => setIsFlipped(!isFlipped)}>
                                            <div style={cardFaceStyle}>
                                                <div style={cardTextStyle}>{currentCard.front}</div>
                                            </div>
                                            <div style={cardBackStyle}>
                                                <div style={cardTextStyle}>{currentCard.back}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={controlsStyle}>
                                        <button onClick={handlePrevCard} style={navButtonStyle}>
                                            ← Prev
                                        </button>
                                        <button onClick={() => setIsFlipped(!isFlipped)} style={flipButtonStyle}>
                                            {isFlipped ? 'Show Front' : 'Flip Card'}
                                        </button>
                                        <button onClick={handleNextCard} style={navButtonStyle}>
                                            Next →
                                        </button>
                                    </div>

                                    <div style={{ fontSize: '14px', opacity: 0.7 }}>
                                        Card {currentCardIndex + 1} of {selectedDeck.cards.length}
                                    </div>

                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button onClick={() => setShowCardForm(true)} style={buttonStyle}>
                                            + Add Card
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCard(currentCard.id)}
                                            style={{ ...buttonStyle, background: 'rgba(239,68,68,0.3)', color: '#EF4444' }}
                                        >
                                            Delete Card
                                        </button>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Flashcards;