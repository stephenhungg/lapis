import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/report/', '/market/'],
    },
    sitemap: 'https://lapis.bet/sitemap.xml',
  }
}
