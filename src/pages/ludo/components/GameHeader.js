import React from 'react';

export const GameHeader = ({
    gameStarted,
    gameId,
    savedGameStateRef,
    isDebug,
    isSpecialUser,
    controlMode,
    onStartGame,
    onResetGame,
    onExitGame,
    onTriggerDebugCelebration,
    onToggleControlMode,
    onPlaySound
}) => {
    return (
        <div style={{ padding: '10px 20px', background: 'rgba(26, 35, 50, 0.9)', borderBottom: '1px solid rgba(255, 215, 0, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: '#00D4FF', fontSize: 28, fontWeight: 'bold' }}>Ludo Classic</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {!gameStarted ? (
                    <>
                        <button onClick={onStartGame} style={{ background: '#00D4FF', color: 'white', padding: '8px 36px', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>Start</button>
                        {(gameId || savedGameStateRef?.current) && (
                            <button
                                onClick={onExitGame}
                                style={{
                                    background: '#888888',
                                    color: 'white',
                                    padding: '10px 20px',
                                    border: 'none',
                                    borderRadius: 20,
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}
                                title="Exit game and clear all saved data"
                            >
                                <span>🚪</span>
                                <span>Exit Game</span>
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        <button
                            onClick={onResetGame}
                            style={{
                                background: '#FF4444',
                                color: 'white',
                                padding: '10px 20px',
                                border: 'none',
                                borderRadius: 20,
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}
                            title="Restart the game from beginning"
                        >
                            <span>🔄</span>
                            <span>Restart</span>
                        </button>
                        <button
                            onClick={onExitGame}
                            style={{
                                background: '#888888',
                                color: 'white',
                                padding: '10px 20px',
                                border: 'none',
                                borderRadius: 20,
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}
                            title="Exit game and clear all saved data"
                        >
                            <span>🚪</span>
                            <span>Exit Game</span>
                        </button>
                    </>
                )}
                {isDebug && (
                    <button onClick={onTriggerDebugCelebration} title="Debug: Test celebration" style={{ background: 'transparent', color: '#FFD700', padding: '6px 10px', border: '1px solid #FFD700', borderRadius: 12, cursor: 'pointer', fontWeight: 700 }}>Debug Celebrate</button>
                )}
                {(isSpecialUser || isDebug) && (
                    <button
                        onClick={() => {
                            onToggleControlMode();
                            onPlaySound('buttonClick');
                        }}
                        title={controlMode ? "Disable control mode (dice prompts)" : "Enable control mode (dice prompts)"}
                        style={{
                            background: controlMode ? '#29B1A9' : 'transparent',
                            color: controlMode ? 'white' : '#29B1A9',
                            padding: '6px 10px',
                            border: `1px solid ${controlMode ? '#29B1A9' : '#29B1A9'}`,
                            borderRadius: 12,
                            cursor: 'pointer',
                            fontWeight: 700
                        }}
                    >
                        {controlMode ? 'Control On' : 'Control Off'}
                    </button>
                )}
            </div>
        </div>
    );
};
