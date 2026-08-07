import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    DAILY_WELLNESS_ITEMS,
    FITNESS_ARTICLES,
    FITNESS_CATEGORIES,
    HEALTH_DISCLAIMER,
    QUICK_TIPS,
} from '../constants/healthContent';
import './Health.css';

const STORAGE_KEY = 'connectHealthWellness';

const getTodayKey = () => new Date().toISOString().split('T')[0];

const Health = () => {
    const [activeCategory, setActiveCategory] = useState('basics');
    const [expandedArticle, setExpandedArticle] = useState(null);
    const [checkedItems, setCheckedItems] = useState({});
    const [tipIndex, setTipIndex] = useState(0);

    const todayKey = getTodayKey();

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                setCheckedItems(parsed[todayKey] || {});
            }
        } catch (_) {
            /* ignore */
        }
    }, [todayKey]);

    useEffect(() => {
        const dayIndex = new Date().getDate() % QUICK_TIPS.length;
        setTipIndex(dayIndex);
    }, []);

    const persistChecklist = useCallback((nextDayItems) => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const all = raw ? JSON.parse(raw) : {};
            all[todayKey] = nextDayItems;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        } catch (_) {
            /* ignore */
        }
    }, [todayKey]);

    const toggleChecklistItem = (id) => {
        setCheckedItems((prev) => {
            const next = { ...prev, [id]: !prev[id] };
            persistChecklist(next);
            return next;
        });
    };

    const articles = FITNESS_ARTICLES[activeCategory] || [];
    const completedCount = DAILY_WELLNESS_ITEMS.filter((item) => checkedItems[item.id]).length;
    const progressPercent = Math.round((completedCount / DAILY_WELLNESS_ITEMS.length) * 100);

    const activeCategoryMeta = useMemo(
        () => FITNESS_CATEGORIES.find((c) => c.id === activeCategory),
        [activeCategory]
    );

    const nextTip = () => setTipIndex((i) => (i + 1) % QUICK_TIPS.length);
    const prevTip = () => setTipIndex((i) => (i - 1 + QUICK_TIPS.length) % QUICK_TIPS.length);

    return (
        <div className="health-page">
            <div className="health-container">
                <header className="health-header">
                    <Link to="/" className="health-back-link" aria-label="Back to home">
                        <i className="fas fa-arrow-left" aria-hidden="true" />
                        Home
                    </Link>
                    <div className="health-header-content">
                        <span className="health-badge">
                            <i className="fas fa-heartbeat" aria-hidden="true" />
                            Wellness Hub
                        </span>
                        <h1 className="health-title">Health & Fitness</h1>
                        <p className="health-subtitle">
                            Practical knowledge and daily advice to help you train smarter, eat better, and recover well.
                        </p>
                    </div>
                </header>

                <p className="health-disclaimer" role="note">
                    <i className="fas fa-info-circle" aria-hidden="true" />
                    {HEALTH_DISCLAIMER}
                </p>

                <section className="health-stats-row" aria-label="Daily wellness progress">
                    <div className="health-stat-card">
                        <span className="health-stat-value">{completedCount}/{DAILY_WELLNESS_ITEMS.length}</span>
                        <span className="health-stat-label">Today&apos;s habits</span>
                    </div>
                    <div className="health-stat-card">
                        <span className="health-stat-value">{progressPercent}%</span>
                        <span className="health-stat-label">Daily score</span>
                    </div>
                    <div className="health-stat-card">
                        <span className="health-stat-value">{FITNESS_CATEGORIES.length}</span>
                        <span className="health-stat-label">Knowledge areas</span>
                    </div>
                </section>

                <div className="health-grid">
                    <aside className="health-sidebar">
                        <section className="health-panel health-checklist-panel">
                            <h2 className="health-panel-title">
                                <i className="fas fa-check-circle" aria-hidden="true" />
                                Daily Wellness Checklist
                            </h2>
                            <p className="health-panel-desc">Track simple habits that support your fitness goals.</p>
                            <div className="health-progress-bar" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
                                <div className="health-progress-fill" style={{ width: `${progressPercent}%` }} />
                            </div>
                            <ul className="health-checklist">
                                {DAILY_WELLNESS_ITEMS.map((item) => (
                                    <li key={item.id}>
                                        <label className={`health-check-item ${checkedItems[item.id] ? 'is-done' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(checkedItems[item.id])}
                                                onChange={() => toggleChecklistItem(item.id)}
                                            />
                                            <span className="health-check-icon">
                                                <i className={`fas ${item.icon}`} aria-hidden="true" />
                                            </span>
                                            <span>{item.label}</span>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="health-panel health-tip-panel">
                            <h2 className="health-panel-title">
                                <i className="fas fa-lightbulb" aria-hidden="true" />
                                Tip of the Day
                            </h2>
                            <blockquote className="health-tip-quote">{QUICK_TIPS[tipIndex]}</blockquote>
                            <div className="health-tip-nav">
                                <button type="button" onClick={prevTip} aria-label="Previous tip">
                                    <i className="fas fa-chevron-left" aria-hidden="true" />
                                </button>
                                <span>{tipIndex + 1} / {QUICK_TIPS.length}</span>
                                <button type="button" onClick={nextTip} aria-label="Next tip">
                                    <i className="fas fa-chevron-right" aria-hidden="true" />
                                </button>
                            </div>
                        </section>
                    </aside>

                    <main className="health-main">
                        <nav className="health-category-nav" aria-label="Fitness topics">
                            {FITNESS_CATEGORIES.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    className={`health-category-btn ${activeCategory === cat.id ? 'is-active' : ''}`}
                                    onClick={() => {
                                        setActiveCategory(cat.id);
                                        setExpandedArticle(null);
                                    }}
                                >
                                    <i className={`fas ${cat.icon}`} aria-hidden="true" />
                                    {cat.label}
                                </button>
                            ))}
                        </nav>

                        <section className="health-panel health-articles-panel">
                            <div className="health-articles-head">
                                <h2 className="health-panel-title">
                                    {activeCategoryMeta && (
                                        <i className={`fas ${activeCategoryMeta.icon}`} aria-hidden="true" />
                                    )}
                                    {activeCategoryMeta?.label || 'Articles'}
                                </h2>
                                <p className="health-panel-desc">
                                    Expert-style guidance you can apply this week — no fluff, just actionable advice.
                                </p>
                            </div>

                            <div className="health-articles">
                                {articles.map((article, index) => {
                                    const isOpen = expandedArticle === index;
                                    return (
                                        <article
                                            key={article.title}
                                            className={`health-article ${isOpen ? 'is-open' : ''}`}
                                        >
                                            <button
                                                type="button"
                                                className="health-article-toggle"
                                                onClick={() => setExpandedArticle(isOpen ? null : index)}
                                                aria-expanded={isOpen}
                                            >
                                                <div>
                                                    <h3>{article.title}</h3>
                                                    <p>{article.summary}</p>
                                                </div>
                                                <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`} aria-hidden="true" />
                                            </button>
                                            {isOpen && (
                                                <ul className="health-article-points">
                                                    {article.points.map((point) => (
                                                        <li key={point}>{point}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default Health;
