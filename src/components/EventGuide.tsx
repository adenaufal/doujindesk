import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { Alert, AlertDescription } from './ui/alert'
import { 
  Search, 
  MapPin, 
  Clock, 
  // Users, - removed unused 
  Star, 
  Navigation, 
  Bell, 
  Calendar,
  Filter,
  Heart,
  Share2,
  QrCode,
  Wifi,
  WifiOff
} from 'lucide-react'
import { useEventStore } from '../stores/eventStore'
// import { useCircleStore } from '../stores/circleStore'

// Import the new components
import AttendeeRegistration from './AttendeeRegistration'
import EventSchedule from './EventSchedule'
import InteractiveMap from './InteractiveMap'
// import CircleCatalog from './CircleCatalog' - removed unused
// import QueueStatus from './QueueStatus' - removed unused
import NotificationCenter from './NotificationCenter'
import AnnouncementSystem from './AnnouncementSystem'

interface Circle {
  id: string
  circle_name: string
  circle_code: string
  fandom: string
  genre: string[]
  booth_number?: string
  social_media: {
    twitter?: string
    instagram?: string
    website?: string
  }
  sample_works: string[]
  description: string
  rating: number
  queue_status: 'low' | 'medium' | 'high'
  is_favorite: boolean
}

interface EventSchedule {
  id: string
  title: string
  description: string
  start_time: string
  end_time: string
  location: string
  type: 'panel' | 'performance' | 'announcement' | 'special'
}

interface Announcement {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'urgent'
  timestamp: string
  read: boolean
}

const EventGuide: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGenre, setSelectedGenre] = useState<string>('')
  const [selectedFandom, setSelectedFandom] = useState<string>('')
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  // const [notifications] = useState<Announcement[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState('catalog')

  const { currentEvent } = useEventStore()
  // const { circles } = useCircleStore() - removed unused

  // Mock data for demonstration
  const [mockCircles] = useState<Circle[]>([
    {
      id: '1',
      circle_name: 'Sakura Studios',
      circle_code: 'SS001',
      fandom: 'Original',
      genre: ['Illustration', 'Manga'],
      booth_number: 'A-12',
      social_media: {
        twitter: '@sakurastudios',
        website: 'sakurastudios.com'
      },
      sample_works: ['artwork1.jpg', 'manga_sample.pdf'],
      description: 'Creating beautiful original illustrations and manga stories.',
      rating: 4.8,
      queue_status: 'medium',
      is_favorite: false
    },
    {
      id: '2',
      circle_name: 'Digital Dreams',
      circle_code: 'DD002',
      fandom: 'Anime',
      genre: ['Digital Art', 'Prints'],
      booth_number: 'B-05',
      social_media: {
        instagram: '@digitaldreams_art',
        website: 'digitaldreams.net'
      },
      sample_works: ['digital_art1.jpg', 'prints_catalog.pdf'],
      description: 'High-quality digital art prints and commissions.',
      rating: 4.6,
      queue_status: 'low',
      is_favorite: false
    }
  ])

  const [mockSchedule] = useState<EventSchedule[]>([
    {
      id: '1',
      title: 'Opening Ceremony',
      description: 'Welcome to Comic Frontier 2024!',
      start_time: '09:00',
      end_time: '09:30',
      location: 'Main Stage',
      type: 'announcement'
    },
    {
      id: '2',
      title: 'Artist Panel: Digital Art Techniques',
      description: 'Learn from professional digital artists',
      start_time: '11:00',
      end_time: '12:00',
      location: 'Panel Room A',
      type: 'panel'
    },
    {
      id: '3',
      title: 'Cosplay Contest',
      description: 'Annual cosplay competition',
      start_time: '14:00',
      end_time: '16:00',
      location: 'Main Stage',
      type: 'performance'
    }
  ])

  const [mockAnnouncements] = useState<Announcement[]>([
    {
      id: '1',
      title: 'Event Update',
      message: 'Food court hours extended until 8 PM',
      type: 'info',
      timestamp: '10:30 AM',
      read: false
    },
    {
      id: '2',
      title: 'Queue Alert',
      message: 'High traffic at Hall A - consider alternative routes',
      type: 'warning',
      timestamp: '11:15 AM',
      read: false
    }
  ])

  // Filter circles based on search and filters
  const filteredCircles = mockCircles.filter(circle => {
    const matchesSearch = circle.circle_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         circle.fandom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         circle.genre.some(g => g.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesGenre = !selectedGenre || circle.genre.includes(selectedGenre)
    const matchesFandom = !selectedFandom || circle.fandom === selectedFandom
    return matchesSearch && matchesGenre && matchesFandom
  })

  // Get unique genres and fandoms for filters
  const allGenres = Array.from(new Set(mockCircles.flatMap(c => c.genre)))
  const allFandoms = Array.from(new Set(mockCircles.map(c => c.fandom)))

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Update unread notifications count
  useEffect(() => {
    setUnreadCount(mockAnnouncements.filter(a => !a.read).length)
  }, [mockAnnouncements])

  const toggleFavorite = (circleId: string) => {
    const newFavorites = new Set(favorites)
    if (newFavorites.has(circleId)) {
      newFavorites.delete(circleId)
    } else {
      newFavorites.add(circleId)
    }
    setFavorites(newFavorites)
  }

  const getQueueStatusColor = (status: string) => {
    switch (status) {
      case 'low': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getQueueStatusText = (status: string) => {
    switch (status) {
      case 'low': return 'Low Traffic'
      case 'medium': return 'Moderate Queue'
      case 'high': return 'High Traffic'
      default: return 'Unknown'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with offline indicator */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Event Guide</h1>
              <p className="text-sm text-gray-600">
                {currentEvent?.name || 'Comic Frontier 2025'} - Attendee Portal
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Offline indicator */}
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                isOffline ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }`}>
                {isOffline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
                <span>{isOffline ? 'Offline Mode' : 'Online'}</span>
              </div>
              
              {/* Notifications */}
              <Button variant="outline" size="sm" className="relative">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="catalog">Circle Catalog</TabsTrigger>
            <TabsTrigger value="map">Venue Map</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="info">Event Info</TabsTrigger>
            <TabsTrigger value="registration">Registration</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
          </TabsList>

          {/* Circle Catalog Tab */}
          <TabsContent value="catalog" className="space-y-6">
            {/* Search and Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Search className="h-5 w-5" />
                  <span>Find Circles</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search by circle name, fandom, or genre..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <select
                    value={selectedGenre}
                    onChange={(e) => setSelectedGenre(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Genres</option>
                    {allGenres.map(genre => (
                      <option key={genre} value={genre}>{genre}</option>
                    ))}
                  </select>
                  <select
                    value={selectedFandom}
                    onChange={(e) => setSelectedFandom(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Fandoms</option>
                    {allFandoms.map(fandom => (
                      <option key={fandom} value={fandom}>{fandom}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Showing {filteredCircles.length} circles</span>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    More Filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Circle Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCircles.map((circle) => (
                <Card key={circle.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{circle.circle_name}</CardTitle>
                        <CardDescription className="flex items-center space-x-2">
                          <span>{circle.circle_code}</span>
                          {circle.booth_number && (
                            <>
                              <span>•</span>
                              <span className="flex items-center">
                                <MapPin className="h-3 w-3 mr-1" />
                                {circle.booth_number}
                              </span>
                            </>
                          )}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleFavorite(circle.id)}
                        className="p-1"
                      >
                        <Heart className={`h-4 w-4 ${
                          favorites.has(circle.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'
                        }`} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-gray-600 line-clamp-2">{circle.description}</p>
                    
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary">{circle.fandom}</Badge>
                      {circle.genre.map(genre => (
                        <Badge key={genre} variant="outline" className="text-xs">
                          {genre}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="text-sm ml-1">{circle.rating}</span>
                        </div>
                        <Badge className={getQueueStatusColor(circle.queue_status)}>
                          {getQueueStatusText(circle.queue_status)}
                        </Badge>
                      </div>
                      
                      <div className="flex space-x-1">
                        {circle.social_media.twitter && (
                          <Button variant="ghost" size="sm" className="p-1">
                            <Share2 className="h-3 w-3" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="p-1">
                          <Navigation className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Venue Map Tab */}
          <TabsContent value="map">
            <InteractiveMap />
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Event Schedule</span>
                </CardTitle>
                <CardDescription>
                  Today's events and activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {mockSchedule.map((event, index) => (
                      <div key={event.id}>
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                              <Clock className="h-5 w-5 text-blue-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-gray-900">
                                {event.title}
                              </h4>
                              <Badge variant={event.type === 'special' ? 'default' : 'secondary'}>
                                {event.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                              <span>{event.start_time} - {event.end_time}</span>
                              <span>•</span>
                              <span className="flex items-center">
                                <MapPin className="h-3 w-3 mr-1" />
                                {event.location}
                              </span>
                            </div>
                          </div>
                        </div>
                        {index < mockSchedule.length - 1 && <Separator className="mt-4" />}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Registration Tab */}
          <TabsContent value="registration">
            <AttendeeRegistration />
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <NotificationCenter />
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements">
            <AnnouncementSystem />
          </TabsContent>

          {/* Event Info Tab */}
          <TabsContent value="info" className="space-y-6">
            {/* Announcements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bell className="h-5 w-5" />
                  <span>Announcements</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockAnnouncements.map((announcement) => (
                    <Alert key={announcement.id} className={`${
                      announcement.type === 'urgent' ? 'border-red-200 bg-red-50' :
                      announcement.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                      'border-blue-200 bg-blue-50'
                    }`}>
                      <AlertDescription>
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{announcement.title}</h4>
                            <p className="text-sm mt-1">{announcement.message}</p>
                          </div>
                          <span className="text-xs text-gray-500">{announcement.timestamp}</span>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Event Information */}
            <Card>
              <CardHeader>
                <CardTitle>Event Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700">Event Dates</h4>
                    <p className="text-sm">December 14-15, 2025</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700">Venue</h4>
                    <p className="text-sm">Jakarta Convention Center</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700">Operating Hours</h4>
                    <p className="text-sm">9:00 AM - 6:00 PM</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700">Emergency Contact</h4>
                    <p className="text-sm">+62 21 1234 5678</p>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm">
                      <QrCode className="h-4 w-4 mr-2" />
                      Show Ticket
                    </Button>
                    <Button variant="outline" size="sm">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share Event
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default EventGuide