import { AppProps } from 'next/app';
import { AuthStateProvider } from '@/components/AuthStateProvider';
import SupabaseProvider from '@/lib/providers/supabase-provider';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthStateProvider>
      <SupabaseProvider>
        <Component {...pageProps} />
      </SupabaseProvider>
    </AuthStateProvider>
  );
}