import React from 'react';

const posts = [
    {
        title: 'Building Scalable React Applications',
        excerpt:
            'Best practices for structuring large-scale React apps with clean architecture, efficient state management, and optimized performance.',
        date: 'March 15, 2024',
        tags: ['React', 'Architecture', 'Performance'],
        readTime: '8 min read',
        link: 'https://your-blog.com/scalable-react-apps',
    },
    {
        title: 'Modern CSS Techniques for 2024',
        excerpt:
            'Exploring container queries, cascade layers, and new CSS features that are changing how we build responsive interfaces.',
        date: 'February 28, 2024',
        tags: ['CSS', 'UI/UX', 'Web Design'],
        readTime: '6 min read',
        link: 'https://your-blog.com/modern-css',
    },
    {
        title: 'React Native Performance Optimization',
        excerpt:
            'Deep dive into profiling tools, memory management, and techniques to build 60fps mobile experiences with React Native.',
        date: 'February 10, 2024',
        tags: ['React Native', 'Mobile', 'Performance'],
        readTime: '10 min read',
        link: 'https://your-blog.com/rn-performance',
    },
    {
        title: 'TypeScript Best Practices',
        excerpt:
            'Advanced TypeScript patterns, generics, and type-safe approaches for building robust enterprise applications.',
        date: 'January 22, 2024',
        tags: ['TypeScript', 'JavaScript', 'Best Practices'],
        readTime: '7 min read',
        link: 'https://your-blog.com/typescript-patterns',
    },
    {
        title: 'Design Systems That Scale',
        excerpt:
            'How to build, maintain, and evolve design systems across multiple platforms and teams in growing organizations.',
        date: 'January 8, 2024',
        tags: ['Design Systems', 'UI Components', 'Team Collaboration'],
        readTime: '9 min read',
        link: 'https://your-blog.com/design-systems',
    },
    {
        title: 'Web Accessibility in Modern Apps',
        excerpt:
            'Practical guide to implementing WCAG standards, screen reader support, and inclusive design patterns.',
        date: 'December 15, 2023',
        tags: ['Accessibility', 'a11y', 'UX'],
        readTime: '5 min read',
        link: 'https://your-blog.com/web-accessibility',
    },
];

const PortfolioBlog = () => {
    return (
        <section id='blogs' className='portfolio-section'>
            <h1 className='section-title'>Blog by Md Ikram</h1>
            <p className='section-subtitle'>
                Writing by Md Ikram (Ikramul Islam) about frontend, design systems, and product engineering.
            </p>

            <div className='blog-grid'>
                {posts.map((post) => (
                    <article key={post.title} className='blog-card'>
                        <div className='blog-card-header'>
                            <div className='blog-meta'>
                                <time className='blog-date' dateTime={post.date}>
                                    {post.date}
                                </time>
                                <span className='blog-read-time'>{post.readTime}</span>
                            </div>
                        </div>
                        <h3 className='blog-title'>{post.title}</h3>
                        <p className='blog-excerpt'>{post.excerpt}</p>
                        <div className='blog-tags'>
                            {post.tags.map((tag) => (
                                <span key={tag} className='blog-tag'>
                                    {tag}
                                </span>
                            ))}
                        </div>
                        <a
                            href={post.link}
                            target='_blank'
                            rel='noreferrer'
                            className='blog-read-more'
                        >
                            Read article →
                        </a>
                    </article>
                ))}
            </div>
        </section>
    );
};

export default PortfolioBlog;
