import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { I18nProvider } from '@/lib/i18n'
import '@/styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <I18nProvider>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 2500,
            style: {
              background: '#1A1814',
              color: '#F8F7F5',
              fontFamily: 'Verdana, Arial, sans-serif',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '50px',
              padding: '12px 20px',
              maxWidth: '360px',
            },
            success: {
              iconTheme: { primary: '#2D9E6B', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#FF4500', secondary: '#fff' },
            },
          }}
        />
        </I18nProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
