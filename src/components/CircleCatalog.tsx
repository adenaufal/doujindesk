import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
// import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { 
  Search, 
  Filter, 
  Heart, 
  Star, 
  MapPin, 
  Clock, 
  ExternalLink,
  Instagram,
  Twitter,
  Globe,
  Mail,
  Calendar,
  Bookmark,
  Share2,
  Eye,
  Grid,
  List,
  SortAsc,
  SortDesc
} from 'lucide-react'
// import { useCircleStore } from '../stores/circleStore'

interface CircleProfile {
  id: string
  circle_name: string
  representative_name: string
  booth_number?: string
  booth_type: 'space' | 'booth'
  booth_size: '1_space' | '2_space' | '4_space' | 'booth_a' | 'booth_b'
  category: string
  genre: string[]
  fandom: string[]
  description: string
  sample_works: string[]
  social_media: {
    website?: string
    twitter?: string
    instagram?: string
    email?: string
  }
  rating: number
  favorites: number
  views: number
  comments: number
  featured: boolean
  new_circle: boolean
  opening_hours?: string
  special_events?: string[]
  collaboration?: boolean
  international?: boolean
  accessibility_friendly?: boolean
  payment_methods: string[]
  languages: string[]
  preview_image?: string
  status: 'confirmed' | 'pending' | 'cancelled'
}

const CircleCatalog: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedGenre, setSelectedGenre] = useState('all')
  const [selectedFandom, setSelectedFandom] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [favoriteCircles, setFavoriteCircles] = useState<Set<string>>(new Set())
  const [bookmarkedCircles, setBookmarkedCircles] = useState<Set<string>>(new Set())
  const [selectedCircle, setSelectedCircle] = useState<CircleProfile | null>(null)
  
  // Mock circle data
  const [circles] = useState<CircleProfile[]>([
    {
      id: 'circle-001',
      circle_name: 'Sakura Studios',
      representative_name: 'Yuki Tanaka',
      booth_number: 'A-15',
      booth_type: 'space',
      booth_size: '2_space',
      category: 'Original',
      genre: ['Illustration', 'Manga'],
      fandom: ['Original Work'],
      description: 'Creating beautiful original illustrations and short manga stories with focus on slice-of-life themes.',
      sample_works: ['/samples/sakura-1.jpg', '/samples/sakura-2.jpg'],
      social_media: {
        website: 'https://sakurastudios.com',
        twitter: '@sakurastudios',
        instagram: '@sakura_studios_art'
      },
      rating: 4.8,
      favorites: 1250,
      views: 8500,
      comments: 45,
      featured: true,
      new_circle: false,
      opening_hours: '10:00 - 18:00',
      special_events: ['Live Drawing Demo at 14:00'],
      collaboration: false,
      international: false,
      accessibility_friendly: true,
      payment_methods: ['Cash', 'Card', 'Digital'],
      languages: ['Japanese', 'English'],
      preview_image: '/previews/sakura-preview.jpg',
      status: 'confirmed'
    },
    {
      id: 'circle-002',
      circle_name: 'Neon Dreams',
      representative_name: 'Alex Chen',
      booth_number: 'B-42',
      booth_type: 'booth',
      booth_size: 'booth_a',
      category: 'Fan Art',
      genre: ['Digital Art', 'Prints'],
      fandom: ['Cyberpunk 2077', 'Ghost in the Shell', 'Akira'],
      description: 'Cyberpunk and sci-fi themed artwork with neon aesthetics and futuristic designs.',
      sample_works: ['/samples/neon-1.jpg', '/samples/neon-2.jpg', '/samples/neon-3.jpg'],
      social_media: {
        twitter: '@neondreams_art',
        instagram: '@neon_dreams_official',
        email: 'contact@neondreams.art'
      },
      rating: 4.6,
      favorites: 890,
      views: 5200,
      comments: 32,
      featured: false,
      new_circle: true,
      opening_hours: '09:00 - 19:00',
      collaboration: true,
      international: true,
      accessibility_friendly: true,
      payment_methods: ['Cash', 'Card'],
      languages: ['English', 'Chinese'],
      preview_image: '/previews/neon-preview.jpg',
      status: 'confirmed'
    },
    {
      id: 'circle-003',
      circle_name: 'Kawaii Crafts',
      representative_name: 'Miku Sato',
      booth_number: 'C-08',
      booth_type: 'space',
      booth_size: '1_space',
      category: 'Crafts',
      genre: ['Accessories', 'Plushies', 'Keychains'],
      fandom: ['Vocaloid', 'Sanrio', 'Pokemon'],
      description: 'Handmade kawaii accessories, plushies, and collectibles featuring popular characters.',
      sample_works: ['/samples/kawaii-1.jpg', '/samples/kawaii-2.jpg'],
      social_media: {
        instagram: '@kawaii_crafts_jp',
        twitter: '@kawaiicrafts'
      },
      rating: 4.9,
      favorites: 2100,
      views: 12000,
      comments: 78,
      featured: true,
      new_circle: false,
      opening_hours: '10:00 - 17:00',
      special_events: ['Plushie Making Workshop at 15:00'],
      collaboration: false,
      international: false,
      accessibility_friendly: false,
      payment_methods: ['Cash'],
      languages: ['Japanese'],
      preview_image: '/previews/kawaii-preview.jpg',
      status: 'confirmed'
    },
    {
      id: 'circle-004',
      circle_name: 'Retro Gaming Art',
      representative_name: 'David Kim',
      booth_number: 'D-23',
      booth_type: 'booth',
      booth_size: 'booth_b',
      category: 'Fan Art',
      genre: ['Pixel Art', 'Posters', 'Stickers'],
      fandom: ['Nintendo', 'Sega', 'Arcade Games'],
      description: 'Nostalgic pixel art and retro gaming inspired artwork celebrating classic video games.',
      sample_works: ['/samples/retro-1.jpg', '/samples/retro-2.jpg'],
      social_media: {
        website: 'https://retrogamingart.com',
        twitter: '@retrogamingart',
        email: 'info@retrogamingart.com'
      },
      rating: 4.7,
      favorites: 1580,
      views: 9800,
      comments: 56,
      featured: false,
      new_circle: false,
      opening_hours: '09:30 - 18:30',
      collaboration: false,
      international: true,
      accessibility_friendly: true,
      payment_methods: ['Cash', 'Card', 'Digital'],
      languages: ['English', 'Korean'],
      preview_image: '/previews/retro-preview.jpg',
      status: 'confirmed'
    }
  ])

  const categories = ['all', 'Original', 'Fan Art', 'Crafts', 'Music', 'Games', 'Literature']
  const genres = ['all', 'Illustration', 'Manga', 'Digital Art', 'Prints', 'Accessories', 'Plushies', 'Keychains', 'Pixel Art', 'Posters', 'Stickers']
  const fandoms = ['all', 'Original Work', 'Cyberpunk 2077', 'Ghost in the Shell', 'Akira', 'Vocaloid', 'Sanrio', 'Pokemon', 'Nintendo', 'Sega', 'Arcade Games']
  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'rating', label: 'Rating' },
    { value: 'favorites', label: 'Favorites' },
    { value: 'views', label: 'Views' },
    { value: 'booth_number', label: 'Booth Number' }
  ]

  // Filter and sort circles
  const filteredCircles = circles
    .filter(circle => {
      const matchesSearch = 
        circle.circle_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        circle.representative_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        circle.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        circle.genre.some(g => g.toLowerCase().includes(searchQuery.toLowerCase())) ||
        circle.fandom.some(f => f.toLowerCase().includes(searchQuery.toLowerCase())) ||
        circle.booth_number?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesCategory = selectedCategory === 'all' || circle.category === selectedCategory
      const matchesGenre = selectedGenre === 'all' || circle.genre.includes(selectedGenre)
      const matchesFandom = selectedFandom === 'all' || circle.fandom.includes(selectedFandom)
      
      return matchesSearch && matchesCategory && matchesGenre && matchesFandom
    })
    .sort((a, b) => {
      let aValue: any = a[sortBy as keyof CircleProfile]
      let bValue: any = b[sortBy as keyof CircleProfile]
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

  const toggleFavorite = (circleId: string) => {
    setFavoriteCircles(prev => {
      const newFavorites = new Set(prev)
      if (newFavorites.has(circleId)) {
        newFavorites.delete(circleId)
      } else {
        newFavorites.add(circleId)
      }
      return newFavorites
    })
  }

  const toggleBookmark = (circleId: string) => {
    setBookmarkedCircles(prev => {
      const newBookmarks = new Set(prev)
      if (newBookmarks.has(circleId)) {
        newBookmarks.delete(circleId)
      } else {
        newBookmarks.add(circleId)
      }
      return newBookmarks
    })
  }

  const shareCircle = (circle: CircleProfile) => {
    if (navigator.share) {
      navigator.share({
        title: circle.circle_name,
        text: circle.description,
        url: `${window.location.origin}/circles/${circle.id}`
      })
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${window.location.origin}/circles/${circle.id}`)
      alert('Link copied to clipboard!')
    }
  }

  const getBoothTypeDisplay = (type: string, size: string) => {
    if (type === 'space') {
      return `Circle Space (${size.replace('_', ' ').toUpperCase()})`
    } else {
      return `Circle Booth (${size.replace('_', ' ').toUpperCase()})`
    }
  }

  const CircleCard: React.FC<{ circle: CircleProfile; compact?: boolean }> = ({ circle, compact = false }) => {
    const isFavorite = favoriteCircles.has(circle.id)
    const isBookmarked = bookmarkedCircles.has(circle.id)

    return (
      <Card className={`cursor-pointer transition-all hover:shadow-lg ${compact ? 'h-auto' : 'h-full'}`}>
        <CardHeader className={compact ? 'pb-2' : 'pb-4'}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <CardTitle className={`${compact ? 'text-base' : 'text-lg'}`}>{circle.circle_name}</CardTitle>
                {circle.featured && (
                  <Badge className="bg-yellow-500">
                    <Star className="h-3 w-3 mr-1" />
                    Featured
                  </Badge>
                )}
                {circle.new_circle && (
                  <Badge variant="secondary">New</Badge>
                )}
              </div>
              <CardDescription className={compact ? 'text-xs' : 'text-sm'}>
                by {circle.representative_name}
              </CardDescription>
              {circle.booth_number && (
                <div className="flex items-center space-x-1 mt-1">
                  <MapPin className="h-3 w-3 text-gray-500" />
                  <span className="text-xs text-gray-600">{circle.booth_number}</span>
                </div>
              )}
            </div>
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFavorite(circle.id)
                }}
                className={isFavorite ? 'text-red-600' : 'text-gray-400'}
              >
                <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleBookmark(circle.id)
                }}
                className={isBookmarked ? 'text-blue-600' : 'text-gray-400'}
              >
                <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className={compact ? 'pt-0' : ''}>
          {/* Preview Image */}
          {!compact && circle.preview_image && (
            <div className="w-full h-32 bg-gray-200 rounded mb-3 overflow-hidden">
              <img 
                src={circle.preview_image} 
                alt={`${circle.circle_name} preview`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDIwMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04NyA0OEw5MyA1NEw5OSA0OEwxMDUgNTRMMTExIDQ4TDExNyA1NEwxMjMgNDhMMTI5IDU0TDEzNSA0OEwxNDEgNTRMMTQ3IDQ4TDE1MyA1NEwxNTkgNDhMMTY1IDU0TDE3MSA0OEwxNzcgNTQiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iNzAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM2QjcyODAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiI+Tm8gUHJldmlldyBBdmFpbGFibGU8L3RleHQ+Cjwvc3ZnPgo='
                }}
              />
            </div>
          )}
          
          {/* Description */}
          <p className={`text-gray-600 mb-3 ${compact ? 'text-xs line-clamp-2' : 'text-sm line-clamp-3'}`}>
            {circle.description}
          </p>
          
          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-3">
            <Badge variant="outline" className="text-xs">{circle.category}</Badge>
            {circle.genre.slice(0, compact ? 1 : 2).map((genre) => (
              <Badge key={genre} variant="secondary" className="text-xs">{genre}</Badge>
            ))}
            {circle.genre.length > (compact ? 1 : 2) && (
              <Badge variant="secondary" className="text-xs">+{circle.genre.length - (compact ? 1 : 2)}</Badge>
            )}
          </div>
          
          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <Star className="h-3 w-3 text-yellow-500" />
                <span>{circle.rating}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Heart className="h-3 w-3" />
                <span>{circle.favorites}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Eye className="h-3 w-3" />
                <span>{circle.views}</span>
              </div>
            </div>
            {circle.opening_hours && (
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{circle.opening_hours}</span>
              </div>
            )}
          </div>
          
          {/* Features */}
          {!compact && (
            <div className="flex flex-wrap gap-1 mb-3">
              {circle.international && (
                <Badge variant="outline" className="text-xs">International</Badge>
              )}
              {circle.collaboration && (
                <Badge variant="outline" className="text-xs">Collaboration</Badge>
              )}
              {circle.accessibility_friendly && (
                <Badge variant="outline" className="text-xs">Accessible</Badge>
              )}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex space-x-2">
            <Button 
              size="sm" 
              className="flex-1"
              onClick={() => setSelectedCircle(circle)}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View Details
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                shareCircle(circle)
              }}
            >
              <Share2 className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Circle Catalog</h1>
        <p className="text-gray-600">Discover amazing circles and artists at the convention</p>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search circles, artists, genres, or fandoms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex flex-wrap gap-2 flex-1">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedGenre} onValueChange={setSelectedGenre}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Genre" />
              </SelectTrigger>
              <SelectContent>
                {genres.map((genre) => (
                  <SelectItem key={genre} value={genre}>
                    {genre === 'all' ? 'All Genres' : genre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedFandom} onValueChange={setSelectedFandom}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Fandom" />
              </SelectTrigger>
              <SelectContent>
                {fandoms.map((fandom) => (
                  <SelectItem key={fandom} value={fandom}>
                    {fandom === 'all' ? 'All Fandoms' : fandom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-1"
            >
              <Filter className="h-4 w-4" />
              <span>More Filters</span>
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Sort Controls */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            </Button>

            {/* View Mode Toggle */}
            <div className="flex border rounded">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Advanced Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Features</label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Featured Circles</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">New Circles</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">International</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Collaboration Friendly</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Accessibility</label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Wheelchair Accessible</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Multiple Languages</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Payment Methods</label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Cash</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Card</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Digital Payment</span>
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-gray-600">
          Showing {filteredCircles.length} of {circles.length} circles
        </p>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Heart className="h-4 w-4 mr-1" />
            My Favorites ({favoriteCircles.size})
          </Button>
          <Button variant="outline" size="sm">
            <Bookmark className="h-4 w-4 mr-1" />
            Bookmarks ({bookmarkedCircles.size})
          </Button>
        </div>
      </div>

      {/* Circle Grid/List */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
        {filteredCircles.map((circle) => (
          <CircleCard 
            key={circle.id} 
            circle={circle} 
            compact={viewMode === 'list'}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredCircles.length === 0 && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No circles found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search criteria or filters</p>
          <Button 
            onClick={() => {
              setSearchQuery('')
              setSelectedCategory('all')
              setSelectedGenre('all')
              setSelectedFandom('all')
            }}
          >
            Clear All Filters
          </Button>
        </div>
      )}

      {/* Circle Detail Modal */}
      {selectedCircle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{selectedCircle.circle_name}</CardTitle>
                  <CardDescription>by {selectedCircle.representative_name}</CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedCircle(null)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Booth Info */}
              <div className="flex items-center space-x-4">
                <Badge className="bg-blue-600">
                  <MapPin className="h-3 w-3 mr-1" />
                  {selectedCircle.booth_number}
                </Badge>
                <Badge variant="outline">
                  {getBoothTypeDisplay(selectedCircle.booth_type, selectedCircle.booth_size)}
                </Badge>
              </div>

              {/* Description */}
              <p className="text-gray-700">{selectedCircle.description}</p>

              {/* Categories and Tags */}
              <div>
                <h4 className="font-medium mb-2">Categories & Genres</h4>
                <div className="flex flex-wrap gap-1">
                  <Badge>{selectedCircle.category}</Badge>
                  {selectedCircle.genre.map((genre) => (
                    <Badge key={genre} variant="secondary">{genre}</Badge>
                  ))}
                </div>
              </div>

              {/* Fandoms */}
              {selectedCircle.fandom.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Fandoms</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedCircle.fandom.map((fandom) => (
                      <Badge key={fandom} variant="outline">{fandom}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Social Media */}
              {Object.keys(selectedCircle.social_media).length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Connect</h4>
                  <div className="flex space-x-2">
                    {selectedCircle.social_media.website && (
                      <Button size="sm" variant="outline">
                        <Globe className="h-4 w-4 mr-1" />
                        Website
                      </Button>
                    )}
                    {selectedCircle.social_media.twitter && (
                      <Button size="sm" variant="outline">
                        <Twitter className="h-4 w-4 mr-1" />
                        Twitter
                      </Button>
                    )}
                    {selectedCircle.social_media.instagram && (
                      <Button size="sm" variant="outline">
                        <Instagram className="h-4 w-4 mr-1" />
                        Instagram
                      </Button>
                    )}
                    {selectedCircle.social_media.email && (
                      <Button size="sm" variant="outline">
                        <Mail className="h-4 w-4 mr-1" />
                        Email
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Special Events */}
              {selectedCircle.special_events && selectedCircle.special_events.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Special Events</h4>
                  <ul className="space-y-1">
                    {selectedCircle.special_events.map((event, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">{event}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2 pt-4">
                <Button className="flex-1">
                  <MapPin className="h-4 w-4 mr-1" />
                  Find on Map
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => toggleFavorite(selectedCircle.id)}
                  className={favoriteCircles.has(selectedCircle.id) ? 'text-red-600' : ''}
                >
                  <Heart className={`h-4 w-4 ${favoriteCircles.has(selectedCircle.id) ? 'fill-current' : ''}`} />
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => shareCircle(selectedCircle)}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default CircleCatalog