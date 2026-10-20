import './globals.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://openhost.app'
  ),
  title: 'OpenHost — Deploy Next.js on your own AWS',
  description:
    'Vercel-level developer experience, running entirely on your AWS account. Git push to deploy, preview branches, custom domains, instant rollbacks — you only pay AWS.',
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
        className={`${inter.variable} ${jetbrains.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
