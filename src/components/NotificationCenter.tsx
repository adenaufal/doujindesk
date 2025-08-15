import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import {
  Bell,
  Settings,
  Check,
  Archive,
  Trash2,
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  XCircle,
  Users,
  Calendar,
  Star,
  Megaphone
} from 'lucide-react'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success' | 'announcement' | 'queue' | 'event' | 'circle' | 'system'
  category: 'general' | 'queue_updates' | 'event_alerts' | 'circle_news' | 'system_updates' | 'announcements'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  timestamp: string
  read: boolean
  archived: boolean
  actionable: boolean
  action_url?: string
  action_label?: string
  source: string
  icon?: string
  image_url?: string
  expires_at?: string
  tags: string[]
}

interface NotificationSettings {
  enabled: boolean
  sound_enabled: boolean
  vibration_enabled: boolean
  email_enabled: boolean
  push_enabled: boolean
  categories: {
    [key: string]: {
      enabled: boolean
      priority_threshold: 'low' | 'medium' | 'high' | 'urgent'
      sound: boolean
      email: boolean
    }
  }
  quiet_hours: {
    enabled: boolean
    start_time: string
    end_time: string
  }
  frequency_limit: {
    enabled: boolean
    max_per_hour: number
  }
}

const NotificationCenter: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState('notifications')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [showSettings, setShowSettings] = useState(false)
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set())
  
  // Mock notifications data
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 'notif-1',
      title: 'Queue Alert: Main Entrance',
      message: 'Wait time has increased to 25 minutes. Consider using East Entrance.',
      type: 'warning',
      category: 'queue_updates',
      priority: 'high',
      timestamp: '2025-01-15T10:30:00Z',
      read: false,
      archived: false,
      actionable: true,
      action_url: '/queue-status',
      action_label: 'View Queue',
      source: 'Queue Management System',
      tags: ['queue', 'entrance', 'wait-time'],
      expires_at: '2024-01-15T12:00:00Z'
    },
    {
      id: 'notif-2',
      title: 'New Circle Announcement',
      message: 'Sakura Studios will be hosting a live drawing demo at 14:00 today!',
      type: 'info',
      category: 'circle_news',
      priority: 'medium',
      timestamp: '2025-01-15T09:45:00Z',
      read: true,
      archived: false,
      actionable: true,
      action_url: '/circles/sakura-studios',
      action_label: 'View Circle',
      source: 'Sakura Studios',
      tags: ['circle', 'demo', 'live-drawing'],
      image_url: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=anime%20art%20studio%20drawing%20demo&image_size=square'
    },
    {
      id: 'notif-3',
      title: 'Event Starting Soon',
      message: 'Cosplay Contest registration closes in 30 minutes. Don\'t miss out!',
      type: 'announcement',
      category: 'event_alerts',
      priority: 'urgent',
      timestamp: '2025-01-15T10:15:00Z',
      read: false,
      archived: false,
      actionable: true,
      action_url: '/events/cosplay-contest',
      action_label: 'Register Now',
      source: 'Event Management',
      tags: ['event', 'cosplay', 'registration', 'deadline']
    },
    {
      id: 'notif-4',
      title: 'System Maintenance',
      message: 'Payment system will be offline for 10 minutes starting at 11:00 AM.',
      type: 'warning',
      category: 'system_updates',
      priority: 'high',
      timestamp: '2024-01-15T08:30:00Z',
      read: true,
      archived: false,
      actionable: false,
      source: 'System Administrator',
      tags: ['system', 'maintenance', 'payment']
    },
    {
      id: 'notif-5',
      title: 'Your Favorite Circle Updated',
      message: 'Moonlight Creations has added new artwork to their booth!',
      type: 'info',
      category: 'circle_news',
      priority: 'low',
      timestamp: '2024-01-15T07:20:00Z',
      read: true,
      archived: false,
      actionable: true,
      action_url: '/circles/moonlight-creations',
      action_label: 'View Updates',
      source: 'Moonlight Creations',
      tags: ['circle', 'favorite', 'artwork', 'update']
    },
    {
      id: 'notif-6',
      title: 'Welcome to DoujinDesk!',
      message: 'Thank you for joining us. Explore circles, check queues, and enjoy the event!',
      type: 'success',
      category: 'general',
      priority: 'low',
      timestamp: '2024-01-15T06:00:00Z',
      read: true,
      archived: false,
      actionable: true,
      action_url: '/guide',
      action_label: 'Get Started',
      source: 'DoujinDesk',
      tags: ['welcome', 'guide']
    }
  ])

  // Mock notification settings
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    sound_enabled: true,
    vibration_enabled: true,
    email_enabled: false,
    push_enabled: true,
    categories: {
      general: { enabled: true, priority_threshold: 'low', sound: true, email: false },
      queue_updates: { enabled: true, priority_threshold: 'medium', sound: true, email: false },
      event_alerts: { enabled: true, priority_threshold: 'low', sound: true, email: true },
      circle_news: { enabled: true, priority_threshold: 'low', sound: false, email: false },
      system_updates: { enabled: true, priority_threshold: 'high', sound: true, email: true },
      announcements: { enabled: true, priority_threshold: 'medium', sound: true, email: false }
    },
    quiet_hours: {
      enabled: false,
      start_time: '22:00',
      end_time: '08:00'
    },
    frequency_limit: {
      enabled: true,
      max_per_hour: 10
    }
  })

  const notificationFilters = [
    { value: 'all', label: 'All', icon: Bell },
    { value: 'unread', label: 'Unread', icon: AlertCircle },
    { value: 'queue_updates', label: 'Queue Updates', icon: Users },
    { value: 'event_alerts', label: 'Events', icon: Calendar },
    { value: 'circle_news', label: 'Circle News', icon: Star },
    { value: 'announcements', label: 'Announcements', icon: Megaphone },
    { value: 'system_updates', label: 'System', icon: Settings }
  ]

  const getFilteredNotifications = () => {
    let filtered = notifications
    
    if (selectedFilter === 'unread') {
      filtered = filtered.filter(n => !n.read)
    } else if (selectedFilter !== 'all') {
      filtered = filtered.filter(n => n.category === selectedFilter)
    }
    
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info className="h-5 w-5 text-blue-600" />
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'error': return <XCircle className="h-5 w-5 text-red-600" />
      case 'success': return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'announcement': return <Megaphone className="h-5 w-5 text-purple-600" />
      case 'queue': return <Users className="h-5 w-5 text-orange-600" />
      case 'event': return <Calendar className="h-5 w-5 text-indigo-600" />
      case 'circle': return <Star className="h-5 w-5 text-pink-600" />
      case 'system': return <Settings className="h-5 w-5 text-gray-600" />
      default: return <Bell className="h-5 w-5 text-gray-600" />
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

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const archiveNotification = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, archived: true } : n)
    )
  }

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }

  const toggleNotificationSelection = (notificationId: string) => {
    setSelectedNotifications(prev => {
      const newSet = new Set(prev)
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId)
      } else {
        newSet.add(notificationId)
      }
      return newSet
    })
  }

  const bulkMarkAsRead = () => {
    setNotifications(prev => 
      prev.map(n => selectedNotifications.has(n.id) ? { ...n, read: true } : n)
    )
    setSelectedNotifications(new Set())
  }

  const bulkArchive = () => {
    setNotifications(prev => 
      prev.map(n => selectedNotifications.has(n.id) ? { ...n, archived: true } : n)
    )
    setSelectedNotifications(new Set())
  }

  const bulkDelete = () => {
    setNotifications(prev => 
      prev.filter(n => !selectedNotifications.has(n.id))
    )
    setSelectedNotifications(new Set())
  }

  const updateCategorySetting = (category: string, setting: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: {
          ...prev.categories[category],
          [setting]: value
        }
      }
    }))
  }

  const unreadCount = notifications.filter(n => !n.read && !n.archived).length
  const filteredNotifications = getFilteredNotifications().filter(n => !n.archived)

  const NotificationCard: React.FC<{ notification: Notification }> = ({ notification }) => {
    const isSelected = selectedNotifications.has(notification.id)
    
    return (
      <Card className={`transition-all hover:shadow-md ${
        !notification.read ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''
      } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            {/* Selection Checkbox */}
            <div className="flex-shrink-0 mt-1">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleNotificationSelection(notification.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
            
            {/* Notification Icon */}
            <div className="flex-shrink-0">
              {getNotificationIcon(notification.type)}
            </div>
            
            {/* Notification Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <h4 className={`font-medium text-sm ${
                    !notification.read ? 'text-gray-900' : 'text-gray-700'
                  }`}>
                    {notification.title}
                  </h4>
                  <Badge className={`text-xs ${getPriorityColor(notification.priority)}`}>
                    {notification.priority}
                  </Badge>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-gray-500">
                    {formatTimeAgo(notification.timestamp)}
                  </span>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  )}
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
              
              {/* Image */}
              {notification.image_url && (
                <div className="mb-3">
                  <img 
                    src={notification.image_url} 
                    alt="Notification" 
                    className="w-full h-32 object-cover rounded-lg"
                  />
                </div>
              )}
              
              {/* Tags */}
              {notification.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {notification.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              
              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {notification.actionable && notification.action_label && (
                    <Button size="sm" className="text-xs">
                      {notification.action_label}
                    </Button>
                  )}
                  <span className="text-xs text-gray-500">
                    from {notification.source}
                  </span>
                </div>
                
                <div className="flex items-center space-x-1">
                  {!notification.read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markAsRead(notification.id)}
                      className="text-xs"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => archiveNotification(notification.id)}
                    className="text-xs"
                  >
                    <Archive className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteNotification(notification.id)}
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
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600">Stay updated with real-time alerts and announcements</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">
            {unreadCount} unread
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-6">
          {/* Filters and Actions */}
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {notificationFilters.map((filter) => {
                const Icon = filter.icon
                const count = filter.value === 'all' 
                  ? filteredNotifications.length
                  : filter.value === 'unread'
                  ? unreadCount
                  : notifications.filter(n => n.category === filter.value && !n.archived).length
                
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
              {selectedNotifications.size > 0 && (
                <>
                  <Button size="sm" onClick={bulkMarkAsRead}>
                    <Check className="h-4 w-4 mr-1" />
                    Mark Read ({selectedNotifications.size})
                  </Button>
                  <Button size="sm" variant="outline" onClick={bulkArchive}>
                    <Archive className="h-4 w-4 mr-1" />
                    Archive
                  </Button>
                  <Button size="sm" variant="outline" onClick={bulkDelete}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </>
              )}
              {unreadCount > 0 && (
                <Button size="sm" variant="outline" onClick={markAllAsRead}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark All Read
                </Button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {filteredNotifications.length > 0 ? (
                filteredNotifications.map((notification) => (
                  <NotificationCard key={notification.id} notification={notification} />
                ))
              ) : (
                <div className="text-center py-12">
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
                  <p className="text-gray-600">
                    {selectedFilter === 'unread' 
                      ? 'All caught up! No unread notifications.'
                      : 'No notifications match the selected filter.'}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure your notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Enable Notifications</h4>
                  <p className="text-sm text-gray-600">Receive notifications from DoujinDesk</p>
                </div>
                <Switch 
                  checked={settings.enabled} 
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enabled: checked }))}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Sound Notifications</h4>
                  <p className="text-sm text-gray-600">Play sound for new notifications</p>
                </div>
                <Switch 
                  checked={settings.sound_enabled} 
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, sound_enabled: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Vibration</h4>
                  <p className="text-sm text-gray-600">Vibrate device for notifications</p>
                </div>
                <Switch 
                  checked={settings.vibration_enabled} 
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, vibration_enabled: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Email Notifications</h4>
                  <p className="text-sm text-gray-600">Receive important updates via email</p>
                </div>
                <Switch 
                  checked={settings.email_enabled} 
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, email_enabled: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Category Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Categories</CardTitle>
              <CardDescription>Customize notifications by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(settings.categories).map(([category, categorySettings]) => (
                  <div key={category} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium capitalize">{category.replace('_', ' ')}</h4>
                      <Switch 
                        checked={categorySettings.enabled}
                        onCheckedChange={(checked) => updateCategorySetting(category, 'enabled', checked)}
                      />
                    </div>
                    
                    {categorySettings.enabled && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center justify-between">
                          <span>Sound</span>
                          <Switch 
                            checked={categorySettings.sound}
                            onCheckedChange={(checked) => updateCategorySetting(category, 'sound', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Email</span>
                          <Switch 
                            checked={categorySettings.email}
                            onCheckedChange={(checked) => updateCategorySetting(category, 'email', checked)}
                          />
                        </div>
                        <div>
                          <span>Min Priority: </span>
                          <select 
                            value={categorySettings.priority_threshold}
                            onChange={(e) => updateCategorySetting(category, 'priority_threshold', e.target.value)}
                            className="ml-1 text-xs border rounded px-1"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Additional notification controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Quiet Hours</h4>
                  <p className="text-sm text-gray-600">Disable notifications during specified hours</p>
                </div>
                <Switch 
                  checked={settings.quiet_hours.enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    quiet_hours: { ...prev.quiet_hours, enabled: checked }
                  }))}
                />
              </div>
              
              {settings.quiet_hours.enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Start Time</label>
                    <input 
                      type="time" 
                      value={settings.quiet_hours.start_time}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        quiet_hours: { ...prev.quiet_hours, start_time: e.target.value }
                      }))}
                      className="w-full mt-1 border rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">End Time</label>
                    <input 
                      type="time" 
                      value={settings.quiet_hours.end_time}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        quiet_hours: { ...prev.quiet_hours, end_time: e.target.value }
                      }))}
                      className="w-full mt-1 border rounded px-2 py-1"
                    />
                  </div>
                </div>
              )}
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Frequency Limit</h4>
                  <p className="text-sm text-gray-600">Limit notifications per hour</p>
                </div>
                <Switch 
                  checked={settings.frequency_limit.enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    frequency_limit: { ...prev.frequency_limit, enabled: checked }
                  }))}
                />
              </div>
              
              {settings.frequency_limit.enabled && (
                <div>
                  <label className="text-sm font-medium">Max notifications per hour</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="50"
                    value={settings.frequency_limit.max_per_hour}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      frequency_limit: { ...prev.frequency_limit, max_per_hour: parseInt(e.target.value) }
                    }))}
                    className="w-full mt-1 border rounded px-2 py-1"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default NotificationCenter