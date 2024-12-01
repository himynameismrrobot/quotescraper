'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import EchoLayout from '@/components/EchoLayout'
import BottomNav from '@/components/BottomNav'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'

interface Speaker {
  id: string
  name: string
  image_url: string | null
  organization_id: string | null
}

interface Organization {
  id: string
  name: string
  logo_url: string | null
}

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [followedSpeakers, setFollowedSpeakers] = useState<Set<string>>(new Set())
  const [followedOrgs, setFollowedOrgs] = useState<Set<string>>(new Set())
  const supabase = createClient()
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Fetch current follows when component mounts
  useEffect(() => {
    const fetchFollows = async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user?.user?.id) return

      // Fetch speaker follows
      const { data: speakerFollows } = await supabase
        .from('following')
        .select('speaker_id')
        .eq('user_id', user.user.id)
        .not('speaker_id', 'is', null)

      // Fetch org follows
      const { data: orgFollows } = await supabase
        .from('following')
        .select('org_id')
        .eq('user_id', user.user.id)
        .not('org_id', 'is', null)

      if (speakerFollows) {
        setFollowedSpeakers(new Set(speakerFollows.map(f => f.speaker_id)))
      }
      if (orgFollows) {
        setFollowedOrgs(new Set(orgFollows.map(f => f.org_id)))
      }
    }

    fetchFollows()
  }, [supabase])

  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchTerm.trim()) {
        setSpeakers([])
        setOrganizations([])
        return
      }

      setIsSearching(true)
      try {
        // Search speakers
        const { data: speakersData, error: speakersError } = await supabase
          .from('speakers')
          .select('id, name, image_url, organization_id')
          .ilike('name', `%${debouncedSearchTerm}%`)
          .limit(20)

        if (speakersError) {
          console.error('Speakers search error:', speakersError)
        }

        // Search organizations
        const { data: orgsData, error: orgsError } = await supabase
          .from('organizations')
          .select('id, name, logo_url')
          .ilike('name', `%${debouncedSearchTerm}%`)
          .limit(20)

        if (orgsError) {
          console.error('Organizations search error:', orgsError)
        }

        if (speakersData) {
          setSpeakers(speakersData)
        }
        
        if (orgsData) {
          setOrganizations(orgsData)
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsSearching(false)
      }
    }

    performSearch()
  }, [debouncedSearchTerm, supabase])

  const handleFollow = async (type: 'speaker' | 'org', id: string) => {
    const { data: user } = await supabase.auth.getUser()
    if (!user?.user?.id) return

    // Check if already following
    if (type === 'speaker' && followedSpeakers.has(id)) {
      // Unfollow speaker
      const { error } = await supabase
        .from('following')
        .delete()
        .eq('user_id', user.user.id)
        .eq('speaker_id', id)

      if (!error) {
        setFollowedSpeakers(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    } else if (type === 'org' && followedOrgs.has(id)) {
      // Unfollow organization
      const { error } = await supabase
        .from('following')
        .delete()
        .eq('user_id', user.user.id)
        .eq('org_id', id)

      if (!error) {
        setFollowedOrgs(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    } else {
      // Follow new speaker/org
      const { error } = await supabase
        .from('following')
        .insert({
          user_id: user.user.id,
          ...(type === 'speaker' ? { speaker_id: id } : { org_id: id })
        })

      if (!error) {
        if (type === 'speaker') {
          setFollowedSpeakers(prev => new Set([...prev, id]))
        } else {
          setFollowedOrgs(prev => new Set([...prev, id]))
        }
      } else {
        console.error('Follow error:', error)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <EchoLayout>
        <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
          <div className="relative mb-6">
            <Input
              type="text"
              placeholder="Search speakers or organizations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 backdrop-blur-xl bg-white/10 border-white/20 text-white placeholder:text-gray-400"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          </div>

          {debouncedSearchTerm && (
            <Tabs defaultValue="speakers" className="w-full">
              <TabsList className="w-full backdrop-blur-xl bg-white/10 border-white/20">
                <TabsTrigger 
                  value="speakers" 
                  className="flex-1 text-white data-[state=active]:bg-white/20"
                >
                  Speakers ({speakers.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="organizations" 
                  className="flex-1 text-white data-[state=active]:bg-white/20"
                >
                  Organizations ({organizations.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="speakers">
                <Card className="backdrop-blur-xl bg-white/10 border-white/20">
                  <CardContent className="p-4 space-y-4">
                    {isSearching ? (
                      <p className="text-gray-400 text-center py-4">Searching...</p>
                    ) : speakers.length === 0 ? (
                      <p className="text-gray-400 text-center py-4">No speakers found</p>
                    ) : (
                      speakers.map((speaker) => (
                        <div key={speaker.id} className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <Avatar>
                              <AvatarImage src={speaker.image_url || ''} />
                              <AvatarFallback className="bg-white/10 text-white">
                                {speaker.name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-white">{speaker.name}</div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFollow('speaker', speaker.id)}
                            className={followedSpeakers.has(speaker.id) 
                              ? "text-green-400 hover:text-red-300 hover:bg-red-400/10"
                              : "text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                            }
                          >
                            {followedSpeakers.has(speaker.id) ? 'Following' : 'Follow'}
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
                    {isSearching ? (
                      <p className="text-gray-400 text-center py-4">Searching...</p>
                    ) : organizations.length === 0 ? (
                      <p className="text-gray-400 text-center py-4">No organizations found</p>
                    ) : (
                      organizations.map((org) => (
                        <div key={org.id} className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <Avatar>
                              <AvatarImage src={org.logo_url || ''} />
                              <AvatarFallback className="bg-white/10 text-white">
                                {org.name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-white">{org.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFollow('org', org.id)}
                            className={followedOrgs.has(org.id)
                              ? "text-green-400 hover:text-red-300 hover:bg-red-400/10"
                              : "text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                            }
                          >
                            {followedOrgs.has(org.id) ? 'Following' : 'Follow'}
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
        <BottomNav />
      </EchoLayout>
    </div>
  )
} 