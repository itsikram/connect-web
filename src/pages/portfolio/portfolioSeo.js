import config from '../../config/config.json';

export const PORTFOLIO_BASE_URL = (config.siteUrlLive || 'https://connect-bd.online/').replace(/\/$/, '');

function absUrl(pathOrUrl = '') {
  if (!pathOrUrl) return `${PORTFOLIO_BASE_URL}/assets/images/portfolio-pp.png`;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${PORTFOLIO_BASE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

export function personFromPortfolio(data) {
  const profile = data?.profile || {};
  const social = data?.social || {};
  const sameAs = [social.linkedin, social.github, social.facebook, social.twitter].filter(Boolean);

  return {
    name: profile.name || 'Md Ikram',
    alternateNames: profile.alternateNames?.length
      ? profile.alternateNames
      : ['Ikramul Islam', 'Programmer Ikram'],
    jobTitle: profile.jobTitle || 'Senior Software Developer',
    description:
      data?.hero?.description ||
      data?.seo?.homeDescription ||
      `${profile.name || 'Md Ikram'} is a ${profile.jobTitle || 'Senior Software Developer'}.`,
    email: profile.email || '',
    telephone: profile.phone || '',
    address: {
      locality: profile.locality || '',
      country: profile.country || '',
    },
    imagePath: profile.avatarUrl || config.portfolioPP || '/assets/images/portfolio-pp.png',
    sameAs,
  };
}

export function getPortfolioSeo(pathname = '', data) {
  const path = (pathname || '/portfolio').replace(/\/$/, '') || '/portfolio';
  const person = personFromPortfolio(data);
  const keywords = [
    data?.seo?.keywords,
    'Md Ikram, Ikram, Programmer Ikram, Ikramul Islam, Md Ikramul, WordPress Developer, WordPress Developer Bangladesh, MERN Developer, React Native Developer',
  ]
    .filter(Boolean)
    .join(', ');

  // Titles/descriptions are code-owned so they always carry the name
  // keywords people search for. Keep in sync with PUBLIC_PAGES in server.js.
  const pages = {
    home: {
      path: '/portfolio',
      title: 'Md Ikram (Programmer Ikram) – WordPress Developer & Software Engineer',
      description:
        'Md Ikram (Ikramul Islam), known as Programmer Ikram, is a WordPress Developer and Senior Software Developer from Bangladesh building WordPress, MERN Stack and React Native apps.',
      keywords,
    },
    about: {
      path: '/portfolio/about',
      title: 'About Md Ikram – Programmer Ikram, WordPress & MERN Developer',
      description:
        'About Md Ikram (Ikramul Islam / Programmer Ikram): a WordPress Developer and Senior Software Developer from Munshiganj, Bangladesh, with 5+ years of experience.',
      keywords: `${keywords}, about Md Ikram`,
    },
    resume: {
      path: '/portfolio/resume',
      title: 'Md Ikram Resume – WordPress Developer & Senior Software Developer',
      description:
        'Resume of Md Ikram (Programmer Ikram, Ikramul Islam): WordPress development, MERN Stack and React Native experience, skills and education.',
      keywords: `${keywords}, Md Ikram resume, Md Ikram CV`,
    },
    blogs: {
      path: '/portfolio/blogs',
      title: 'Blog by Programmer Ikram (Md Ikram) – WordPress, React & MERN',
      description:
        'Articles by Md Ikram (Programmer Ikram) on WordPress development, React, React Native and the MERN Stack.',
      keywords: `${keywords}, Programmer Ikram blog`,
    },
    contact: {
      path: '/portfolio/contact',
      title: 'Contact Md Ikram – Hire a WordPress Developer in Bangladesh',
      description:
        'Hire Md Ikram (Programmer Ikram / Ikramul Islam) for WordPress websites, custom themes and plugins, MERN Stack and React Native apps.',
      keywords: `${keywords}, hire WordPress developer, contact Md Ikram`,
    },
  };

  if (path === '/portfolio/about') return pages.about;
  if (path === '/portfolio/resume') return pages.resume;
  if (path === '/portfolio/blogs') return pages.blogs;
  if (path === '/portfolio/contact') return pages.contact;
  return pages.home;
}

export function buildPortfolioJsonLd(pathname = '', data) {
  const seo = getPortfolioSeo(pathname, data);
  const personInfo = personFromPortfolio(data);
  const pageUrl = `${PORTFOLIO_BASE_URL}${seo.path}`;
  const imageUrl = absUrl(personInfo.imagePath);

  const person = {
    '@type': 'Person',
    '@id': `${PORTFOLIO_BASE_URL}/portfolio/#person`,
    name: personInfo.name,
    alternateName: Array.from(
      new Set([...(personInfo.alternateNames || []), 'Programmer Ikram', 'Ikram', 'Ikramul Islam']),
    ),
    url: `${PORTFOLIO_BASE_URL}/portfolio`,
    image: imageUrl,
    jobTitle: [personInfo.jobTitle, 'WordPress Developer'],
    description: personInfo.description,
    email: personInfo.email,
    telephone: personInfo.telephone,
    address: {
      '@type': 'PostalAddress',
      addressLocality: personInfo.address.locality,
      addressCountry: personInfo.address.country,
    },
    sameAs: personInfo.sameAs,
    knowsAbout: [
      'WordPress',
      'WordPress Theme Development',
      'WordPress Plugin Development',
      'MERN Stack',
      'React',
      'React Native',
      'JavaScript',
      'Web Development',
    ],
  };

  const webPage = {
    '@type': 'ProfilePage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: seo.title,
    description: seo.description,
    inLanguage: 'en',
    isPartOf: {
      '@type': 'WebSite',
      name: `${personInfo.name} Portfolio`,
      url: `${PORTFOLIO_BASE_URL}/portfolio`,
    },
    about: { '@id': `${PORTFOLIO_BASE_URL}/portfolio/#person` },
    mainEntity: { '@id': `${PORTFOLIO_BASE_URL}/portfolio/#person` },
    mainEntityOfPage: pageUrl,
  };

  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: PORTFOLIO_BASE_URL },
    {
      '@type': 'ListItem',
      position: 2,
      name: `${personInfo.name} Portfolio`,
      item: `${PORTFOLIO_BASE_URL}/portfolio`,
    },
  ];

  if (seo.path !== '/portfolio') {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: seo.title.split('|')[0].trim(),
      item: pageUrl,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      person,
      webPage,
      { '@type': 'BreadcrumbList', itemListElement: breadcrumbItems },
    ],
  };
}

/** @deprecated use personFromPortfolio */
export const PERSON = personFromPortfolio(null);
