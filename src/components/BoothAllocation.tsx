import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { toast } from '../hooks/use-toast'
import {
  Search,
  Download,
  Upload,
  RotateCcw,
  Settings,
  Grid,
  Zap,
  Save,
  CheckCircle,
  Users,
  Clock,
  AlertTriangle,
  MapPin
} from 'lucide-react'



interface Booth {
  id: string
  code: string
  type: 'circle_space' | 'circle_booth'
  variant?: '1_space' | '2_space' | '4_space' | 'booth_a' | 'booth_b'
  position: [number, number]
  size: [number, number]
  status: 'available' | 'assigned' | 'reserved' | 'blocked'
  assignedCircle?: {
    id: string
    name: string
    genre: string
    fandom: string
  }
  price: number
  currency: 'IDR' | 'USD'
  accessibility: boolean
  powerOutlet: boolean
  corner: boolean
}

interface FloorPlan {
  id: string
  name: string
  dimensions: [number, number]
  scale: number
  booths: Booth[]
}

const BOOTH_COLORS = {
  available: '#10b981', // green
  assigned: '#3b82f6',  // blue
  reserved: '#f59e0b',  // amber
  blocked: '#ef4444'    // red
}

const GENRE_COLORS = {
  'Original': '#8b5cf6',
  'Anime/Manga': '#06b6d4',
  'Games': '#10b981',
  'Music': '#f59e0b',
  'Literature': '#ef4444',
  'Art': '#ec4899',
  'Cosplay': '#84cc16',
  'Other': '#6b7280'
}



export default function BoothAllocation() {
  const [, setFloorPlans] = useState<FloorPlan[]>([])
  const [currentPlan, setCurrentPlan] = useState<FloorPlan | null>(null)
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null)
  const [isCreatingBooth, setIsCreatingBooth] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterGenre, setFilterGenre] = useState<string>('all')




  // Initialize with sample data
  useEffect(() => {
    const samplePlan: FloorPlan = {
      id: 'main-hall',
      name: 'Main Exhibition Hall',
      dimensions: [1000, 800],
      scale: 1,
      booths: [
        {
          id: 'booth-001',
          code: 'A-01',
          type: 'circle_space',
          variant: '1_space',
          position: [51.505, -0.09],
          size: [20, 20],
          status: 'available',
          price: 150000,
          currency: 'IDR',
          accessibility: false,
          powerOutlet: true,
          corner: false
        },
        {
          id: 'booth-002',
          code: 'A-02',
          type: 'circle_space',
          variant: '2_space',
          position: [51.506, -0.09],
          size: [40, 20],
          status: 'assigned',
          assignedCircle: {
            id: 'circle-001',
            name: 'Sakura Studio',
            genre: 'Original',
            fandom: 'Original Works'
          },
          price: 250000,
          currency: 'IDR',
          accessibility: false,
          powerOutlet: true,
          corner: false
        },
        {
          id: 'booth-003',
          code: 'B-01',
          type: 'circle_booth',
          variant: 'booth_a',
          position: [51.507, -0.09],
          size: [30, 30],
          status: 'reserved',
          price: 75,
          currency: 'USD',
          accessibility: true,
          powerOutlet: true,
          corner: true
        }
      ]
    }
    
    setFloorPlans([samplePlan])
    setCurrentPlan(samplePlan)
  }, [])



  const handleBoothAssignment = (boothId: string, circleId?: string) => {
    if (!currentPlan) return
    
    const updatedBooths = currentPlan.booths.map(booth => {
      if (booth.id === boothId) {
        return {
          ...booth,
          status: circleId ? 'assigned' as const : 'available' as const,
          assignedCircle: circleId ? {
            id: circleId,
            name: 'Sample Circle',
            genre: 'Original',
            fandom: 'Original Works'
          } : undefined
        }
      }
      return booth
    })
    
    const updatedPlan = { ...currentPlan, booths: updatedBooths }
    setCurrentPlan(updatedPlan)
    setFloorPlans(plans => plans.map(p => p.id === currentPlan.id ? updatedPlan : p))
    
    toast({
      title: circleId ? "Booth Assigned" : "Booth Unassigned",
      description: `Booth has been ${circleId ? 'assigned to circle' : 'made available'}.`
    })
  }

  const autoGroupBooths = () => {
    if (!currentPlan) return
    
    // Simple auto-grouping by genre
    const genreGroups: { [key: string]: Booth[] } = {}
    
    currentPlan.booths.forEach(booth => {
      if (booth.assignedCircle) {
        const genre = booth.assignedCircle.genre
        if (!genreGroups[genre]) genreGroups[genre] = []
        genreGroups[genre].push(booth)
      }
    })
    
    toast({
      title: "Auto-grouping Complete",
      description: `Booths have been grouped by genre: ${Object.keys(genreGroups).join(', ')}`
    })
  }

  const filteredBooths = currentPlan?.booths.filter(booth => {
    const matchesSearch = booth.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booth.assignedCircle?.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || booth.status === filterStatus
    const matchesGenre = filterGenre === 'all' || booth.assignedCircle?.genre === filterGenre
    
    return matchesSearch && matchesStatus && matchesGenre
  }) || []

  const stats = {
    total: currentPlan?.booths.length || 0,
    available: currentPlan?.booths.filter(b => b.status === 'available').length || 0,
    assigned: currentPlan?.booths.filter(b => b.status === 'assigned').length || 0,
    reserved: currentPlan?.booths.filter(b => b.status === 'reserved').length || 0,
    blocked: currentPlan?.booths.filter(b => b.status === 'blocked').length || 0
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Booth Allocation</h1>
            <p className="text-muted-foreground">
              Interactive floor plan designer and booth management system
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={isCreatingBooth ? "default" : "outline"}
              onClick={() => setIsCreatingBooth(!isCreatingBooth)}
            >
              <Grid className="h-4 w-4 mr-2" />
              {isCreatingBooth ? 'Cancel' : 'Add Booth'}
            </Button>
            <Button variant="outline" onClick={autoGroupBooths}>
              <Zap className="h-4 w-4 mr-2" />
              Auto Group
            </Button>
            <Button variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save Layout
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Booths</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Grid className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Available</p>
                  <p className="text-2xl font-bold text-green-600">{stats.available}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Assigned</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.assigned}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reserved</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.reserved}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Blocked</p>
                  <p className="text-2xl font-bold text-red-600">{stats.blocked}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Floor Plan */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {currentPlan?.name || 'Floor Plan'}
                </CardTitle>
                <CardDescription>
                  {isCreatingBooth ? 'Click on the map to place a new booth' : 'Interactive floor plan with booth assignments'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[600px] w-full border rounded-lg overflow-hidden">
                  <div className="relative bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-lg font-medium">Interactive Floor Plan</p>
                        <p className="text-sm">Booth visualization and management</p>
                      </div>
                    </div>
                    
                    {/* Booth visualization overlay */}
                    <div className="relative h-full min-h-[400px] p-8">
                      {filteredBooths.map((booth, index) => {
                        const x = (index % 8) * 80 + 40;
                        const y = Math.floor(index / 8) * 60 + 40;
                        
                        return (
                          <div
                            key={booth.id}
                            className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-110"
                            style={{
                              left: `${x}px`,
                              top: `${y}px`,
                              backgroundColor: booth.assignedCircle ? 
                                GENRE_COLORS[booth.assignedCircle.genre as keyof typeof GENRE_COLORS] || GENRE_COLORS.Other :
                                BOOTH_COLORS[booth.status],
                              width: booth.variant?.includes('2_space') ? '60px' : booth.variant?.includes('4_space') ? '80px' : '40px',
                              height: '40px'
                            }}
                            onClick={() => setSelectedBooth(booth)}
                            title={`${booth.code} - ${booth.status}`}
                          >
                            <div className="w-full h-full border-2 border-white rounded flex items-center justify-center text-white text-xs font-bold shadow-lg">
                              {booth.code}
                            </div>
                            
                            {/* Status indicator */}
                            <div 
                              className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
                              style={{ backgroundColor: BOOTH_COLORS[booth.status] }}
                            />
                            
                            {/* Feature indicators */}
                            <div className="absolute -bottom-1 left-0 flex gap-1">
                              {booth.powerOutlet && (
                                <div className="w-2 h-2 bg-yellow-400 rounded-full border border-white" title="Power Outlet" />
                              )}
                              {booth.accessibility && (
                                <div className="w-2 h-2 bg-blue-400 rounded-full border border-white" title="Accessible" />
                              )}
                              {booth.corner && (
                                <div className="w-2 h-2 bg-purple-400 rounded-full border border-white" title="Corner" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Grid lines */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                        <defs>
                          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#666" strokeWidth="1"/>
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                      </svg>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Search and Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Search & Filter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="search">Search Booths</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Booth code or circle name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="genre-filter">Genre</Label>
                  <Select value={filterGenre} onValueChange={setFilterGenre}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genres</SelectItem>
                      {Object.keys(GENRE_COLORS).map(genre => (
                        <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Booth List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Booth List</CardTitle>
                <CardDescription>
                  {filteredBooths.length} of {stats.total} booths
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {filteredBooths.map((booth) => (
                      <div
                        key={booth.id}
                        className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedBooth(booth)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{booth.code}</p>
                            <p className="text-sm text-muted-foreground">
                              {booth.type.replace('_', ' ')}
                            </p>
                          </div>
                          <Badge 
                            variant={booth.status === 'available' ? 'default' : 'secondary'}
                            style={{
                              backgroundColor: booth.status === 'available' ? undefined : BOOTH_COLORS[booth.status],
                              color: booth.status === 'available' ? undefined : 'white'
                            }}
                          >
                            {booth.status}
                          </Badge>
                        </div>
                        {booth.assignedCircle && (
                          <div className="mt-2">
                            <p className="text-sm font-medium">{booth.assignedCircle.name}</p>
                            <p className="text-xs text-muted-foreground">{booth.assignedCircle.genre}</p>
                          </div>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {booth.currency} {booth.price.toLocaleString()}
                          </span>
                          <div className="flex items-center gap-1">
                            {booth.accessibility && <span className="text-xs">♿</span>}
                            {booth.powerOutlet && <span className="text-xs">⚡</span>}
                            {booth.corner && <span className="text-xs">📐</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export Layout
                </Button>
                <Button className="w-full" variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Layout
                </Button>
                <Button className="w-full" variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Layout
                </Button>
                <Button className="w-full" variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Layout Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Booth Details Dialog */}
        {selectedBooth && (
          <Dialog open={!!selectedBooth} onOpenChange={() => setSelectedBooth(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Booth {selectedBooth.code}</DialogTitle>
                <DialogDescription>
                  {selectedBooth.type.replace('_', ' ').toUpperCase()} - {selectedBooth.variant?.replace('_', ' ')}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <Badge 
                      className="mt-1"
                      style={{
                        backgroundColor: BOOTH_COLORS[selectedBooth.status],
                        color: 'white'
                      }}
                    >
                      {selectedBooth.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Price</Label>
                    <p className="text-lg font-semibold">
                      {selectedBooth.currency} {selectedBooth.price.toLocaleString()}
                    </p>
                  </div>
                </div>
                
                {selectedBooth.assignedCircle && (
                  <div>
                    <Label className="text-sm font-medium">Assigned Circle</Label>
                    <div className="mt-2 p-3 border rounded-lg">
                      <p className="font-medium">{selectedBooth.assignedCircle.name}</p>
                      <p className="text-sm text-muted-foreground">{selectedBooth.assignedCircle.genre}</p>
                      <p className="text-sm text-muted-foreground">{selectedBooth.assignedCircle.fandom}</p>
                    </div>
                  </div>
                )}
                
                <div>
                  <Label className="text-sm font-medium">Features</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedBooth.accessibility && (
                      <Badge variant="outline">Wheelchair Accessible</Badge>
                    )}
                    {selectedBooth.powerOutlet && (
                      <Badge variant="outline">Power Outlet</Badge>
                    )}
                    {selectedBooth.corner && (
                      <Badge variant="outline">Corner Booth</Badge>
                    )}
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex gap-2">
                  {selectedBooth.status === 'available' ? (
                    <Button 
                      onClick={() => handleBoothAssignment(selectedBooth.id)}
                      className="flex-1"
                    >
                      Assign Circle
                    </Button>
                  ) : (
                    <Button 
                      variant="outline"
                      onClick={() => handleBoothAssignment(selectedBooth.id)}
                      className="flex-1"
                    >
                      Unassign
                    </Button>
                  )}
                  <Button variant="outline">
                    Edit Booth
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}