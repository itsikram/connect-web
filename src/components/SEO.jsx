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
  const defaultTitle = 'Connect BD - Social Media App in Bangladesh | Connect with Connects';
  const defaultDescription = 'Connect BD by Ikramul is a modern social media platform for Bangladesh users to connect, chat, share moments, make video calls, and grow communities online.';
  const defaultKeywords = 'Connect BD, connect bd, connect app, connect by ikramul, social media app Bangladesh, social networking platform, chat app, video calls, community app, connect with connects, online community';
  const defaultOgImage = ogImage || 'https://connect-bd.online/logo512.png';
  const defaultCanonical = canonical || 'https://connect-bd.online' + window.location.pathname;

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
        "url": defaultCanonical,
        "isPartOf": {
          "@type": "WebApplication",
          "name": "Connect BD",
          "alternateName": ["Connect", "Connect App", "Connect by Ikramul", "Connect Social Media"],
          "author": {
            "@type": "Person",
            "name": "Ikramul",
            "url": "https://connect-bd.online/portfolio"
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