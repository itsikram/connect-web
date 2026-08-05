import React from 'react';
import { usePortfolio } from '../../contexts/PortfolioContext';

const PortfolioBlog = () => {
  const { data, loading } = usePortfolio();

  if (loading && !data) {
    return <div className="portfolio-section color-tc">Loading…</div>;
  }

  const blogs = data?.blogs || {};
  const posts = blogs.posts || [];

  return (
    <section id="blogs" className="portfolio-section">
      <h1 className="section-title">{blogs.title || 'Blog'}</h1>
      {blogs.subtitle ? <p className="section-subtitle">{blogs.subtitle}</p> : null}

      <div className="blog-grid">
        {posts.map((post) => (
          <article key={post.title} className="blog-card">
            <div className="blog-card-header">
              <div className="blog-meta">
                <time className="blog-date" dateTime={post.date}>
                  {post.date}
                </time>
                <span className="blog-read-time">{post.readTime}</span>
              </div>
            </div>
            <h3 className="blog-title">{post.title}</h3>
            <p className="blog-excerpt">{post.excerpt}</p>
            <div className="blog-tags">
              {(post.tags || []).map((tag) => (
                <span key={tag} className="blog-tag">
                  {tag}
                </span>
              ))}
            </div>
            {post.link ? (
              <a href={post.link} target="_blank" rel="noreferrer" className="blog-read-more">
                Read article →
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
};

export default PortfolioBlog;
