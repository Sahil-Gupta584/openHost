import './globals.css';
import type { Metadata } from 'next';
import localFont from 'next/font/local';

// Warm-ink theme: Archivo (body) · Instrument Serif (display) · IBM Plex Mono (eyebrow labels).
// Self-hosted (latin subset, from fonts.gstatic) so builds never depend on Google Fonts'
// reachability — the first Vercel build failed with ETIMEDOUT fetching Instrument Serif.
const archivo = localFont({
  src: './fonts/archivo-latin-wght-var.woff2',
  weight: '100 900',
  variable: '--font-sans',
});
const plexMono = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-mono',
});
const instrumentSerif = localFont({
  src: [
    { path: './fonts/instrument-serif-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/instrument-serif-latin-400-italic.woff2', weight: '400', style: 'italic' },
  ],
  variable: '--font-display',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://openhost.app'
  ),
  title: 'OpenHost — Deploy Next.js on your own AWS',
  description:
    'Vercel-level developer experience, running entirely on your AWS account. Git push to deploy, preview branches, custom domains, instant rollbacks — you only pay AWS.',
  themeColor: '#0A0A0A',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  openGraph: {
    title: 'OpenHost — Deploy Next.js on your own AWS',
    description:
      'Vercel-level DX on your own AWS. Pay pure AWS costs, no platform markup on compute or bandwidth.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenHost — Deploy Next.js on your own AWS',
    description:
      'Vercel-level DX on your own AWS. Pay pure AWS costs, no platform markup.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${archivo.variable} ${plexMono.variable} ${instrumentSerif.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
