import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import { 
  Map, 
  Navigation, 
  Search, 
  MapPin, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Info,
  Users,
  Store,
  Utensils,
  // Car, - removed unused
  Accessibility,
  Wifi,
  Camera,
  Heart,
  Star,
  Clock,
  Phone,
  ExternalLink
} from 'lucide-react'

interface MapLocation {
  id: string
  name: string
  type: 'booth' | 'facility' | 'entrance' | 'stage' | 'food' | 'restroom' | 'emergency' | 'info'
  coordinates: [number, number]
  description?: string
  floor: number
  category?: string
  booth_number?: string
  circle_name?: string
  opening_hours?: string
  contact?: string
  accessibility?: boolean
  wifi?: boolean
  capacity?: number
  current_queue?: number
  featured?: boolean
}

interface Floor {
  id: number
  name: string
  description: string
  map_image: string
  locations: MapLocation[]
}

const InteractiveMap: React.FC = () => {
  const [selectedFloor, setSelectedFloor] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null)
  const [showLegend, setShowLegend] = useState(false)
  const [mapMode, setMapMode] = useState<'explore' | 'navigate'>('explore')
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [favoriteLocations, setFavoriteLocations] = useState<Set<string>>(new Set())
  const mapRef = useRef<HTMLDivElement>(null)

  // Mock floor data
  const floors: Floor[] = [
    {
      id: 1,
      name: 'Ground Floor',
      description: 'Main entrance, information desk, and artist alley',
      map_image: '/maps/floor-1.svg',
      locations: [
        {
          id: 'main-entrance',
          name: 'Main Entrance',
          type: 'entrance',
          coordinates: [100, 50],
          floor: 1,
          description: 'Primary entrance with registration and bag check',
          accessibility: true,
          opening_hours: '08:00 - 22:00'
        },
        {
          id: 'info-desk',
          name: 'Information Desk',
          type: 'info',
          coordinates: [120, 80],
          floor: 1,
          description: 'Get help, lost & found, and event information',
          contact: '+62-21-1234-5678',
          accessibility: true,
          wifi: true
        },
        {
          id: 'artist-alley-a1',
          name: 'Artist Alley A1-A50',
          type: 'booth',
          coordinates: [80, 120],
          floor: 1,
          category: 'Artist Alley',
          description: 'Independent artists and small circles',
          booth_number: 'A1-A50'
        },
        {
          id: 'food-court',
          name: 'Food Court',
          type: 'food',
          coordinates: [200, 100],
          floor: 1,
          description: 'Various food vendors and dining area',
          opening_hours: '09:00 - 21:00',
          capacity: 200,
          current_queue: 15,
          wifi: true
        },
        {
          id: 'restroom-1',
          name: 'Restroom (Ground Floor)',
          type: 'restroom',
          coordinates: [250, 80],
          floor: 1,
          accessibility: true
        },
        {
          id: 'main-stage',
          name: 'Main Stage',
          type: 'stage',
          coordinates: [150, 200],
          floor: 1,
          description: 'Opening ceremony, concerts, and major events',
          capacity: 1000,
          featured: true
        }
      ]
    },
    {
      id: 2,
      name: 'Second Floor',
      description: 'Circle booths, workshops, and gaming area',
      map_image: '/maps/floor-2.svg',
      locations: [
        {
          id: 'circle-booth-b1',
          name: 'Circle Booth B1-B100',
          type: 'booth',
          coordinates: [100, 100],
          floor: 2,
          category: 'Circle Booth',
          description: 'Premium circle spaces with larger booths',
          booth_number: 'B1-B100'
        },
        {
          id: 'workshop-room-a',
          name: 'Workshop Room A',
          type: 'facility',
          coordinates: [200, 80],
          floor: 2,
          description: 'Art workshops and tutorials',
          capacity: 30,
          wifi: true,
          accessibility: true
        },
        {
          id: 'gaming-zone',
          name: 'Gaming Zone',
          type: 'facility',
          coordinates: [80, 180],
          floor: 2,
          description: 'Video games, board games, and tournaments',
          capacity: 100,
          current_queue: 25,
          wifi: true
        },
        {
          id: 'contest-stage',
          name: 'Contest Stage',
          type: 'stage',
          coordinates: [180, 150],
          floor: 2,
          description: 'Cosplay contests and competitions',
          capacity: 500,
          featured: true
        },
        {
          id: 'restroom-2',
          name: 'Restroom (Second Floor)',
          type: 'restroom',
          coordinates: [250, 120],
          floor: 2,
          accessibility: true
        }
      ]
    }
  ]

  const locationTypes = [
    { id: 'booth', name: 'Booths', icon: Store, color: 'bg-blue-500' },
    { id: 'facility', name: 'Facilities', icon: Users, color: 'bg-green-500' },
    { id: 'entrance', name: 'Entrances', icon: MapPin, color: 'bg-purple-500' },
    { id: 'stage', name: 'Stages', icon: Camera, color: 'bg-red-500' },
    { id: 'food', name: 'Food & Drinks', icon: Utensils, color: 'bg-orange-500' },
    { id: 'restroom', name: 'Restrooms', icon: Accessibility, color: 'bg-gray-500' },
    { id: 'info', name: 'Information', icon: Info, color: 'bg-yellow-500' },
    { id: 'emergency', name: 'Emergency', icon: Phone, color: 'bg-red-600' }
  ]

  const currentFloor = floors.find(f => f.id === selectedFloor)
  
  const filteredLocations = currentFloor?.locations.filter(location => 
    location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    location.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    location.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    location.booth_number?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const toggleFavorite = (locationId: string) => {
    setFavoriteLocations(prev => {
      const newFavorites = new Set(prev)
      if (newFavorites.has(locationId)) {
        newFavorites.delete(locationId)
      } else {
        newFavorites.add(locationId)
      }
      return newFavorites
    })
  }

  // const getLocationIcon = (type: string) => {
  //   const locationTypeData = locationTypes.find(t => t.id === type)
  //   return locationTypeData ? locationTypeData.icon : MapPin
  // }

  const getLocationColor = (type: string) => {
    const locationTypeData = locationTypes.find(t => t.id === type)
    return locationTypeData ? locationTypeData.color : 'bg-gray-500'
  }

  const handleLocationClick = (location: MapLocation) => {
    setSelectedLocation(location)
  }

  const getDirections = (location: MapLocation) => {
    // In a real implementation, this would calculate and display directions
    alert(`Getting directions to ${location.name}...`)
  }

  const getQueueStatus = (location: MapLocation) => {
    if (!location.current_queue || !location.capacity) return null
    
    const queuePercentage = (location.current_queue / location.capacity) * 100
    let status = 'Low'
    let color = 'text-green-600'
    
    if (queuePercentage > 70) {
      status = 'High'
      color = 'text-red-600'
    } else if (queuePercentage > 40) {
      status = 'Medium'
      color = 'text-yellow-600'
    }
    
    return { status, color, count: location.current_queue }
  }

  // Simulate user location (in a real app, this would use GPS)
  useEffect(() => {
    if (navigator.geolocation && mapMode === 'navigate') {
      navigator.geolocation.getCurrentPosition(
        (_position) => {
          // Convert GPS coordinates to map coordinates (mock conversion)
          setUserLocation([150, 100])
        },
        (_error) => {
          console.log('Location access denied or unavailable')
        }
      )
    }
  }, [mapMode])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Interactive Venue Map</h1>
        <p className="text-gray-600">Navigate the convention center and discover amazing booths</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search booths, facilities, or locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={mapMode === 'explore' ? 'default' : 'outline'}
            onClick={() => setMapMode('explore')}
            className="flex items-center space-x-1"
          >
            <Map className="h-4 w-4" />
            <span>Explore</span>
          </Button>
          <Button
            variant={mapMode === 'navigate' ? 'default' : 'outline'}
            onClick={() => setMapMode('navigate')}
            className="flex items-center space-x-1"
          >
            <Navigation className="h-4 w-4" />
            <span>Navigate</span>
          </Button>
        </div>

        {/* Legend Toggle */}
        <Button
          variant="outline"
          onClick={() => setShowLegend(!showLegend)}
          className="flex items-center space-x-1"
        >
          <Layers className="h-4 w-4" />
          <span>Legend</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map Area */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Floor Plan</CardTitle>
                  <CardDescription>
                    {currentFloor?.description}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Floor Selector */}
                  <Tabs value={selectedFloor.toString()} onValueChange={(value) => setSelectedFloor(parseInt(value))}>
                    <TabsList>
                      {floors.map((floor) => (
                        <TabsTrigger key={floor.id} value={floor.id.toString()}>
                          {floor.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Map Container */}
              <div 
                ref={mapRef}
                className="relative w-full h-96 bg-gray-100 border rounded-lg overflow-hidden"
                style={{ minHeight: '400px' }}
              >
                {/* SVG Map Placeholder */}
                <svg 
                  viewBox="0 0 300 250" 
                  className="w-full h-full"
                  style={{ background: '#f8f9fa' }}
                >
                  {/* Floor Layout */}
                  <rect x="20" y="20" width="260" height="210" fill="white" stroke="#e5e7eb" strokeWidth="2" rx="4" />
                  
                  {/* Room Divisions */}
                  <line x1="20" y1="100" x2="280" y2="100" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="5,5" />
                  <line x1="150" y1="20" x2="150" y2="230" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="5,5" />
                  
                  {/* User Location (if in navigate mode) */}
                  {mapMode === 'navigate' && userLocation && (
                    <g>
                      <circle 
                        cx={userLocation[0]} 
                        cy={userLocation[1]} 
                        r="8" 
                        fill="#3b82f6" 
                        stroke="white" 
                        strokeWidth="2"
                      />
                      <circle 
                        cx={userLocation[0]} 
                        cy={userLocation[1]} 
                        r="15" 
                        fill="none" 
                        stroke="#3b82f6" 
                        strokeWidth="2" 
                        opacity="0.5"
                      >
                        <animate attributeName="r" values="15;25;15" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
                      </circle>
                    </g>
                  )}
                  
                  {/* Location Markers */}
                  {filteredLocations.map((location) => {
                    // const _Icon = getLocationIcon(location.type)
                    const isSelected = selectedLocation?.id === location.id
                    const isFavorite = favoriteLocations.has(location.id)
                    
                    return (
                      <g key={location.id}>
                        {/* Location Marker */}
                        <circle
                          cx={location.coordinates[0]}
                          cy={location.coordinates[1]}
                          r={isSelected ? "12" : "8"}
                          className={`${getLocationColor(location.type)} cursor-pointer transition-all`}
                          fill="currentColor"
                          stroke={isSelected ? "#1f2937" : "white"}
                          strokeWidth={isSelected ? "3" : "2"}
                          onClick={() => handleLocationClick(location)}
                        />
                        
                        {/* Featured Badge */}
                        {location.featured && (
                          <circle
                            cx={location.coordinates[0] + 8}
                            cy={location.coordinates[1] - 8}
                            r="4"
                            fill="#fbbf24"
                            stroke="white"
                            strokeWidth="1"
                          />
                        )}
                        
                        {/* Favorite Badge */}
                        {isFavorite && (
                          <circle
                            cx={location.coordinates[0] - 8}
                            cy={location.coordinates[1] - 8}
                            r="4"
                            fill="#ef4444"
                            stroke="white"
                            strokeWidth="1"
                          />
                        )}
                        
                        {/* Location Label */}
                        <text
                          x={location.coordinates[0]}
                          y={location.coordinates[1] + 20}
                          textAnchor="middle"
                          className="text-xs font-medium fill-gray-700"
                          style={{ fontSize: '10px' }}
                        >
                          {location.booth_number || location.name.split(' ')[0]}
                        </text>
                      </g>
                    )
                  })}
                </svg>
                
                {/* Map Controls */}
                <div className="absolute top-4 right-4 flex flex-col space-y-2">
                  <Button size="sm" variant="outline" className="bg-white">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="bg-white">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="bg-white">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Legend */}
          {showLegend && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Map Legend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {locationTypes.map((type) => {
                    const Icon = type.icon
                    return (
                      <div key={type.id} className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full ${type.color}`} />
                        <Icon className="h-4 w-4 text-gray-600" />
                        <span className="text-sm">{type.name}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 pt-4 border-t space-y-2">
                  <div className="flex items-center space-x-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">Featured</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Heart className="h-4 w-4 text-red-500" />
                    <span className="text-sm">Favorites</span>
                  </div>
                  {mapMode === 'navigate' && (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 rounded-full bg-blue-500" />
                      <span className="text-sm">Your Location</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selected Location Details */}
          {selectedLocation && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedLocation.name}</CardTitle>
                    <CardDescription>{selectedLocation.description}</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFavorite(selectedLocation.id)}
                    className={favoriteLocations.has(selectedLocation.id) ? 'text-red-600' : 'text-gray-400'}
                  >
                    <Heart className={`h-4 w-4 ${favoriteLocations.has(selectedLocation.id) ? 'fill-current' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Location Type */}
                <div className="flex items-center space-x-2">
                  <Badge className={getLocationColor(selectedLocation.type)}>
                    {selectedLocation.type.charAt(0).toUpperCase() + selectedLocation.type.slice(1)}
                  </Badge>
                  {selectedLocation.featured && (
                    <Badge variant="secondary">
                      <Star className="h-3 w-3 mr-1" />
                      Featured
                    </Badge>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  {selectedLocation.booth_number && (
                    <div><span className="font-medium">Booth:</span> {selectedLocation.booth_number}</div>
                  )}
                  {selectedLocation.category && (
                    <div><span className="font-medium">Category:</span> {selectedLocation.category}</div>
                  )}
                  {selectedLocation.opening_hours && (
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{selectedLocation.opening_hours}</span>
                    </div>
                  )}
                  {selectedLocation.contact && (
                    <div className="flex items-center space-x-1">
                      <Phone className="h-4 w-4" />
                      <span>{selectedLocation.contact}</span>
                    </div>
                  )}
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-1">
                  {selectedLocation.accessibility && (
                    <Badge variant="outline" className="text-xs">
                      <Accessibility className="h-3 w-3 mr-1" />
                      Accessible
                    </Badge>
                  )}
                  {selectedLocation.wifi && (
                    <Badge variant="outline" className="text-xs">
                      <Wifi className="h-3 w-3 mr-1" />
                      WiFi
                    </Badge>
                  )}
                </div>

                {/* Queue Status */}
                {selectedLocation.current_queue && selectedLocation.capacity && (
                  <div className="p-2 bg-gray-50 rounded">
                    <div className="flex items-center justify-between text-sm">
                      <span>Current Queue:</span>
                      <span className={getQueueStatus(selectedLocation)?.color}>
                        {getQueueStatus(selectedLocation)?.count} people ({getQueueStatus(selectedLocation)?.status})
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all" 
                        style={{ 
                          width: `${Math.min((selectedLocation.current_queue / selectedLocation.capacity) * 100, 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    onClick={() => getDirections(selectedLocation)}
                    className="flex-1"
                  >
                    <Navigation className="h-4 w-4 mr-1" />
                    Directions
                  </Button>
                  {selectedLocation.type === 'booth' && (
                    <Button size="sm" variant="outline">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Visit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {locationTypes.slice(0, 4).map((type) => {
                  const Icon = type.icon
                  const count = currentFloor?.locations.filter(l => l.type === type.id).length || 0
                  return (
                    <Button
                      key={type.id}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setSearchQuery(type.name)}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      <span>{type.name}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {count}
                      </Badge>
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default InteractiveMap