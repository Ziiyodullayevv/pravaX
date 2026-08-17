import type { Metadata } from 'next';

// ----------------------------------------------------------------------

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://academy.pravax.uz';
const SITE_NAME = 'PravaX Academy';
const OG_IMAGE = `${SITE_URL}/logo/prava-x-logo-dark.png`;

const DEFAULT_DESCRIPTION =
  "PravaX Academy — avtomobil haydovchilik huquqini olish uchun onlayn test platforma. Yo'l harakati qoidalarini o'rganing, testlar ishlang va imtihonga tayyorlaning.";

// ----------------------------------------------------------------------

export function createMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '',
}: {
  title: string;
  description?: string;
  path?: string;
}): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const url = `${SITE_URL}${path}`;

  return {
    title: fullTitle,
    description,
    keywords: [
      "prava olish",
      "haydovchilik huquqi",
      "yo'l harakati qoidalari",
      "prava imtihoni",
      "online test",
      "avtomobil haydovchi",
      "prava tayyorlov",
      "PravaX",
      "akademiya",
      "права",
      "ПДД тест",
    ],
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'uz_UZ',
      url,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      images: [
        {
          url: OG_IMAGE,
          width: 1024,
          height: 1024,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [OG_IMAGE],
      creator: '@pravax_uz',
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export { SITE_URL, OG_IMAGE, SITE_NAME, DEFAULT_DESCRIPTION };
