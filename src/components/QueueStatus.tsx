import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  Clock, 
  Users, 
  MapPin, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Timer,
  TrendingUp,
  TrendingDown,
  Minus,
  Bell,
  BellOff,
  RefreshCw,
  Navigation,
  Info,
  Calendar,
  BarChart3,
  Activity,
  Zap,
  Target,
  // ArrowRight,
  // ArrowUp,
  // ArrowDown
} from 'lucide-react'

interface QueueInfo {
  id: string
  name: string
  location: string
  type: 'entry' | 'booth' | 'event' | 'food' | 'merchandise' | 'registration'
  current_wait: number // minutes
  estimated_wait: number // minutes
  queue_length: number // people
  capacity: number
  status: 'open' | 'closed' | 'full' | 'maintenance'
  trend: 'increasing' | 'decreasing' | 'stable'
  peak_hours: string[]
  last_updated: string
  notifications_enabled: boolean
  priority: 'low' | 'medium' | 'high'
  accessibility: boolean
  special_notes?: string
  opening_hours: string
  next_update: string
}

interface QueueAlert {
  id: string
  queue_id: string
  type: 'wait_time' | 'capacity' | 'closure' | 'opening'
  message: string
  severity: 'info' | 'warning' | 'error'
  timestamp: string
  acknowledged: boolean
}

const QueueStatus: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState('overview')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [selectedQueueType, setSelectedQueueType] = useState<string>('all')
  const [refreshInterval] = useState(30) // seconds
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [subscribedQueues, setSubscribedQueues] = useState<Set<string>>(new Set())
  
  // Mock queue data
  const [queues] = useState<QueueInfo[]>([
    {
      id: 'entry-main',
      name: 'Main Entrance',
      location: 'Building A - Main Gate',
      type: 'entry',
      current_wait: 15,
      estimated_wait: 18,
      queue_length: 120,
      capacity: 500,
      status: 'open',
      trend: 'increasing',
      peak_hours: ['10:00-11:00', '13:00-14:00'],
      last_updated: '2024-01-15T10:30:00Z',
      notifications_enabled: true,
      priority: 'high',
      accessibility: true,
      opening_hours: '09:00 - 19:00',
      next_update: '2024-01-15T10:35:00Z'
    },
    {
      id: 'entry-east',
      name: 'East Entrance',
      location: 'Building B - East Gate',
      type: 'entry',
      current_wait: 8,
      estimated_wait: 10,
      queue_length: 45,
      capacity: 300,
      status: 'open',
      trend: 'stable',
      peak_hours: ['11:00-12:00'],
      last_updated: '2024-01-15T10:29:00Z',
      notifications_enabled: false,
      priority: 'medium',
      accessibility: true,
      opening_hours: '09:30 - 18:30',
      next_update: '2024-01-15T10:34:00Z'
    },
    {
      id: 'booth-sakura',
      name: 'Sakura Studios',
      location: 'Hall A - Booth A-15',
      type: 'booth',
      current_wait: 25,
      estimated_wait: 30,
      queue_length: 35,
      capacity: 50,
      status: 'open',
      trend: 'decreasing',
      peak_hours: ['14:00-15:00', '16:00-17:00'],
      last_updated: '2024-01-15T10:28:00Z',
      notifications_enabled: true,
      priority: 'high',
      accessibility: false,
      special_notes: 'Live drawing demo at 14:00',
      opening_hours: '10:00 - 18:00',
      next_update: '2024-01-15T10:33:00Z'
    },
    {
      id: 'food-court',
      name: 'Food Court',
      location: 'Building C - Level 2',
      type: 'food',
      current_wait: 12,
      estimated_wait: 15,
      queue_length: 80,
      capacity: 200,
      status: 'open',
      trend: 'stable',
      peak_hours: ['12:00-13:00', '17:00-18:00'],
      last_updated: '2024-01-15T10:31:00Z',
      notifications_enabled: false,
      priority: 'medium',
      accessibility: true,
      opening_hours: '10:00 - 19:00',
      next_update: '2024-01-15T10:36:00Z'
    },
    {
      id: 'merch-official',
      name: 'Official Merchandise',
      location: 'Hall B - Booth B-01',
      type: 'merchandise',
      current_wait: 45,
      estimated_wait: 50,
      queue_length: 150,
      capacity: 100,
      status: 'full',
      trend: 'increasing',
      peak_hours: ['10:00-12:00', '15:00-17:00'],
      last_updated: '2024-01-15T10:32:00Z',
      notifications_enabled: true,
      priority: 'high',
      accessibility: true,
      special_notes: 'Limited edition items available',
      opening_hours: '09:00 - 18:00',
      next_update: '2024-01-15T10:37:00Z'
    },
    {
      id: 'event-stage',
      name: 'Main Stage Event',
      location: 'Central Plaza - Main Stage',
      type: 'event',
      current_wait: 0,
      estimated_wait: 0,
      queue_length: 0,
      capacity: 1000,
      status: 'closed',
      trend: 'stable',
      peak_hours: ['14:00-16:00'],
      last_updated: '2024-01-15T10:25:00Z',
      notifications_enabled: true,
      priority: 'medium',
      accessibility: true,
      special_notes: 'Next show starts at 14:00',
      opening_hours: 'Event Schedule',
      next_update: '2024-01-15T13:55:00Z'
    }
  ])

  // Mock alerts
  const [alerts] = useState<QueueAlert[]>([
    {
      id: 'alert-1',
      queue_id: 'merch-official',
      type: 'capacity',
      message: 'Official Merchandise booth is at full capacity',
      severity: 'warning',
      timestamp: '2025-12-15T10:30:00Z',
      acknowledged: false
    },
    {
      id: 'alert-2',
      queue_id: 'booth-sakura',
      type: 'wait_time',
      message: 'Wait time for Sakura Studios has decreased to 25 minutes',
      severity: 'info',
      timestamp: '2025-12-15T11:15:00Z',
      acknowledged: true
    }
  ])

  const queueTypes = [
    { value: 'all', label: 'All Queues', icon: Users },
    { value: 'entry', label: 'Entrances', icon: MapPin },
    { value: 'booth', label: 'Circle Booths', icon: Target },
    { value: 'event', label: 'Events', icon: Calendar },
    { value: 'food', label: 'Food & Drinks', icon: Activity },
    { value: 'merchandise', label: 'Merchandise', icon: Zap }
  ]

  const filteredQueues = selectedQueueType === 'all' 
    ? queues 
    : queues.filter(queue => queue.type === selectedQueueType)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-500'
      case 'full': return 'bg-yellow-500'
      case 'closed': return 'bg-red-500'
      case 'maintenance': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <CheckCircle className="h-4 w-4" />
      case 'full': return <AlertCircle className="h-4 w-4" />
      case 'closed': return <XCircle className="h-4 w-4" />
      case 'maintenance': return <Timer className="h-4 w-4" />
      default: return <Timer className="h-4 w-4" />
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-green-500" />
      case 'stable': return <Minus className="h-4 w-4 text-gray-500" />
      default: return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getWaitTimeColor = (waitTime: number) => {
    if (waitTime <= 10) return 'text-green-600'
    if (waitTime <= 30) return 'text-yellow-600'
    return 'text-red-600'
  }

  const toggleQueueNotification = (queueId: string) => {
    setSubscribedQueues(prev => {
      const newSet = new Set(prev)
      if (newSet.has(queueId)) {
        newSet.delete(queueId)
      } else {
        newSet.add(queueId)
      }
      return newSet
    })
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now.getTime() - time.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    return `${diffHours}h ago`
  }

  const QueueCard: React.FC<{ queue: QueueInfo }> = ({ queue }) => {
    const isSubscribed = subscribedQueues.has(queue.id)
    const capacityPercentage = (queue.queue_length / queue.capacity) * 100

    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <CardTitle className="text-lg">{queue.name}</CardTitle>
                <Badge className={getStatusColor(queue.status)}>
                  {getStatusIcon(queue.status)}
                  <span className="ml-1 capitalize">{queue.status}</span>
                </Badge>
                {queue.priority === 'high' && (
                  <Badge variant="destructive">High Priority</Badge>
                )}
              </div>
              <CardDescription className="flex items-center space-x-1">
                <MapPin className="h-3 w-3" />
                <span>{queue.location}</span>
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleQueueNotification(queue.id)}
              className={isSubscribed ? 'text-blue-600' : 'text-gray-400'}
            >
              {isSubscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Wait Time Display */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${getWaitTimeColor(queue.current_wait)}`}>
                {queue.current_wait}m
              </div>
              <div className="text-xs text-gray-500">Current Wait</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getWaitTimeColor(queue.estimated_wait)}`}>
                {queue.estimated_wait}m
              </div>
              <div className="text-xs text-gray-500">Estimated</div>
            </div>
          </div>

          {/* Queue Length and Capacity */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Queue Capacity</span>
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{queue.queue_length}/{queue.capacity}</span>
                {getTrendIcon(queue.trend)}
              </div>
            </div>
            <Progress value={capacityPercentage} className="h-2" />
            <div className="text-xs text-gray-500 mt-1">
              {capacityPercentage.toFixed(0)}% capacity
            </div>
          </div>

          {/* Special Notes */}
          {queue.special_notes && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-start space-x-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <p className="text-sm text-blue-800">{queue.special_notes}</p>
              </div>
            </div>
          )}

          {/* Queue Info */}
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
            <div>
              <div className="flex items-center space-x-1 mb-1">
                <Clock className="h-3 w-3" />
                <span>Hours: {queue.opening_hours}</span>
              </div>
              <div className="flex items-center space-x-1">
                <RefreshCw className="h-3 w-3" />
                <span>Updated: {formatTimeAgo(queue.last_updated)}</span>
              </div>
            </div>
            <div>
              {queue.accessibility && (
                <div className="flex items-center space-x-1 mb-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Accessible</span>
                </div>
              )}
              <div className="flex items-center space-x-1">
                <Timer className="h-3 w-3" />
                <span>Peak: {queue.peak_hours.join(', ')}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-2">
            <Button size="sm" className="flex-1">
              <Navigation className="h-3 w-3 mr-1" />
              Navigate
            </Button>
            <Button size="sm" variant="outline">
              <BarChart3 className="h-3 w-3 mr-1" />
              History
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const AlertCard: React.FC<{ alert: QueueAlert }> = ({ alert }) => {
    const queue = queues.find(q => q.id === alert.queue_id)
    const severityColors = {
      info: 'border-blue-200 bg-blue-50',
      warning: 'border-yellow-200 bg-yellow-50',
      error: 'border-red-200 bg-red-50'
    }

    return (
      <Card className={`${severityColors[alert.severity]} ${alert.acknowledged ? 'opacity-60' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {alert.severity === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
              {alert.severity === 'warning' && <AlertCircle className="h-5 w-5 text-yellow-600" />}
              {alert.severity === 'info' && <Info className="h-5 w-5 text-blue-600" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-sm">{queue?.name}</h4>
                <span className="text-xs text-gray-500">{formatTimeAgo(alert.timestamp)}</span>
              </div>
              <p className="text-sm text-gray-700">{alert.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Auto-refresh effect
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date())
    }, refreshInterval * 1000)

    return () => clearInterval(interval)
  }, [refreshInterval])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Queue Status</h1>
        <p className="text-gray-600">Real-time queue information and wait times</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {queues.filter(q => q.status === 'open').length}
            </div>
            <div className="text-sm text-gray-500">Open Queues</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {queues.filter(q => q.status === 'full').length}
            </div>
            <div className="text-sm text-gray-500">Full Queues</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(queues.reduce((acc, q) => acc + q.current_wait, 0) / queues.length)}m
            </div>
            <div className="text-sm text-gray-500">Avg Wait Time</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {subscribedQueues.size}
            </div>
            <div className="text-sm text-gray-500">Subscriptions</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {queueTypes.map((type) => {
            const Icon = type.icon
            return (
              <Button
                key={type.value}
                variant={selectedQueueType === type.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedQueueType(type.value)}
                className="flex items-center space-x-1"
              >
                <Icon className="h-4 w-4" />
                <span>{type.label}</span>
              </Button>
            )
          })}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={notificationsEnabled ? 'text-blue-600' : 'text-gray-400'}
          >
            {notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            <span className="ml-1">Notifications</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLastRefresh(new Date())}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Last Update Info */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {lastRefresh.toLocaleTimeString()} • Auto-refresh every {refreshInterval}s
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Queue Overview</TabsTrigger>
          <TabsTrigger value="alerts">Alerts ({alerts.filter(a => !a.acknowledged).length})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Queue Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQueues.map((queue) => (
              <QueueCard key={queue.id} queue={queue} />
            ))}
          </div>

          {/* Empty State */}
          {filteredQueues.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No queues found</h3>
              <p className="text-gray-600">No queues match the selected filter</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {alerts.length > 0 ? (
            alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))
          ) : (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No active alerts</h3>
              <p className="text-gray-600">All queues are operating normally</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Wait Time Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Wait Time Trends</CardTitle>
                <CardDescription>Average wait times throughout the day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                    <p>Chart visualization would go here</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Queue Capacity */}
            <Card>
              <CardHeader>
                <CardTitle>Queue Capacity Usage</CardTitle>
                <CardDescription>Current capacity across all queues</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {queues.slice(0, 5).map((queue) => {
                    const percentage = (queue.queue_length / queue.capacity) * 100
                    return (
                      <div key={queue.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{queue.name}</span>
                          <span>{percentage.toFixed(0)}%</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default QueueStatus