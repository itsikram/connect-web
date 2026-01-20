import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Tasks = () => {
    const [tasks, setTasks] = useState([]);
    const [newTask, setNewTask] = useState('');
    const [filter, setFilter] = useState('all'); // all, active, completed

    // Load tasks from localStorage
    useEffect(() => {
        const savedTasks = localStorage.getItem('tasksApp');
        if (savedTasks) {
            try {
                setTasks(JSON.parse(savedTasks));
            } catch (e) {
                console.error('Error loading tasks:', e);
            }
        }
    }, []);

    // Save tasks to localStorage
    useEffect(() => {
        if (tasks.length >= 0) {
            localStorage.setItem('tasksApp', JSON.stringify(tasks));
        }
    }, [tasks]);

    const filteredTasks = tasks.filter(task => {
        if (filter === 'active') return !task.completed;
        if (filter === 'completed') return task.completed;
        return true;
    });

    const handleAddTask = () => {
        if (newTask.trim()) {
            const task = {
                id: Date.now(),
                text: newTask.trim(),
                completed: false,
                createdAt: new Date().toISOString()
            };
            setTasks([task, ...tasks]);
            setNewTask('');
        }
    };

    const handleToggleTask = (id) => {
        setTasks(tasks.map(task =>
            task.id === id ? { ...task, completed: !task.completed } : task
        ));
    };

    const handleDeleteTask = (id) => {
        setTasks(tasks.filter(task => task.id !== id));
    };

    const handleClearCompleted = () => {
        setTasks(tasks.filter(task => !task.completed));
    };

    const activeTasksCount = tasks.filter(task => !task.completed).length;
    const completedTasksCount = tasks.filter(task => task.completed).length;

    const pageStyle = {
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0B1220 0%, #0F172A 100%)',
        color: '#E5E7EB',
        padding: '24px',
        maxWidth: '800px',
        margin: '0 auto'
    };

    const headerStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px',
        gap: '16px',
        flexWrap: 'wrap'
    };

    const headerLeftStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
    };

    const backButtonStyle = {
        padding: '8px 16px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#E5E7EB',
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s'
    };

    const titleStyle = {
        margin: 0,
        fontSize: '32px',
        fontWeight: 700
    };

    const statsStyle = {
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap'
    };

    const statItemStyle = {
        padding: '8px 16px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        fontSize: '14px'
    };

    const inputContainerStyle = {
        display: 'flex',
        gap: '12px',
        marginBottom: '32px'
    };

    const inputStyle = {
        flex: 1,
        padding: '14px 18px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        color: '#E5E7EB',
        fontSize: '16px',
        outline: 'none',
        transition: 'all 0.2s'
    };

    const addButtonStyle = {
        padding: '14px 28px',
        background: 'linear-gradient(135deg, #10B981, #34D399)',
        border: 'none',
        borderRadius: '12px',
        color: '#ffffff',
        fontSize: '16px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'transform 0.2s',
        whiteSpace: 'nowrap'
    };

    const filtersStyle = {
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        flexWrap: 'wrap'
    };

    const filterButtonStyle = {
        padding: '10px 20px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#E5E7EB',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s'
    };

    const filterButtonActiveStyle = {
        ...filterButtonStyle,
        background: 'linear-gradient(135deg, #10B981, #34D399)',
        borderColor: 'transparent',
        color: '#ffffff'
    };

    const tasksListStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '24px'
    };

    const taskItemStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        transition: 'all 0.2s'
    };

    const taskItemCompletedStyle = {
        ...taskItemStyle,
        opacity: 0.6
    };

    const checkboxStyle = {
        width: '20px',
        height: '20px',
        borderRadius: '6px',
        border: '2px solid rgba(255,255,255,0.3)',
        background: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.2s'
    };

    const checkboxCheckedStyle = {
        ...checkboxStyle,
        background: 'linear-gradient(135deg, #10B981, #34D399)',
        borderColor: 'transparent'
    };

    const taskTextStyle = {
        flex: 1,
        fontSize: '16px',
        color: '#E5E7EB',
        margin: 0
    };

    const taskTextCompletedStyle = {
        ...taskTextStyle,
        textDecoration: 'line-through',
        opacity: 0.7
    };

    const deleteButtonStyle = {
        padding: '6px 12px',
        background: 'rgba(239,68,68,0.2)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '6px',
        color: '#EF4444',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s'
    };

    const clearButtonStyle = {
        padding: '12px 24px',
        background: 'rgba(239,68,68,0.2)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '8px',
        color: '#EF4444',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s',
        alignSelf: 'flex-start'
    };

    const emptyStateStyle = {
        textAlign: 'center',
        padding: '48px',
        opacity: 0.6
    };

    const emptyIconStyle = {
        fontSize: '64px',
        marginBottom: '16px'
    };

    return (
        <div style={pageStyle}>
            <div style={headerStyle}>
                <div style={headerLeftStyle}>
                    <Link to="/menu" style={backButtonStyle}>
                        ← Back
                    </Link>
                    <h1 style={titleStyle}>Tasks</h1>
                </div>
                {tasks.length > 0 && (
                    <div style={statsStyle}>
                        <div style={statItemStyle}>
                            Total: <strong>{tasks.length}</strong>
                        </div>
                        <div style={statItemStyle}>
                            Active: <strong>{activeTasksCount}</strong>
                        </div>
                        <div style={statItemStyle}>
                            Completed: <strong>{completedTasksCount}</strong>
                        </div>
                    </div>
                )}
            </div>

            <div style={inputContainerStyle}>
                <input
                    type="text"
                    placeholder="Add a new task..."
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                    style={inputStyle}
                />
                <button onClick={handleAddTask} style={addButtonStyle}>
                    Add Task
                </button>
            </div>

            {tasks.length > 0 && (
                <div style={filtersStyle}>
                    <button
                        onClick={() => setFilter('all')}
                        style={filter === 'all' ? filterButtonActiveStyle : filterButtonStyle}
                    >
                        All ({tasks.length})
                    </button>
                    <button
                        onClick={() => setFilter('active')}
                        style={filter === 'active' ? filterButtonActiveStyle : filterButtonStyle}
                    >
                        Active ({activeTasksCount})
                    </button>
                    <button
                        onClick={() => setFilter('completed')}
                        style={filter === 'completed' ? filterButtonActiveStyle : filterButtonStyle}
                    >
                        Completed ({completedTasksCount})
                    </button>
                </div>
            )}

            {filteredTasks.length === 0 ? (
                <div style={emptyStateStyle}>
                    <div style={emptyIconStyle}>
                        {filter === 'completed' ? '✅' : filter === 'active' ? '📋' : '✅'}
                    </div>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>
                        {filter === 'completed' ? 'No completed tasks' : filter === 'active' ? 'No active tasks' : 'No tasks yet'}
                    </h2>
                    <p style={{ margin: 0 }}>
                        {filter === 'all' && 'Add your first task to get started!'}
                    </p>
                </div>
            ) : (
                <>
                    <div style={tasksListStyle}>
                        {filteredTasks.map((task) => (
                            <div
                                key={task.id}
                                style={task.completed ? taskItemCompletedStyle : taskItemStyle}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                }}
                            >
                                <div
                                    onClick={() => handleToggleTask(task.id)}
                                    style={task.completed ? checkboxCheckedStyle : checkboxStyle}
                                >
                                    {task.completed && (
                                        <span style={{ color: '#ffffff', fontSize: '12px' }}>✓</span>
                                    )}
                                </div>
                                <p style={task.completed ? taskTextCompletedStyle : taskTextStyle}>
                                    {task.text}
                                </p>
                                <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    style={deleteButtonStyle}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(239,68,68,0.3)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        ))}
                    </div>
                    {completedTasksCount > 0 && (
                        <button
                            onClick={handleClearCompleted}
                            style={clearButtonStyle}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239,68,68,0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                            }}
                        >
                            Clear Completed ({completedTasksCount})
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

export default Tasks;