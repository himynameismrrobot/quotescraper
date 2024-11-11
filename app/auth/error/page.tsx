export default function AuthError() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Authentication Error</h1>
        <p className="mb-4">There was an error during authentication.</p>
        <a 
          href="/auth/signin" 
          className="text-blue-500 hover:text-blue-700"
        >
          Try again
        </a>
      </div>
    </div>
  )
} 