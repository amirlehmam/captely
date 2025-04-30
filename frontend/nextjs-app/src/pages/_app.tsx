// pages/_app.tsx
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import '../styles/globals.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    // skip the guard on public routes
    const publicPaths = ['/login', '/signup'];
    if (publicPaths.includes(router.pathname)) return;

    const token =
      typeof window !== 'undefined' &&
      (localStorage.getItem('captely_jwt') ||
       sessionStorage.getItem('captely_jwt'));

    if (!token) {
      router.replace('/login');
    }
  }, [router.pathname]);

  return <Component {...pageProps} />;
}
