import type { AppProps } from 'next/app';
import { AuthStateProvider } from '@/components/AuthStateProvider';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthStateProvider>
      <Component {...pageProps} />
    </AuthStateProvider>
  );
}