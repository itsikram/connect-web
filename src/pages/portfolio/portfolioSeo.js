import config from '../../config/config.json';

export const PORTFOLIO_BASE_URL = (config.siteUrlLive || 'https://connect-zfgx.onrender.com/').replace(/\/$/, '');

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
  const keywords =
    data?.seo?.keywords ||
    [person.name, ...(person.alternateNames || []), `${person.name} portfolio`, person.jobTitle].join(', ');

  const pages = {
    home: {
      path: '/portfolio',
      title:
        data?.seo?.homeTitle ||
        `${person.name} | ${person.jobTitle} | Portfolio`,
      description: data?.seo?.homeDescription || person.description,
      keywords,
    },
    about: {
      path: '/portfolio/about',
      title: data?.aboutPage?.title
        ? `${data.aboutPage.title} | ${person.name}`
        : `About ${person.name} | ${person.jobTitle}`,
      description: data?.aboutPage?.subtitle || person.description,
      keywords: `${keywords}, about ${person.name}`,
    },
    resume: {
      path: '/portfolio/resume',
      title: data?.resumePage?.title
        ? `${data.resumePage.title}`
        : `Resume of ${person.name}`,
      description: data?.resumePage?.subtitle || `Resume and experience of ${person.name}.`,
      keywords: `${keywords}, ${person.name} resume, ${person.name} CV`,
    },
    blogs: {
      path: '/portfolio/blogs',
      title: data?.blogs?.title || `Blog by ${person.name}`,
      description: data?.blogs?.subtitle || `Articles by ${person.name}.`,
      keywords: `${keywords}, ${person.name} blog`,
    },
    contact: {
      path: '/portfolio/contact',
      title: data?.contactPage?.title || `Contact ${person.name}`,
      description:
        data?.contactPage?.subtitle ||
        `Contact ${person.name}${person.email ? ` at ${person.email}` : ''}.`,
      keywords: `${keywords}, contact ${person.name}, hire ${person.name}`,
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
    alternateName: personInfo.alternateNames,
    url: `${PORTFOLIO_BASE_URL}/portfolio`,
    image: imageUrl,
    jobTitle: personInfo.jobTitle,
    description: personInfo.description,
    email: personInfo.email,
    telephone: personInfo.telephone,
    address: {
      '@type': 'PostalAddress',
      addressLocality: personInfo.address.locality,
      addressCountry: personInfo.address.country,
    },
    sameAs: personInfo.sameAs,
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
