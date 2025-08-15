import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Switch } from './ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { ScrollArea } from './ui/scroll-area'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import {
  Megaphone,
  Plus,
  Search,
  Eye,
  Heart,
  Share2,
  Edit,
  Pin,
  PinOff,
  Star,
  Image,
  FileText,
  Link,
  Download,
  BarChart3,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Settings,
  XCircle,
  RefreshCw,
  Info,
  MapPin,
  Send,
  Trash2
} from 'lucide-react'

interface Announcement {
  id: string
  title: string
  content: string
  summary?: string
  type: 'general' | 'urgent' | 'event' | 'system' | 'emergency' | 'update' | 'promotion'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'draft' | 'scheduled' | 'published' | 'archived'
  visibility: 'public' | 'attendees' | 'circles' | 'staff' | 'vip'
  author: {
    id: string
    name: string
    role: string
    avatar?: string
  }
  created_at: string
  updated_at: string
  published_at?: string
  scheduled_at?: string
  expires_at?: string
  pinned: boolean
  featured: boolean
  tags: string[]
  categories: string[]
  target_audience: string[]
  location?: string
  event_id?: string
  attachments: {
    id: string
    name: string
    type: 'image' | 'document' | 'link'
    url: string
    size?: number
  }[]
  metrics: {
    views: number
    likes: number
    shares: number
    comments: number
    click_through_rate: number
  }
  push_notification: {
    enabled: boolean
    title?: string
    message?: string
    sound: boolean
    vibration: boolean
  }
  social_media: {
    twitter: boolean
    facebook: boolean
    instagram: boolean
    discord: boolean
  }
}

interface AnnouncementTemplate {
  id: string
  name: string
  description: string
  type: string
  content: string
  variables: string[]
  category: string
}

const AnnouncementSystem: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState('announcements')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)

  
  // Mock announcements data
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      id: 'ann-1',
      title: 'Welcome to Comic Frontier 2024!',
      content: 'We\'re excited to welcome you to Comic Frontier 2024! This year\'s event features over 500 circles, special guests, workshops, and amazing activities. Please check the event schedule and explore the interactive map to make the most of your visit.',
      summary: 'Welcome message for Comic Frontier 2024 attendees',
      type: 'general',
      priority: 'medium',
      status: 'published',
      visibility: 'public',
      author: {
        id: 'admin-1',
        name: 'Event Organizer',
        role: 'Administrator',
        avatar: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20event%20organizer%20avatar&image_size=square'
      },
      created_at: '2025-01-15T08:00:00Z',
      updated_at: '2024-01-15T08:00:00Z',
      published_at: '2024-01-15T08:00:00Z',
      pinned: true,
      featured: true,
      tags: ['welcome', 'event', 'general'],
      categories: ['General'],
      target_audience: ['attendees', 'circles'],
      attachments: [
        {
          id: 'att-1',
          name: 'Event Map',
          type: 'image',
          url: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=convention%20floor%20map%20layout&image_size=landscape_16_9',
          size: 2048000
        }
      ],
      metrics: {
        views: 1250,
        likes: 89,
        shares: 23,
        comments: 15,
        click_through_rate: 0.12
      },
      push_notification: {
        enabled: true,
        title: 'Welcome to Comic Frontier!',
        message: 'Check out the event guide and start exploring!',
        sound: true,
        vibration: false
      },
      social_media: {
        twitter: true,
        facebook: true,
        instagram: true,
        discord: true
      }
    },
    {
      id: 'ann-2',
      title: 'Queue Alert: Main Entrance Congestion',
      content: 'Due to high attendance, the main entrance is experiencing longer wait times. We recommend using the East or West entrances for faster entry. Security staff are available to assist with directions.',
      summary: 'Alternative entrance recommendations due to congestion',
      type: 'urgent',
      priority: 'high',
      status: 'published',
      visibility: 'public',
      author: {
        id: 'staff-1',
        name: 'Security Team',
        role: 'Staff',
        avatar: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=security%20staff%20avatar&image_size=square'
      },
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z',
      published_at: '2024-01-15T10:30:00Z',
      expires_at: '2024-01-15T14:00:00Z',
      pinned: false,
      featured: false,
      tags: ['queue', 'entrance', 'urgent'],
      categories: ['Operations'],
      target_audience: ['attendees'],
      location: 'Main Entrance',
      attachments: [],
      metrics: {
        views: 890,
        likes: 12,
        shares: 45,
        comments: 8,
        click_through_rate: 0.18
      },
      push_notification: {
        enabled: true,
        title: 'Queue Alert',
        message: 'Use East/West entrances for faster entry',
        sound: true,
        vibration: true
      },
      social_media: {
        twitter: true,
        facebook: false,
        instagram: false,
        discord: true
      }
    },
    {
      id: 'ann-3',
      title: 'Special Guest: Yuki Tanaka Live Drawing Session',
      content: 'Join us for an exclusive live drawing session with renowned manga artist Yuki Tanaka at 2:00 PM in the Main Stage area. Limited seating available - first come, first served!',
      summary: 'Live drawing session with special guest artist',
      type: 'event',
      priority: 'medium',
      status: 'published',
      visibility: 'public',
      author: {
        id: 'event-1',
        name: 'Event Coordinator',
        role: 'Staff',
        avatar: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=event%20coordinator%20avatar&image_size=square'
      },
      created_at: '2025-01-15T09:00:00Z',
      updated_at: '2024-01-15T09:00:00Z',
      published_at: '2024-01-15T09:00:00Z',
      scheduled_at: '2024-01-15T14:00:00Z',
      pinned: false,
      featured: true,
      tags: ['guest', 'drawing', 'event', 'artist'],
      categories: ['Events'],
      target_audience: ['attendees'],
      location: 'Main Stage',
      event_id: 'event-drawing-session',
      attachments: [
        {
          id: 'att-2',
          name: 'Artist Portfolio',
          type: 'link',
          url: 'https://example.com/yuki-tanaka-portfolio'
        }
      ],
      metrics: {
        views: 567,
        likes: 78,
        shares: 34,
        comments: 22,
        click_through_rate: 0.15
      },
      push_notification: {
        enabled: true,
        title: 'Special Guest Event',
        message: 'Yuki Tanaka live drawing at 2 PM!',
        sound: true,
        vibration: false
      },
      social_media: {
        twitter: true,
        facebook: true,
        instagram: true,
        discord: true
      }
    },
    {
      id: 'ann-4',
      title: 'System Maintenance Notice',
      content: 'The payment system will undergo scheduled maintenance from 11:00 AM to 11:15 AM. During this time, card payments may be temporarily unavailable. Cash payments will still be accepted.',
      summary: 'Scheduled payment system maintenance',
      type: 'system',
      priority: 'medium',
      status: 'scheduled',
      visibility: 'public',
      author: {
        id: 'tech-1',
        name: 'Technical Team',
        role: 'Administrator',
        avatar: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=technical%20support%20avatar&image_size=square'
      },
      created_at: '2025-01-15T08:30:00Z',
      updated_at: '2024-01-15T08:30:00Z',
      scheduled_at: '2024-01-15T10:45:00Z',
      pinned: false,
      featured: false,
      tags: ['maintenance', 'payment', 'system'],
      categories: ['Technical'],
      target_audience: ['attendees', 'circles'],
      attachments: [],
      metrics: {
        views: 0,
        likes: 0,
        shares: 0,
        comments: 0,
        click_through_rate: 0
      },
      push_notification: {
        enabled: true,
        title: 'System Maintenance',
        message: 'Payment system maintenance 11:00-11:15 AM',
        sound: false,
        vibration: false
      },
      social_media: {
        twitter: false,
        facebook: false,
        instagram: false,
        discord: true
      }
    },
    {
      id: 'ann-5',
      title: 'Lost & Found Update',
      content: 'Several items have been turned in to the Lost & Found booth near the information desk. If you\'re missing any personal belongings, please visit us with a description of your item.',
      summary: 'Lost & Found items available for collection',
      type: 'general',
      priority: 'low',
      status: 'published',
      visibility: 'public',
      author: {
        id: 'info-1',
        name: 'Information Desk',
        role: 'Staff',
        avatar: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=information%20desk%20staff%20avatar&image_size=square'
      },
      created_at: '2024-01-15T11:00:00Z',
      updated_at: '2024-01-15T11:00:00Z',
      published_at: '2024-01-15T11:00:00Z',
      pinned: false,
      featured: false,
      tags: ['lost-found', 'information'],
      categories: ['Services'],
      target_audience: ['attendees'],
      location: 'Information Desk',
      attachments: [],
      metrics: {
        views: 234,
        likes: 5,
        shares: 2,
        comments: 1,
        click_through_rate: 0.08
      },
      push_notification: {
        enabled: false,
        sound: false,
        vibration: false
      },
      social_media: {
        twitter: false,
        facebook: false,
        instagram: false,
        discord: false
      }
    }
  ])

  // Mock templates data
  const templates: AnnouncementTemplate[] = [
    {
      id: 'template-1',
      name: 'Queue Alert',
      description: 'Standard template for queue-related announcements',
      type: 'urgent',
      content: 'Queue Alert: {{location}}\n\n{{message}}\n\nRecommended alternatives: {{alternatives}}',
      variables: ['location', 'message', 'alternatives'],
      category: 'Operations'
    },
    {
      id: 'template-2',
      name: 'Event Announcement',
      description: 'Template for special events and activities',
      type: 'event',
      content: 'Special Event: {{event_name}}\n\nJoin us for {{description}} at {{time}} in {{location}}.\n\n{{additional_info}}',
      variables: ['event_name', 'description', 'time', 'location', 'additional_info'],
      category: 'Events'
    },
    {
      id: 'template-3',
      name: 'System Maintenance',
      description: 'Template for system maintenance notifications',
      type: 'system',
      content: 'System Maintenance Notice\n\n{{system_name}} will undergo maintenance from {{start_time}} to {{end_time}}.\n\n{{impact_description}}',
      variables: ['system_name', 'start_time', 'end_time', 'impact_description'],
      category: 'Technical'
    }
  ]

  const [newAnnouncement, setNewAnnouncement] = useState<Partial<Announcement>>({
    title: '',
    content: '',
    type: 'general',
    priority: 'medium',
    visibility: 'public',
    pinned: false,
    featured: false,
    tags: [],
    categories: [],
    target_audience: ['attendees'],
    push_notification: {
      enabled: false,
      sound: false,
      vibration: false
    },
    social_media: {
      twitter: false,
      facebook: false,
      instagram: false,
      discord: false
    }
  })

  const announcementFilters = [
    { value: 'all', label: 'All', icon: Megaphone },
    { value: 'published', label: 'Published', icon: CheckCircle },
    { value: 'draft', label: 'Drafts', icon: Edit },
    { value: 'scheduled', label: 'Scheduled', icon: Clock },
    { value: 'urgent', label: 'Urgent', icon: AlertCircle },
    { value: 'pinned', label: 'Pinned', icon: Pin },
    { value: 'featured', label: 'Featured', icon: Star }
  ]

  const getFilteredAnnouncements = () => {
    let filtered = announcements
    
    // Apply status/type filters
    if (selectedFilter === 'published') {
      filtered = filtered.filter(a => a.status === 'published')
    } else if (selectedFilter === 'draft') {
      filtered = filtered.filter(a => a.status === 'draft')
    } else if (selectedFilter === 'scheduled') {
      filtered = filtered.filter(a => a.status === 'scheduled')
    } else if (selectedFilter === 'urgent') {
      filtered = filtered.filter(a => a.type === 'urgent' || a.priority === 'urgent')
    } else if (selectedFilter === 'pinned') {
      filtered = filtered.filter(a => a.pinned)
    } else if (selectedFilter === 'featured') {
      filtered = filtered.filter(a => a.featured)
    }
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(a => 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }
    
    return filtered.sort((a, b) => {
      // Sort by pinned first, then by date
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }

  const getAnnouncementIcon = (type: string) => {
    switch (type) {
      case 'urgent': return <AlertCircle className="h-5 w-5 text-red-600" />
      case 'event': return <Calendar className="h-5 w-5 text-blue-600" />
      case 'system': return <Settings className="h-5 w-5 text-gray-600" />
      case 'emergency': return <XCircle className="h-5 w-5 text-red-700" />
      case 'update': return <RefreshCw className="h-5 w-5 text-green-600" />
      case 'promotion': return <Star className="h-5 w-5 text-yellow-600" />
      default: return <Info className="h-5 w-5 text-blue-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800 border-green-200'
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'archived': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now.getTime() - time.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  const togglePin = (announcementId: string) => {
    setAnnouncements(prev => 
      prev.map(a => a.id === announcementId ? { ...a, pinned: !a.pinned } : a)
    )
  }

  const toggleFeatured = (announcementId: string) => {
    setAnnouncements(prev => 
      prev.map(a => a.id === announcementId ? { ...a, featured: !a.featured } : a)
    )
  }

  const deleteAnnouncement = (announcementId: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== announcementId))
  }

  const publishAnnouncement = (announcementId: string) => {
    setAnnouncements(prev => 
      prev.map(a => a.id === announcementId ? { 
        ...a, 
        status: 'published', 
        published_at: new Date().toISOString() 
      } : a)
    )
  }

  const createAnnouncement = () => {
    const announcement: Announcement = {
      ...newAnnouncement,
      id: `ann-${Date.now()}`,
      author: {
        id: 'current-user',
        name: 'Current User',
        role: 'Administrator'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'draft',
      attachments: [],
      metrics: {
        views: 0,
        likes: 0,
        shares: 0,
        comments: 0,
        click_through_rate: 0
      }
    } as Announcement
    
    setAnnouncements(prev => [announcement, ...prev])
    setNewAnnouncement({
      title: '',
      content: '',
      type: 'general',
      priority: 'medium',
      visibility: 'public',
      pinned: false,
      featured: false,
      tags: [],
      categories: [],
      target_audience: ['attendees'],
      push_notification: {
        enabled: false,
        sound: false,
        vibration: false
      },
      social_media: {
        twitter: false,
        facebook: false,
        instagram: false,
        discord: false
      }
    })
    setShowCreateDialog(false)
  }

  const filteredAnnouncements = getFilteredAnnouncements()

  const AnnouncementCard: React.FC<{ announcement: Announcement }> = ({ announcement }) => {
    return (
      <Card className={`transition-all hover:shadow-md ${
        announcement.pinned ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''
      } ${announcement.featured ? 'ring-2 ring-yellow-400' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            {/* Announcement Icon */}
            <div className="flex-shrink-0">
              {getAnnouncementIcon(announcement.type)}
            </div>
            
            {/* Announcement Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium text-lg text-gray-900">
                    {announcement.title}
                  </h4>
                  {announcement.pinned && <Pin className="h-4 w-4 text-blue-600" />}
                  {announcement.featured && <Star className="h-4 w-4 text-yellow-600" />}
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getStatusColor(announcement.status)}>
                    {announcement.status}
                  </Badge>
                  <Badge className={getPriorityColor(announcement.priority)}>
                    {announcement.priority}
                  </Badge>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                {announcement.content}
              </p>
              
              {/* Metadata */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <div className="flex items-center space-x-4">
                  <span>by {announcement.author.name}</span>
                  <span>{formatTimeAgo(announcement.created_at)}</span>
                  {announcement.location && (
                    <span className="flex items-center">
                      <MapPin className="h-3 w-3 mr-1" />
                      {announcement.location}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <span className="flex items-center">
                    <Eye className="h-3 w-3 mr-1" />
                    {announcement.metrics.views}
                  </span>
                  <span className="flex items-center">
                    <Heart className="h-3 w-3 mr-1" />
                    {announcement.metrics.likes}
                  </span>
                  <span className="flex items-center">
                    <Share2 className="h-3 w-3 mr-1" />
                    {announcement.metrics.shares}
                  </span>
                </div>
              </div>
              
              {/* Tags */}
              {announcement.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {announcement.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
              
              {/* Attachments */}
              {announcement.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {announcement.attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center space-x-1 text-xs bg-gray-100 rounded px-2 py-1">
                      {attachment.type === 'image' && <Image className="h-3 w-3" />}
                      {attachment.type === 'document' && <FileText className="h-3 w-3" />}
                      {attachment.type === 'link' && <Link className="h-3 w-3" />}
                      <span>{attachment.name}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {announcement.status === 'draft' && (
                    <Button
                      size="sm"
                      onClick={() => publishAnnouncement(announcement.id)}
                      className="text-xs"
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Publish
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedAnnouncement(announcement)}
                    className="text-xs"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                </div>
                
                <div className="flex items-center space-x-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => togglePin(announcement.id)}
                    className="text-xs"
                  >
                    {announcement.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleFeatured(announcement.id)}
                    className="text-xs"
                  >
                    {announcement.featured ? <Star className="h-3 w-3 text-yellow-600" /> : <Star className="h-3 w-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteAnnouncement(announcement.id)}
                    className="text-xs text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Announcement System</h1>
          <p className="text-gray-600">Manage event announcements and communications</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Announcement
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="announcements" className="space-y-6">
          {/* Filters and Search */}
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {announcementFilters.map((filter) => {
                const Icon = filter.icon
                const count = filter.value === 'all' 
                  ? announcements.length
                  : filter.value === 'pinned'
                  ? announcements.filter(a => a.pinned).length
                  : filter.value === 'featured'
                  ? announcements.filter(a => a.featured).length
                  : announcements.filter(a => a.status === filter.value || a.type === filter.value).length
                
                return (
                  <Button
                    key={filter.value}
                    variant={selectedFilter === filter.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedFilter(filter.value)}
                    className="flex items-center space-x-1"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{filter.label}</span>
                    {count > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {count}
                      </Badge>
                    )}
                  </Button>
                )
              })}
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search announcements..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>

          {/* Announcements List */}
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {filteredAnnouncements.length > 0 ? (
                filteredAnnouncements.map((announcement) => (
                  <AnnouncementCard key={announcement.id} announcement={announcement} />
                ))
              ) : (
                <div className="text-center py-12">
                  <Megaphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No announcements found</h3>
                  <p className="text-gray-600">
                    {searchQuery 
                      ? 'No announcements match your search criteria.'
                      : 'No announcements match the selected filter.'}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          {/* Templates List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-all">
                <CardHeader>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge>{template.type}</Badge>
                      <Badge variant="secondary">{template.category}</Badge>
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      <strong>Variables:</strong> {template.variables.join(', ')}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button size="sm" className="flex-1">
                        <Plus className="h-3 w-3 mr-1" />
                        Use Template
                      </Button>
                      <Button size="sm" variant="outline">
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Analytics Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Megaphone className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Announcements</p>
                    <p className="text-2xl font-bold">{announcements.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Eye className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Views</p>
                    <p className="text-2xl font-bold">
                      {announcements.reduce((sum, a) => sum + a.metrics.views, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Heart className="h-8 w-8 text-red-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Likes</p>
                    <p className="text-2xl font-bold">
                      {announcements.reduce((sum, a) => sum + a.metrics.likes, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Share2 className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Shares</p>
                    <p className="text-2xl font-bold">
                      {announcements.reduce((sum, a) => sum + a.metrics.shares, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Engagement Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Engagement Analytics</CardTitle>
              <CardDescription>Announcement performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">Analytics chart would be displayed here</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Announcement Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Announcement</DialogTitle>
            <DialogDescription>
              Create and publish announcements for event attendees
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={newAnnouncement.title || ''}
                onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter announcement title"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Content</label>
              <Textarea
                value={newAnnouncement.content || ''}
                onChange={(e) => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Enter announcement content"
                rows={4}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select 
                  value={newAnnouncement.type} 
                  onValueChange={(value) => setNewAnnouncement(prev => ({ ...prev, type: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Priority</label>
                <Select 
                  value={newAnnouncement.priority} 
                  onValueChange={(value) => setNewAnnouncement(prev => ({ ...prev, priority: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch 
                  checked={newAnnouncement.pinned || false}
                  onCheckedChange={(checked) => setNewAnnouncement(prev => ({ ...prev, pinned: checked }))}
                />
                <label className="text-sm">Pin announcement</label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch 
                  checked={newAnnouncement.featured || false}
                  onCheckedChange={(checked) => setNewAnnouncement(prev => ({ ...prev, featured: checked }))}
                />
                <label className="text-sm">Feature announcement</label>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createAnnouncement}>
                Create Announcement
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Announcement Dialog */}
      {selectedAnnouncement && (
        <Dialog open={!!selectedAnnouncement} onOpenChange={() => setSelectedAnnouncement(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                {getAnnouncementIcon(selectedAnnouncement.type)}
                <span>{selectedAnnouncement.title}</span>
              </DialogTitle>
              <DialogDescription>
                {selectedAnnouncement.summary || 'Announcement details'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Badge className={getStatusColor(selectedAnnouncement.status)}>
                  {selectedAnnouncement.status}
                </Badge>
                <Badge className={getPriorityColor(selectedAnnouncement.priority)}>
                  {selectedAnnouncement.priority}
                </Badge>
                {selectedAnnouncement.pinned && <Pin className="h-4 w-4 text-blue-600" />}
                {selectedAnnouncement.featured && <Star className="h-4 w-4 text-yellow-600" />}
              </div>
              
              <div className="prose max-w-none">
                <p>{selectedAnnouncement.content}</p>
              </div>
              
              {selectedAnnouncement.attachments.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Attachments</h4>
                  <div className="space-y-2">
                    {selectedAnnouncement.attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                        {attachment.type === 'image' && <Image className="h-4 w-4" />}
                        {attachment.type === 'document' && <FileText className="h-4 w-4" />}
                        {attachment.type === 'link' && <Link className="h-4 w-4" />}
                        <span className="flex-1">{attachment.name}</span>
                        <Button size="sm" variant="outline">
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Author:</strong> {selectedAnnouncement.author.name}
                </div>
                <div>
                  <strong>Created:</strong> {new Date(selectedAnnouncement.created_at).toLocaleString()}
                </div>
                {selectedAnnouncement.location && (
                  <div>
                    <strong>Location:</strong> {selectedAnnouncement.location}
                  </div>
                )}
                <div>
                  <strong>Visibility:</strong> {selectedAnnouncement.visibility}
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span className="flex items-center">
                    <Eye className="h-4 w-4 mr-1" />
                    {selectedAnnouncement.metrics.views} views
                  </span>
                  <span className="flex items-center">
                    <Heart className="h-4 w-4 mr-1" />
                    {selectedAnnouncement.metrics.likes} likes
                  </span>
                  <span className="flex items-center">
                    <Share2 className="h-4 w-4 mr-1" />
                    {selectedAnnouncement.metrics.shares} shares
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="outline">
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline">
                    <Share2 className="h-3 w-3 mr-1" />
                    Share
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default AnnouncementSystem