import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata = {
  title: 'Dat Desk Admin',
  description: 'Admin dashboard for Dat Desk (shared with Horizon & Swift)',
  icons: {
    icon: '/datdesk-icon.png'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
