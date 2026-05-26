import { useEffect } from 'react';

const SEO = ({ 
  title, 
  description, 
  keywords, 
  canonical, 
  ogImage, 
  ogType = 'website',
  twitterCard = 'summary_large_image'
}) => {
  const defaultTitle = 'Connect App - Social Media Platform by Ikramul | Connect with Friends';
  const defaultDescription = 'Connect by Ikramul - A modern social media platform for connecting with friends, sharing moments, video calls, and building communities. Download the Connect app today!';
  const defaultKeywords = 'connect, connect app, connect by ikramul, social media, social network, video calls, messaging, friends, community, chat app, ikramul connect, connect social media';
  const defaultOgImage = ogImage || `${window.location.origin}/logo512.png`;
  const defaultCanonical = canonical || window.location.href;

  useEffect(() => {
    // Update document title
    document.title = title || defaultTitle;

    // Helper function to update or create meta tags
    const updateMetaTag = (name, content, attribute = 'name') => {
      let element = document.querySelector(`meta[${attribute}="${name}"]`);
      if (element) {
        element.setAttribute('content', content);
      } else {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        element.setAttribute('content', content);
        document.head.appendChild(element);
      }
    };

    // Update or create link canonical
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', defaultCanonical);
    } else {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      canonicalLink.setAttribute('href', defaultCanonical);
      document.head.appendChild(canonicalLink);
    }

    // Update primary meta tags
    updateMetaTag('title', title || defaultTitle);
    updateMetaTag('description', description || defaultDescription);
    updateMetaTag('keywords', keywords || defaultKeywords);

    // Update Open Graph meta tags
    updateMetaTag('og:title', title || defaultTitle, 'property');
    updateMetaTag('og:description', description || defaultDescription, 'property');
    updateMetaTag('og:image', defaultOgImage, 'property');
    updateMetaTag('og:type', ogType, 'property');
    updateMetaTag('og:url', window.location.href, 'property');

    // Update Twitter meta tags
    updateMetaTag('twitter:title', title || defaultTitle);
    updateMetaTag('twitter:description', description || defaultDescription);
    updateMetaTag('twitter:image', defaultOgImage);
    updateMetaTag('twitter:card', twitterCard);

    // Update JSON-LD structured data
    const updateStructuredData = () => {
      const structuredData = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": title || defaultTitle,
        "description": description || defaultDescription,
        "url": window.location.href,
        "isPartOf": {
          "@type": "WebApplication",
          "name": "Connect App",
          "alternateName": ["Connect", "Connect by Ikramul", "Connect Social Media"],
          "author": {
            "@type": "Person",
            "name": "Ikramul",
            "url": "https://ikramul.com"
          }
        }
      };

      let existingScript = document.getElementById('page-structured-data');
      if (existingScript) {
        existingScript.textContent = JSON.stringify(structuredData);
      } else {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'page-structured-data';
        script.textContent = JSON.stringify(structuredData);
        document.head.appendChild(script);
      }
    };

    updateStructuredData();

    // Cleanup function (optional - meta tags are typically kept)
    return () => {
      // You can add cleanup logic here if needed
    };
  }, [title, description, keywords, defaultCanonical, defaultOgImage, ogType, twitterCard]);

  return null; // This component doesn't render anything
};

export default SEO;