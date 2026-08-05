import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  PORTFOLIO_BASE_URL,
  PERSON,
  getPortfolioSeo,
  buildPortfolioJsonLd,
} from '../../pages/portfolio/portfolioSeo';

const SCRIPT_ID = 'portfolio-structured-data';

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Portfolio-specific SEO: name-focused titles, Open Graph, Person schema.
 * Renders nothing — updates document head only.
 */
const PortfolioSEO = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const seo = getPortfolioSeo(pathname);
    const pageUrl = `${PORTFOLIO_BASE_URL}${seo.path}`;
    const imageUrl = `${PORTFOLIO_BASE_URL}${PERSON.imagePath}`;

    document.title = seo.title;
    document.documentElement.lang = 'en';

    upsertMeta('name', 'title', seo.title);
    upsertMeta('name', 'description', seo.description);
    upsertMeta('name', 'keywords', seo.keywords);
    upsertMeta('name', 'author', `${PERSON.name}, ${PERSON.alternateNames[1]}`);
    upsertMeta('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    upsertMeta('name', 'googlebot', 'index, follow');

    upsertLink('canonical', pageUrl);

    upsertMeta('property', 'og:type', 'profile');
    upsertMeta('property', 'og:site_name', 'Md Ikram Portfolio');
    upsertMeta('property', 'og:locale', 'en_US');
    upsertMeta('property', 'og:url', pageUrl);
    upsertMeta('property', 'og:title', seo.title);
    upsertMeta('property', 'og:description', seo.description);
    upsertMeta('property', 'og:image', imageUrl);
    upsertMeta('property', 'og:image:alt', `${PERSON.name} — ${PERSON.jobTitle}`);
    upsertMeta('property', 'profile:first_name', 'Md');
    upsertMeta('property', 'profile:last_name', 'Ikram');
    upsertMeta('property', 'profile:username', 'programmerikram');

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:url', pageUrl);
    upsertMeta('name', 'twitter:title', seo.title);
    upsertMeta('name', 'twitter:description', seo.description);
    upsertMeta('name', 'twitter:image', imageUrl);
    upsertMeta('name', 'twitter:image:alt', `${PERSON.name} portfolio`);

    const jsonLd = buildPortfolioJsonLd(pathname);
    let script = document.getElementById(SCRIPT_ID);
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = SCRIPT_ID;
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    return () => {
      const existing = document.getElementById(SCRIPT_ID);
      if (existing) existing.remove();
    };
  }, [pathname]);

  return null;
};

export default PortfolioSEO;
