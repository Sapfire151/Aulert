import type { Metadata } from 'next';
import { Bricolage_Grotesque, Prompt } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-bricolage',
  display: 'swap',
});

const prompt = Prompt({
  subsets: ['latin', 'thai'],
  weight: ['400', '600'],
  variable: '--font-prompt',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Aulert — Google Classroom Visual Timeline & Discord Alerts',
  description:
    'Turn Google Classroom into a unified visual timeline and get real-time deadline alerts on Discord.',
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
