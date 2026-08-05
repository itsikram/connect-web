import config from '../../config/config.json';

export const PORTFOLIO_BASE_URL = (config.siteUrlLive || 'https://connect-zfgx.onrender.com/').replace(/\/$/, '');

export const PERSON = {
  name: 'Md Ikram',
  alternateNames: [
    'Md Ikramul',
    'Ikramul Islam',
    'Md Ikramul Islam',
    'Programmer Ikram',
    'Ikram',
  ],
  jobTitle: 'Senior Software Developer',
  description:
    'Md Ikram (Ikramul Islam) is a Senior Software Developer from Munshiganj, Bangladesh, specializing in WordPress, MERN Stack, and React Native mobile app development.',
  email: 'mdikram295@gmail.com',
  telephone: '+8801581400711',
  address: {
    locality: 'Munshiganj',
    country: 'Bangladesh',
  },
  imagePath: config.portfolioPP || '/assets/images/portfolio-pp.png',
  sameAs: [
    'https://www.linkedin.com/in/ikramul-islam-38a484260/',
    'https://github.com/itsikram',
    'https://facebook.com/programmerikram',
  ],
};

const keywordsBase = [
  'Md Ikram',
  'Md Ikramul',
  'Ikramul Islam',
  'Md Ikramul Islam',
  'Programmer Ikram',
  'Md Ikram portfolio',
  'Md Ikram developer',
  'Ikramul Islam developer',
  'WordPress developer Bangladesh',
  'MERN developer Munshiganj',
  'React Native developer Bangladesh',
  'Senior Software Developer Md Ikram',
].join(', ');

const pages = {
  home: {
    path: '/portfolio',
    title: 'Md Ikram | Senior Software Developer | WordPress & MERN Portfolio',
    description:
      'Official portfolio of Md Ikram (Ikramul Islam) — Senior Software Developer from Munshiganj, Bangladesh. Expert in WordPress, MERN Stack, and React Native with 5+ years of experience.',
    keywords: keywordsBase,
  },
  about: {
    path: '/portfolio/about',
    title: 'About Md Ikram | Ikramul Islam — Senior Software Developer',
    description:
      'Learn about Md Ikram (Ikramul Islam): career objectives, strengths, languages, and background as a WordPress and MERN Stack developer based in Munshiganj, Bangladesh.',
    keywords: `${keywordsBase}, about Md Ikram, about Ikramul Islam`,
  },
  resume: {
    path: '/portfolio/resume',
    title: 'Resume of Md Ikram | Work Experience & Education',
    description:
      'View the resume of Md Ikram (Ikramul Islam): Senior Software Developer at Lexidom Agency, WordPress experience at BdCalling IT, Freelancer.com, and Fiverr.',
    keywords: `${keywordsBase}, Md Ikram resume, Md Ikram CV, Ikramul Islam resume`,
  },
  blogs: {
    path: '/portfolio/blogs',
    title: 'Blog by Md Ikram | Frontend, React & Product Engineering',
    description:
      'Articles and notes by Md Ikram (Ikramul Islam) on React, CSS, React Native performance, TypeScript, design systems, and web accessibility.',
    keywords: `${keywordsBase}, Md Ikram blog, Ikramul Islam articles`,
  },
  contact: {
    path: '/portfolio/contact',
    title: 'Contact Md Ikram | Hire Ikramul Islam — Software Developer',
    description:
      'Contact Md Ikram (Ikramul Islam) for WordPress, MERN, or React Native projects. Email mdikram295@gmail.com or call 01581400711. Based in Munshiganj, Bangladesh.',
    keywords: `${keywordsBase}, contact Md Ikram, hire Md Ikram, hire Ikramul Islam`,
  },
};

export function getPortfolioSeo(pathname = '') {
  const path = (pathname || '/portfolio').replace(/\/$/, '') || '/portfolio';

  if (path === '/portfolio/about') return pages.about;
  if (path === '/portfolio/resume') return pages.resume;
  if (path === '/portfolio/blogs') return pages.blogs;
  if (path === '/portfolio/contact') return pages.contact;
  return pages.home;
}

export function buildPortfolioJsonLd(pathname = '') {
  const seo = getPortfolioSeo(pathname);
  const pageUrl = `${PORTFOLIO_BASE_URL}${seo.path}`;
  const imageUrl = `${PORTFOLIO_BASE_URL}${PERSON.imagePath}`;

  const person = {
    '@type': 'Person',
    '@id': `${PORTFOLIO_BASE_URL}/portfolio/#person`,
    name: PERSON.name,
    alternateName: PERSON.alternateNames,
    url: `${PORTFOLIO_BASE_URL}/portfolio`,
    image: imageUrl,
    jobTitle: PERSON.jobTitle,
    description: PERSON.description,
    email: PERSON.email,
    telephone: PERSON.telephone,
    address: {
      '@type': 'PostalAddress',
      addressLocality: PERSON.address.locality,
      addressCountry: PERSON.address.country,
    },
    sameAs: PERSON.sameAs,
    knowsAbout: [
      'WordPress',
      'MERN Stack',
      'React.js',
      'React Native',
      'Node.js',
      'PHP',
      'MongoDB',
      'Custom WordPress Themes',
      'Web Performance',
    ],
    worksFor: {
      '@type': 'Organization',
      name: 'Lexidom Agency',
    },
    nationality: {
      '@type': 'Country',
      name: 'Bangladesh',
    },
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
      name: 'Md Ikram Portfolio',
      url: `${PORTFOLIO_BASE_URL}/portfolio`,
    },
    about: { '@id': `${PORTFOLIO_BASE_URL}/portfolio/#person` },
    mainEntity: { '@id': `${PORTFOLIO_BASE_URL}/portfolio/#person` },
  };

  const breadcrumbItems = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: PORTFOLIO_BASE_URL,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Md Ikram Portfolio',
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
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
      },
    ],
  };
}

export default pages;
