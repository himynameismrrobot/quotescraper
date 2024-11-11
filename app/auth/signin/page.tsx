'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/utils/supabase/client'
import { useState } from 'react'

export default function SignIn() {
  const [isSignUp, setIsSignUp] = useState(false)
  const supabase = createClient()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="w-full max-w-md px-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-white">
          {isSignUp ? 'Create an Account' : 'Welcome Back'}
        </h1>
        <div className="backdrop-blur-xl bg-white/10 p-8 rounded-lg border border-white/20 shadow-xl">
          <Auth
            supabaseClient={supabase}
            view={isSignUp ? 'sign_up' : 'sign_in'}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#404040',
                    brandAccent: '#525252',
                  },
                },
              },
              className: {
                container: 'auth-container',
                button: 'auth-button',
                input: 'auth-input',
                label: 'auth-label',
                anchor: 'auth-anchor',
              },
            }}
            providers={['google']}
            redirectTo={`${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback`}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Email',
                  password_label: 'Password',
                  button_label: 'Sign In',
                  loading_button_label: 'Signing in...',
                  social_provider_text: 'Sign in with {{provider}}',
                  link_text: "Don't have an account? Create one",
                  email_input_placeholder: 'Your email address',
                  password_input_placeholder: 'Your password',
                },
                sign_up: {
                  email_label: 'Email',
                  password_label: 'Password',
                  button_label: 'Create Account',
                  loading_button_label: 'Creating your account...',
                  social_provider_text: 'Sign up with {{provider}}',
                  link_text: 'Already have an account? Sign in',
                  email_input_placeholder: 'Your email address',
                  password_input_placeholder: 'Create a password',
                },
              },
            }}
            onViewChange={(view) => {
              setIsSignUp(view === 'sign_up')
            }}
          />
        </div>
      </div>
      <style jsx global>{`
        .auth-container {
          width: 100%;
          padding: 0 16px;
        }
        .auth-button {
          width: calc(100% - 32px);
          padding: 8px;
          border-radius: 6px;
          margin: 8px 16px;
          background-color: rgba(255, 255, 255, 0.1);
          color: white;
          transition: background-color 0.2s;
        }
        .auth-button:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
        .auth-input {
          width: calc(100% - 32px) !important;
          padding: 8px 12px;
          border-radius: 6px;
          margin: 4px 16px 12px;
          background-color: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
        }
        .auth-input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }
        .auth-label {
          color: rgba(255, 255, 255, 0.8);
          margin: 0 16px 4px;
          display: block;
        }
        .auth-anchor {
          color: rgba(255, 255, 255, 0.8);
          text-decoration: none;
          font-size: 0.875rem;
          transition: color 0.2s;
          display: block;
          text-align: center;
          margin: 16px 0;
        }
        .auth-anchor:hover {
          color: white;
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
} 