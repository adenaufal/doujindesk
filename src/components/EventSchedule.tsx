import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Star,
  Search,
  // Filter,
  Bell,
  BellOff,
  ExternalLink,
  Mic,
  Camera,
  Award,
  Heart
} from 'lucide-react'

interface EventActivity {
  id: string
  title: string
  description: string
  start_time: string
  end_time: string
  location: string
  category: 'panel' | 'workshop' | 'contest' | 'performance' | 'special' | 'social'
  capacity: number
  registered: number
  featured: boolean
  tags: string[]
  organizer: string
  requirements?: string
  age_restriction?: string
  cost?: number
  registration_required: boolean
  live_stream?: boolean
}

interface EventDay {
  date: string
  day_name: string
  activities: EventActivity[]
}

const EventSchedule: React.FC = () => {
  const [selectedDay, setSelectedDay] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [favoriteEvents, setFavoriteEvents] = useState<Set<string>>(new Set())
  const [notificationEvents, setNotificationEvents] = useState<Set<string>>(new Set())

  // Mock event schedule data
  const eventSchedule: EventDay[] = [
    {
      date: '2025-03-15',
      day_name: 'Friday',
      activities: [
        {
          id: 'opening-ceremony',
          title: 'Opening Ceremony',
          description: 'Official opening of Comic Frontier 2024 with special guests and announcements',
          start_time: '09:00',
          end_time: '10:00',
          location: 'Main Stage',
          category: 'special',
          capacity: 1000,
          registered: 850,
          featured: true,
          tags: ['opening', 'ceremony', 'special-guests'],
          organizer: 'Comic Frontier Team',
          registration_required: false,
          live_stream: true
        },
        {
          id: 'digital-art-workshop',
          title: 'Digital Art Fundamentals Workshop',
          description: 'Learn the basics of digital illustration with professional artists',
          start_time: '10:30',
          end_time: '12:00',
          location: 'Workshop Room A',
          category: 'workshop',
          capacity: 30,
          registered: 28,
          featured: false,
          tags: ['digital-art', 'illustration', 'beginner'],
          organizer: 'Art Circle Alliance',
          requirements: 'Bring your own tablet/laptop',
          registration_required: true,
          cost: 50000
        },
        {
          id: 'cosplay-contest-prelim',
          title: 'Cosplay Contest - Preliminaries',
          description: 'First round of judging for the annual cosplay competition',
          start_time: '13:00',
          end_time: '15:00',
          location: 'Contest Stage',
          category: 'contest',
          capacity: 500,
          registered: 120,
          featured: true,
          tags: ['cosplay', 'contest', 'competition'],
          organizer: 'Cosplay Committee',
          registration_required: true
        },
        {
          id: 'indie-game-showcase',
          title: 'Indonesian Indie Game Showcase',
          description: 'Discover amazing indie games created by local developers',
          start_time: '15:30',
          end_time: '17:00',
          location: 'Gaming Zone',
          category: 'panel',
          capacity: 200,
          registered: 145,
          featured: false,
          tags: ['gaming', 'indie', 'local-developers'],
          organizer: 'Indie Game Collective',
          registration_required: false
        },
        {
          id: 'evening-concert',
          title: 'Anime Music Concert',
          description: 'Live performance of popular anime songs by local bands',
          start_time: '19:00',
          end_time: '21:00',
          location: 'Main Stage',
          category: 'performance',
          capacity: 1000,
          registered: 920,
          featured: true,
          tags: ['music', 'anime', 'concert', 'live'],
          organizer: 'Anime Music Society',
          registration_required: false,
          live_stream: true
        }
      ]
    },
    {
      date: '2025-03-16',
      day_name: 'Saturday',
      activities: [
        {
          id: 'manga-drawing-masterclass',
          title: 'Manga Drawing Masterclass',
          description: 'Advanced techniques for creating professional manga artwork',
          start_time: '09:00',
          end_time: '11:00',
          location: 'Workshop Room B',
          category: 'workshop',
          capacity: 25,
          registered: 25,
          featured: true,
          tags: ['manga', 'drawing', 'advanced'],
          organizer: 'Professional Manga Artists',
          requirements: 'Previous drawing experience required',
          registration_required: true,
          cost: 100000
        },
        {
          id: 'voice-acting-panel',
          title: 'Voice Acting in Anime Industry',
          description: 'Panel discussion with professional voice actors about the industry',
          start_time: '11:30',
          end_time: '12:30',
          location: 'Panel Room 1',
          category: 'panel',
          capacity: 150,
          registered: 135,
          featured: false,
          tags: ['voice-acting', 'anime', 'industry'],
          organizer: 'Voice Actor Guild',
          registration_required: false
        },
        {
          id: 'cosplay-finals',
          title: 'Cosplay Contest - Finals',
          description: 'Final round of the cosplay competition with amazing prizes',
          start_time: '14:00',
          end_time: '16:00',
          location: 'Main Stage',
          category: 'contest',
          capacity: 1000,
          registered: 45,
          featured: true,
          tags: ['cosplay', 'contest', 'finals', 'prizes'],
          organizer: 'Cosplay Committee',
          registration_required: true,
          live_stream: true
        },
        {
          id: 'artist-alley-meetup',
          title: 'Artist Alley Social Meetup',
          description: 'Networking event for artists and art enthusiasts',
          start_time: '16:30',
          end_time: '18:00',
          location: 'Artist Alley Lounge',
          category: 'social',
          capacity: 100,
          registered: 78,
          featured: false,
          tags: ['networking', 'artists', 'social'],
          organizer: 'Artist Alley Committee',
          registration_required: false
        },
        {
          id: 'closing-ceremony',
          title: 'Closing Ceremony & Awards',
          description: 'Official closing with contest results and special performances',
          start_time: '20:00',
          end_time: '21:30',
          location: 'Main Stage',
          category: 'special',
          capacity: 1000,
          registered: 800,
          featured: true,
          tags: ['closing', 'awards', 'ceremony'],
          organizer: 'Comic Frontier Team',
          registration_required: false,
          live_stream: true
        }
      ]
    }
  ]

  const categories = [
    { id: 'all', name: 'All Events', icon: Calendar },
    { id: 'panel', name: 'Panels', icon: Mic },
    { id: 'workshop', name: 'Workshops', icon: Users },
    { id: 'contest', name: 'Contests', icon: Award },
    { id: 'performance', name: 'Performances', icon: Camera },
    { id: 'special', name: 'Special Events', icon: Star },
    { id: 'social', name: 'Social', icon: Heart }
  ]

  const filteredActivities = useMemo(() => {
    const currentDay = eventSchedule[selectedDay]
    if (!currentDay) return []

    return currentDay.activities.filter(activity => {
      const matchesSearch = activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           activity.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           activity.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesCategory = selectedCategory === 'all' || activity.category === selectedCategory
      
      return matchesSearch && matchesCategory
    })
  }, [selectedDay, searchQuery, selectedCategory, eventSchedule])

  const toggleFavorite = (eventId: string) => {
    setFavoriteEvents(prev => {
      const newFavorites = new Set(prev)
      if (newFavorites.has(eventId)) {
        newFavorites.delete(eventId)
      } else {
        newFavorites.add(eventId)
      }
      return newFavorites
    })
  }

  const toggleNotification = (eventId: string) => {
    setNotificationEvents(prev => {
      const newNotifications = new Set(prev)
      if (newNotifications.has(eventId)) {
        newNotifications.delete(eventId)
      } else {
        newNotifications.add(eventId)
      }
      return newNotifications
    })
  }

  const getCategoryIcon = (category: string) => {
    const categoryData = categories.find(c => c.id === category)
    return categoryData ? categoryData.icon : Calendar
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      panel: 'bg-blue-100 text-blue-800',
      workshop: 'bg-green-100 text-green-800',
      contest: 'bg-purple-100 text-purple-800',
      performance: 'bg-pink-100 text-pink-800',
      special: 'bg-yellow-100 text-yellow-800',
      social: 'bg-orange-100 text-orange-800'
    }
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const formatTime = (time: string) => {
    return time
  }

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`
  }

  const getAvailabilityStatus = (activity: EventActivity) => {
    const availableSpots = activity.capacity - activity.registered
    if (availableSpots <= 0) return { status: 'full', text: 'Full', color: 'bg-red-100 text-red-800' }
    if (availableSpots <= 5) return { status: 'limited', text: 'Limited', color: 'bg-yellow-100 text-yellow-800' }
    return { status: 'available', text: 'Available', color: 'bg-green-100 text-green-800' }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Event Schedule</h1>
        <p className="text-gray-600">Discover amazing activities and plan your convention experience</p>
      </div>

      {/* Day Selector */}
      <Tabs value={selectedDay.toString()} onValueChange={(value) => setSelectedDay(parseInt(value))}>
        <TabsList className="grid w-full grid-cols-2">
          {eventSchedule.map((day, index) => (
            <TabsTrigger key={index} value={index.toString()} className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>{day.day_name}</span>
              <span className="text-sm text-gray-500">({day.date})</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search events, activities, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {categories.map((category) => {
              const Icon = category.icon
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="flex items-center space-x-1 whitespace-nowrap"
                >
                  <Icon className="h-4 w-4" />
                  <span>{category.name}</span>
                </Button>
              )
            })}
          </div>
        </div>

        {/* Schedule Content */}
        {eventSchedule.map((_, dayIndex) => (
          <TabsContent key={dayIndex} value={dayIndex.toString()} className="mt-6">
            <div className="space-y-4">
              {filteredActivities.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No events found</h3>
                    <p className="text-gray-600">Try adjusting your search or filter criteria</p>
                  </CardContent>
                </Card>
              ) : (
                filteredActivities.map((activity) => {
                  const CategoryIcon = getCategoryIcon(activity.category)
                  const availability = getAvailabilityStatus(activity)
                  
                  return (
                    <Card key={activity.id} className={`transition-all hover:shadow-lg ${
                      activity.featured ? 'ring-2 ring-blue-200 bg-blue-50' : ''
                    }`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge className={getCategoryColor(activity.category)}>
                                <CategoryIcon className="h-3 w-3 mr-1" />
                                {activity.category.charAt(0).toUpperCase() + activity.category.slice(1)}
                              </Badge>
                              {activity.featured && (
                                <Badge variant="secondary">
                                  <Star className="h-3 w-3 mr-1" />
                                  Featured
                                </Badge>
                              )}
                              {activity.live_stream && (
                                <Badge variant="outline">
                                  <Camera className="h-3 w-3 mr-1" />
                                  Live Stream
                                </Badge>
                              )}
                              <Badge className={availability.color}>
                                {availability.text}
                              </Badge>
                            </div>
                            <CardTitle className="text-xl mb-1">{activity.title}</CardTitle>
                            <CardDescription className="text-base">{activity.description}</CardDescription>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleFavorite(activity.id)}
                              className={favoriteEvents.has(activity.id) ? 'text-red-600' : 'text-gray-400'}
                            >
                              <Heart className={`h-4 w-4 ${favoriteEvents.has(activity.id) ? 'fill-current' : ''}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleNotification(activity.id)}
                              className={notificationEvents.has(activity.id) ? 'text-blue-600' : 'text-gray-400'}
                            >
                              {notificationEvents.has(activity.id) ? (
                                <Bell className="h-4 w-4 fill-current" />
                              ) : (
                                <BellOff className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">
                              {formatTime(activity.start_time)} - {formatTime(activity.end_time)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">{activity.location}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Users className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">
                              {activity.registered}/{activity.capacity} attendees
                            </span>
                          </div>
                          {activity.cost && (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-semibold text-green-600">
                                {formatCurrency(activity.cost)}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="text-sm">
                            <span className="font-medium">Organizer:</span> {activity.organizer}
                          </div>
                          {activity.requirements && (
                            <div className="text-sm">
                              <span className="font-medium">Requirements:</span> {activity.requirements}
                            </div>
                          )}
                          {activity.age_restriction && (
                            <div className="text-sm">
                              <span className="font-medium">Age Restriction:</span> {activity.age_restriction}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1 mb-4">
                          {activity.tags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {activity.registration_required && (
                              <Button 
                                size="sm" 
                                disabled={availability.status === 'full'}
                                className="min-w-[100px]"
                              >
                                {availability.status === 'full' ? 'Full' : 'Register'}
                              </Button>
                            )}
                            {activity.live_stream && (
                              <Button variant="outline" size="sm">
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Watch Live
                              </Button>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {activity.registration_required ? 'Registration Required' : 'Drop-in Welcome'}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* My Schedule Summary */}
      {(favoriteEvents.size > 0 || notificationEvents.size > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Heart className="h-5 w-5" />
              <span>My Schedule</span>
            </CardTitle>
            <CardDescription>
              Your favorited events and notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {favoriteEvents.size > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center space-x-1">
                    <Heart className="h-4 w-4 text-red-600" />
                    <span>Favorites ({favoriteEvents.size})</span>
                  </h4>
                  <div className="space-y-1">
                    {Array.from(favoriteEvents).map(eventId => {
                      const event = eventSchedule.flatMap(day => day.activities).find(a => a.id === eventId)
                      return event ? (
                        <div key={eventId} className="text-sm p-2 bg-gray-50 rounded">
                          <div className="font-medium">{event.title}</div>
                          <div className="text-gray-600">{event.start_time} - {event.location}</div>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              )}
              
              {notificationEvents.size > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center space-x-1">
                    <Bell className="h-4 w-4 text-blue-600" />
                    <span>Notifications ({notificationEvents.size})</span>
                  </h4>
                  <div className="space-y-1">
                    {Array.from(notificationEvents).map(eventId => {
                      const event = eventSchedule.flatMap(day => day.activities).find(a => a.id === eventId)
                      return event ? (
                        <div key={eventId} className="text-sm p-2 bg-gray-50 rounded">
                          <div className="font-medium">{event.title}</div>
                          <div className="text-gray-600">{event.start_time} - {event.location}</div>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default EventSchedule