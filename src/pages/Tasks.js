import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import { showErrorToast } from '../utils/toastUtils';

const Tasks = () => {
    const [tasks, setTasks] = useState([]);
    const [newTask, setNewTask] = useState('');
    const [filter, setFilter] = useState('all'); // all, active, completed
    const [loading, setLoading] = useState(true);

    // Load tasks from API
    useEffect(() => {
        loadTasks();
        const reload = () => loadTasks();
        window.addEventListener('connect:tasks-changed', reload);
        return () => window.removeEventListener('connect:tasks-changed', reload);
    }, []);

    const loadTasks = async () => {
        try {
            setLoading(true);
            const response = await api.get('/tasks');
            if (response.data.success) {
                setTasks(response.data.tasks || []);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            showErrorToast('Failed to load tasks');
        } finally {
            setLoading(false);
        }
    };

    const filteredTasks = tasks.filter(task => {
        if (filter === 'active') return !task.completed;
        if (filter === 'completed') return task.completed;
        return true;
    });

    const handleAddTask = async () => {
        if (newTask.trim()) {
            try {
                const response = await api.post('/tasks', {
                    text: newTask.trim()
                });
                if (response.data.success) {
                    setTasks([response.data.task, ...tasks]);
                    setNewTask('');
                }
            } catch (error) {
                console.error('Error creating task:', error);
                showErrorToast('Failed to create task');
            }
        }
    };

    const handleToggleTask = async (id) => {
        const task = tasks.find(t => t._id === id);
        if (!task) return;
        
        // Optimistic update
        setTasks(tasks.map(t =>
            t._id === id ? { ...t, completed: !t.completed } : t
        ));

        try {
            const response = await api.put(`/tasks/${id}`, {
                completed: !task.completed
            });
            if (response.data.success) {
                setTasks(tasks.map(t => t._id === id ? response.data.task : t));
            }
        } catch (error) {
            console.error('Error updating task:', error);
            showErrorToast('Failed to update task');
            loadTasks(); // Reload on error
        }
    };

    const handleDeleteTask = async (id) => {
        try {
            const response = await api.delete(`/tasks/${id}`);
            if (response.data.success) {
                setTasks(tasks.filter(task => task._id !== id));
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            showErrorToast('Failed to delete task');
        }
    };

    const handleClearCompleted = async () => {
        try {
            const response = await api.delete('/tasks/completed/all');
            if (response.data.success) {
                setTasks(tasks.filter(task => !task.completed));
            }
        } catch (error) {
            console.error('Error clearing completed tasks:', error);
            showErrorToast('Failed to clear completed tasks');
        }
    };

    const activeTasksCount = tasks.filter(task => !task.completed).length;
    const completedTasksCount = tasks.filter(task => task.completed).length;

    const pageStyle = {
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0B1220 0%, #0F172A 100%)',
        color: '#E5E7EB',
        padding: 'clamp(12px, 3vw, 24px)',
        maxWidth: '800px',
        margin: '0 auto'
    };

    const headerStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'clamp(20px, 5vw, 32px)',
        gap: 'clamp(12px, 3vw, 16px)',
        flexWrap: 'wrap'
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
        fontSize: 'clamp(24px, 6vw, 32px)',
        fontWeight: 700
    };

    const statsStyle = {
        display: 'flex',
        gap: 'clamp(8px, 2vw, 16px)',
        flexWrap: 'wrap'
    };

    const statItemStyle = {
        padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        fontSize: 'clamp(12px, 3vw, 14px)'
    };

    const inputContainerStyle = {
        display: 'flex',
        gap: 'clamp(8px, 2vw, 12px)',
        marginBottom: 'clamp(20px, 5vw, 32px)',
        flexWrap: 'wrap'
    };

    const inputStyle = {
        flex: 1,
        padding: 'clamp(10px, 2.5vw, 14px) clamp(14px, 3.5vw, 18px)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        color: '#E5E7EB',
        fontSize: 'clamp(14px, 3.5vw, 16px)',
        outline: 'none',
        transition: 'all 0.2s',
        minWidth: '200px'
    };

    const addButtonStyle = {
        padding: 'clamp(10px, 2.5vw, 14px) clamp(20px, 5vw, 28px)',
        background: 'linear-gradient(135deg, #10B981, #34D399)',
        border: 'none',
        borderRadius: '12px',
        color: '#ffffff',
        fontSize: 'clamp(14px, 3.5vw, 16px)',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'transform 0.2s',
        whiteSpace: 'nowrap'
    };

    const filtersStyle = {
        display: 'flex',
        gap: 'clamp(6px, 1.5vw, 8px)',
        marginBottom: 'clamp(16px, 4vw, 24px)',
        flexWrap: 'wrap'
    };

    const filterButtonStyle = {
        padding: 'clamp(8px, 2vw, 10px) clamp(16px, 4vw, 20px)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#E5E7EB',
        fontSize: 'clamp(12px, 3vw, 14px)',
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
        gap: 'clamp(8px, 2vw, 12px)',
        marginBottom: 'clamp(16px, 4vw, 24px)'
    };

    const taskItemStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: 'clamp(8px, 2vw, 12px)',
        padding: 'clamp(12px, 3vw, 16px)',
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
        width: 'clamp(16px, 4vw, 20px)',
        height: 'clamp(16px, 4vw, 20px)',
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
        fontSize: 'clamp(14px, 3.5vw, 16px)',
        color: '#E5E7EB',
        margin: 0
    };

    const taskTextCompletedStyle = {
        ...taskTextStyle,
        textDecoration: 'line-through',
        opacity: 0.7
    };

    const deleteButtonStyle = {
        padding: 'clamp(4px, 1vw, 6px) clamp(8px, 2vw, 12px)',
        background: 'rgba(239,68,68,0.2)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '6px',
        color: '#EF4444',
        fontSize: 'clamp(11px, 2.5vw, 13px)',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s'
    };

    const clearButtonStyle = {
        padding: 'clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px)',
        background: 'rgba(239,68,68,0.2)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '8px',
        color: '#EF4444',
        fontSize: 'clamp(12px, 3vw, 14px)',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s',
        alignSelf: 'flex-start'
    };

    const emptyStateStyle = {
        textAlign: 'center',
        padding: 'clamp(24px, 6vw, 48px)',
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
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '24px', opacity: 0.6 }}>
                                Loading tasks...
                            </div>
                        ) : filteredTasks.map((task) => (
                            <div
                                key={task._id}
                                style={task.completed ? taskItemCompletedStyle : taskItemStyle}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                }}
                            >
                                <div
                                    onClick={() => handleToggleTask(task._id)}
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
                                    onClick={() => handleDeleteTask(task._id)}
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