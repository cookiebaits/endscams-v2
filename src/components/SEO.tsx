import React, { useEffect } from 'react';

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogType?: string;
  ogImage?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  jsonLd?: Record<string, any> | Array<Record<string, any>>;
}

const DEFAULT_TITLE = 'EndScams.org | Cyberscam Watchdog & Live Threat Intelligence';
const DEFAULT_DESCRIPTION = 'EndScams.org is a 501(c)(3) non-profit cyberscam watchdog network. Search active scam phone numbers, report phishing threats, access real-time intelligence, and protect your digital identity.';
const DEFAULT_KEYWORDS = 'scam phone lookup, report scam number, cyberscam watchdog, endscams, tech support scam, phishing report, scammer database, robocall blacklist, fraud alert';
const DEFAULT_DOMAIN = 'https://endscams.org';
const DEFAULT_IMAGE = 'https://endscams.org/logo.png';

/**
 * Helper to update or create meta tags in <head>
 */
function updateMetaTag(selector: string, attributeName: string, attributeValue: string, content: string) {
  let element = document.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/**
 * Helper to update or create link elements in <head>
 */
function updateLinkTag(rel: string, href: string) {
  let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

/**
 * Dynamic SEO Component for route-level search optimization & rich snippets
 */
export const SEO: React.FC<SEOProps> = ({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  canonical,
  ogType = 'website',
  ogImage = DEFAULT_IMAGE,
  twitterCard = 'summary_large_image',
  jsonLd,
}) => {
  const fullTitle = title ? `${title} | EndScams.org` : DEFAULT_TITLE;
  const canonicalUrl = canonical ? (canonical.startsWith('http') ? canonical : `${DEFAULT_DOMAIN}${canonical}`) : DEFAULT_DOMAIN;

  useEffect(() => {
    // 1. Page Title
    document.title = fullTitle;

    // 2. Primary Meta Tags
    updateMetaTag('meta[name="description"]', 'name', 'description', description);
    updateMetaTag('meta[name="keywords"]', 'name', 'keywords', keywords);
    updateMetaTag('meta[name="robots"]', 'name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    updateMetaTag('meta[name="author"]', 'name', 'author', 'EndScams.org Cyberscam Watchdog');

    // 3. Canonical Link
    updateLinkTag('canonical', canonicalUrl);

    // 4. OpenGraph Tags
    updateMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', 'EndScams.org');
    updateMetaTag('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    updateMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
    updateMetaTag('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    updateMetaTag('meta[property="og:image"]', 'property', 'og:image', ogImage);
    updateMetaTag('meta[property="og:type"]', 'property', 'og:type', ogType);

    // 5. Twitter Card Tags
    updateMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', twitterCard);
    updateMetaTag('meta[name="twitter:site"]', 'name', 'twitter:site', '@endscams');
    updateMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
    updateMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    updateMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', ogImage);

    // 6. JSON-LD Structured Data Schema Insertion
    const scriptId = 'seo-json-ld';
    let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (jsonLd) {
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = scriptId;
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(jsonLd);
    } else if (scriptEl) {
      scriptEl.remove();
    }

    return () => {
      // Clean up dynamic script tag on unmount if needed
    };
  }, [fullTitle, description, keywords, canonicalUrl, ogType, ogImage, twitterCard, jsonLd]);

  return null;
};

export default SEO;
