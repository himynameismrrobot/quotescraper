'use client'

import { createClient } from '@/utils/supabase/client'
import EchoLayout from '@/components/EchoLayout'
import BottomNav from '@/components/BottomNav'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthStateProvider'
import { LogOut } from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    // Only redirect if we're explicitly not loading and have no user
    if (!loading) {
      if (!user) {
        // Add a small delay before redirect to allow for auth state to settle
        timeoutId = setTimeout(() => {
          router.push('/auth/signin')
        }, 500)
      } else {
        // Only fetch profile if we have a user
        const fetchProfile = async () => {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()

          if (!error) {
            setProfile(data)
          }
        }

        fetchProfile()
      }
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [user, loading, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/signin')
  }

  // Show loading state while checking auth
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <EchoLayout>
          <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
            <div className="animate-pulse">
              <div className="flex items-center mb-8">
                <div className="w-20 h-20 bg-white/10 rounded-full mr-4" />
                <div>
                  <div className="h-8 w-48 bg-white/10 rounded mb-2" />
                  <div className="h-4 w-32 bg-white/10 rounded" />
                </div>
              </div>
              <div className="w-full h-48 bg-white/10 rounded-lg" />
            </div>
          </div>
          <BottomNav />
        </EchoLayout>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <EchoLayout>
        <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <Avatar className="h-20 w-20 mr-4 ring-2 ring-white/20">
                <AvatarImage src={user.user_metadata.avatar_url} />
                <AvatarFallback className="text-2xl bg-white/10 text-white">
                  {user.user_metadata.name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-white">{profile?.name || user.user_metadata.name}</h1>
                {profile?.username && (
                  <p className="text-gray-400">@{profile.username}</p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-300 hover:text-white hover:bg-white/10"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Logout
            </Button>
          </div>

          <Card className="w-full backdrop-blur-xl bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">Email</label>
                <p className="text-white">{user.email}</p>
              </div>
              
              <div>
                <label className="text-sm text-gray-400">Name</label>
                <p className="text-white">{profile?.name || user.user_metadata.name}</p>
              </div>

              {profile?.username && (
                <div>
                  <label className="text-sm text-gray-400">Username</label>
                  <p className="text-white">@{profile.username}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <BottomNav />
      </EchoLayout>
    </div>
  )
} 