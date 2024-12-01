'use client'

import { createClient } from '@/utils/supabase/client'
import EchoLayout from '@/components/EchoLayout'
import BottomNav from '@/components/BottomNav'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthStateProvider'
import { LogOut } from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [followedSpeakers, setFollowedSpeakers] = useState<any[]>([])
  const [followedOrgs, setFollowedOrgs] = useState<any[]>([])
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
        // Only fetch profile and follows if we have a user
        const fetchData = async () => {
          // Fetch profile
          const { data: profileData } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()

          if (profileData) {
            setProfile(profileData)
          }

          // Fetch followed speakers
          const { data: speakersData } = await supabase
            .from('following')
            .select(`
              speaker:speaker_id (
                id,
                name,
                image_url
              )
            `)
            .eq('user_id', user.id)
            .not('speaker_id', 'is', null)

          if (speakersData) {
            setFollowedSpeakers(speakersData.map(d => d.speaker).filter(Boolean))
          }

          // Fetch followed organizations
          const { data: orgsData } = await supabase
            .from('following')
            .select(`
              organization:org_id (
                id,
                name,
                logo_url
              )
            `)
            .eq('user_id', user.id)
            .not('org_id', 'is', null)

          if (orgsData) {
            setFollowedOrgs(orgsData.map(d => d.organization).filter(Boolean))
          }
        }

        fetchData()
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

  const handleUnfollow = async (type: 'speaker' | 'org', id: string) => {
    const column = type === 'speaker' ? 'speaker_id' : 'org_id'
    
    const { error } = await supabase
      .from('following')
      .delete()
      .eq('user_id', user.id)
      .eq(column, id)

    if (!error) {
      if (type === 'speaker') {
        setFollowedSpeakers(prev => prev.filter(s => s.id !== id))
      } else {
        setFollowedOrgs(prev => prev.filter(o => o.id !== id))
      }
    }
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

          <Card className="w-full backdrop-blur-xl bg-white/10 border-white/20 shadow-xl mb-6">
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

          <Tabs defaultValue="speakers" className="w-full">
            <TabsList className="w-full backdrop-blur-xl bg-white/10 border-white/20">
              <TabsTrigger value="speakers" className="flex-1 text-white data-[state=active]:bg-white/20">
                Followed Speakers
              </TabsTrigger>
              <TabsTrigger value="organizations" className="flex-1 text-white data-[state=active]:bg-white/20">
                Followed Organizations
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="speakers">
              <Card className="backdrop-blur-xl bg-white/10 border-white/20">
                <CardContent className="p-4 space-y-4">
                  {followedSpeakers.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">You haven't followed any speakers yet.</p>
                  ) : (
                    followedSpeakers.map((speaker) => (
                      <div key={speaker.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Avatar>
                            <AvatarImage src={speaker.image_url} />
                            <AvatarFallback className="bg-white/10 text-white">
                              {speaker.name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-white">{speaker.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnfollow('speaker', speaker.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        >
                          Unfollow
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="organizations">
              <Card className="backdrop-blur-xl bg-white/10 border-white/20">
                <CardContent className="p-4 space-y-4">
                  {followedOrgs.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">You haven't followed any organizations yet.</p>
                  ) : (
                    followedOrgs.map((org) => (
                      <div key={org.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Avatar>
                            <AvatarImage src={org.logo_url} />
                            <AvatarFallback className="bg-white/10 text-white">
                              {org.name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-white">{org.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnfollow('org', org.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        >
                          Unfollow
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        <BottomNav />
      </EchoLayout>
    </div>
  )
} 