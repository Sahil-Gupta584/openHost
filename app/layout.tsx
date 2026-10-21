import './globals.css';
import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Mono, Instrument_Serif } from 'next/font/google';

// Warm-ink theme: Archivo (body) · Instrument Serif (display) · IBM Plex Mono (eyebrow labels)
const archivo = Archivo({ subsets: ['latin'], variable: '--font-sans' });
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
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
