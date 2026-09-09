import type { Metadata } from 'next';
import { Bricolage_Grotesque, Prompt } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-bricolage',
  display: 'swap',
});

const prompt = Prompt({
  subsets: ['latin', 'thai'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-prompt',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Aulert',
  description: 'Aulert',
  verification: {
    google: 'wS3ouR6PoRcE4Eds8-vvprmc_1ptOPXTsFEwX21FkLM',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${bricolage.variable} ${prompt.variable}`} data-theme="dark">
      <body>
        <div id="app-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
