import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function AgentsManagement() {
  const [isRunning, setIsRunning] = useState(false)
  
  const handleRunCrawler = async () => {
    setIsRunning(true)
    try {
      const response = await fetch('/api/admin/agents/crawler', {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to run crawler')
      // Handle success
    } catch (error) {
      console.error('Error running crawler:', error)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Management</CardTitle>
        <CardDescription>
          Monitor and control the quote extraction agents
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="crawler">
          <TabsList>
            <TabsTrigger value="crawler">URL Crawler</TabsTrigger>
            {/* Add other agent tabs as we build them */}
          </TabsList>

          <TabsContent value="crawler">
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  URL Crawler Agent
                  <Badge variant={isRunning ? "default" : "secondary"}>
                    {isRunning ? "Running" : "Idle"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Monitors configured URLs and extracts article links
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">Last Run</h4>
                      <p className="text-sm text-muted-foreground">
                        Never
                      </p>
                    </div>
                    <Button 
                      onClick={handleRunCrawler}
                      disabled={isRunning}
                    >
                      {isRunning ? "Running..." : "Run Crawler"}
                    </Button>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Recent Activity</h4>
                    <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">No recent activity</p>
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
} 