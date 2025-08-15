import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Progress } from './ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import {
  Users,
  Building2,
  Ticket,
  DollarSign,
  TrendingUp,
  Wifi,
  WifiOff,
  Activity,
  UserCheck,
  Bell,
  CheckCircle,
  AlertCircle,
  Plus,
  FileText,
  Settings,
  // Calendar,
  Map
} from 'lucide-react'
import { useEventStore } from '../stores/eventStore'
import { useCircleStore } from '../stores/circleStore'
import { useAuthStore } from '../stores/authStore'

interface DashboardStats {
  totalCircles: number
  pendingApplications: number
  allocatedBooths: number
  totalBooths: number
  availableBooths: number
  soldTickets: number
  totalTickets: number
  totalRevenue: number
  activeStaff: number
  staffMembers: number
}

interface QuickAction {
  id: string
  title: string
  description: string
  icon: React.ReactElement
  action: () => void
}

interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

const Dashboard: React.FC = () => {
  const { currentEvent } = useEventStore()
  const { circles } = useCircleStore()
  const { user } = useAuthStore()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastSync] = useState(new Date())
  const [stats, setStats] = useState<DashboardStats>({
    totalCircles: 0,
    pendingApplications: 0,
    allocatedBooths: 245,
    totalBooths: 300,
    availableBooths: 55,
    soldTickets: 15420,
    totalTickets: 25000,
    totalRevenue: 2450000000,
    activeStaff: 28,
    staffMembers: 35
  })

  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'success',
      title: 'Circle Application Approved',
      message: 'Circle "Anime Dreams" has been approved and allocated booth B-15.',
      timestamp: new Date(Date.now() - 2 * 60 * 1000),
      read: false
    },
    {
      id: '2',
      type: 'info',
      title: 'New Application Received',
      message: 'Circle "Manga Masters" has submitted their application.',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      read: false
    },
    {
      id: '3',
      type: 'warning',
      title: 'Booth Capacity Warning',
      message: 'Only 55 booths remaining. Consider opening additional areas.',
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
      read: true
    }
  ])

  useEffect(() => {
    const handleOnlineStatus = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', handleOnlineStatus)
    window.addEventListener('offline', handleOnlineStatus)
    return () => {
      window.removeEventListener('online', handleOnlineStatus)
      window.removeEventListener('offline', handleOnlineStatus)
    }
  }, [])

  useEffect(() => {
    setStats(prev => ({
      ...prev,
      totalCircles: circles.length,
      pendingApplications: circles.filter(c => c.status === 'submitted' || c.status === 'under_review').length
    }))
  }, [circles])

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
    }).format(amount)
  }

  const getQuickActions = (): QuickAction[] => {
    const baseActions: QuickAction[] = [
      {
        id: 'new-circle',
        title: 'Add New Circle',
        description: 'Register a new circle application',
        icon: <Plus />,
        action: () => console.log('Navigate to new circle form')
      },
      {
        id: 'booth-allocation',
        title: 'Manage Booths',
        description: 'Allocate and manage booth assignments',
        icon: <Map />,
        action: () => console.log('Navigate to booth management')
      },
      {
        id: 'reports',
        title: 'Generate Reports',
        description: 'Create financial and operational reports',
        icon: <FileText />,
        action: () => console.log('Navigate to reports')
      }
    ]

    if (user?.role === 'admin') {
      baseActions.push({
        id: 'settings',
        title: 'Event Settings',
        description: 'Configure event parameters',
        icon: <Settings />,
        action: () => console.log('Navigate to settings')
      })
    }

    return baseActions
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />
      default: return <Bell className="h-4 w-4 text-blue-500" />
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Welcome back, <span className="font-semibold text-foreground">{user?.name || 'User'}</span>! 
              Here's what's happening with <span className="font-semibold text-foreground">{currentEvent?.name || 'your event'}</span>.
            </p>
          </div>
          
          {/* Sync Status */}
          <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg px-4 py-2 border shadow-sm">
            {isOnline ? (
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                <Wifi className="h-3 w-3 mr-1" />
                Online
              </Badge>
            ) : (
              <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              Last sync: {formatTimeAgo(lastSync)}
            </span>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-300">Total Circles</CardTitle>
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{stats.totalCircles}</div>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                {stats.pendingApplications} pending approval
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 border-green-200 dark:border-green-800 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-300">Booth Allocation</CardTitle>
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900 dark:text-green-100">{stats.allocatedBooths}/{stats.totalBooths}</div>
              <Progress value={(stats.allocatedBooths / stats.totalBooths) * 100} className="mt-3 h-2" />
              <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                {stats.availableBooths} booths available
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950 dark:to-violet-900 border-purple-200 dark:border-purple-800 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-purple-700 dark:text-purple-300">Ticket Sales</CardTitle>
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Ticket className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">{stats.soldTickets.toLocaleString()}</div>
              <Progress value={(stats.soldTickets / stats.totalTickets) * 100} className="mt-3 h-2" />
              <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">
                {((stats.soldTickets / stats.totalTickets) * 100).toFixed(1)}% of target
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-900 border-amber-200 dark:border-amber-800 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-300">Revenue</CardTitle>
              <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">{formatCurrency(stats.totalRevenue, 'IDR')}</div>
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center mt-2">
                <TrendingUp className="h-4 w-4 mr-1" />
                +12% from last event
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border shadow-sm">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900 dark:data-[state=active]:text-blue-300">
              Overview
            </TabsTrigger>
            <TabsTrigger value="quick-actions" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900 dark:data-[state=active]:text-blue-300">
              Quick Actions
            </TabsTrigger>
            <TabsTrigger value="notifications" className="relative data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900 dark:data-[state=active]:text-blue-300">
              Notifications
              {unreadCount > 0 && (
                <Badge className="ml-2 h-5 w-5 rounded-full p-0 text-xs bg-red-500 hover:bg-red-500">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Recent Activity */}
              <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-green-800 dark:text-green-200">Circle "Anime Dreams" approved</p>
                      <p className="text-xs text-green-600 dark:text-green-400">2 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="h-3 w-3 bg-blue-500 rounded-full" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">New application received</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">15 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="h-3 w-3 bg-amber-500 rounded-full" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Booth B-15 allocated</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">1 hour ago</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Staff Status */}
              <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                      <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    Staff Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Active Staff</span>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">{stats.activeStaff}/{stats.staffMembers}</span>
                    </div>
                    <Progress value={(stats.activeStaff / stats.staffMembers) * 100} className="h-3" />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-sm text-green-600 dark:text-green-400">On Duty</p>
                        <p className="text-xl font-bold text-green-800 dark:text-green-200">{stats.activeStaff}</p>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                        <p className="text-sm text-slate-600 dark:text-slate-400">Off Duty</p>
                        <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{stats.staffMembers - stats.activeStaff}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        
          <TabsContent value="quick-actions" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {getQuickActions().map((action) => (
                <Card key={action.id} className="cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-300 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border shadow-lg group" onClick={action.action}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-xl group-hover:scale-110 transition-transform duration-300">
                        {React.cloneElement(action.icon, { className: "h-6 w-6 text-blue-600 dark:text-blue-400" })}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200">{action.title}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{action.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        
          <TabsContent value="notifications" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Recent Notifications</h3>
              <Button variant="outline" size="sm" className="hover:bg-blue-50 dark:hover:bg-blue-950 border-blue-200 dark:border-blue-800" onClick={() => {
                setNotifications(notifications.map(n => ({ ...n, read: true })));
              }}>
                Mark all as read
              </Button>
            </div>
            <div className="space-y-4">
              {notifications.map((notification) => (
                <Card key={notification.id} className={`p-5 transition-all duration-300 hover:shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border ${
                  notification.read ? 'opacity-70' : 'shadow-md'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${
                      notification.type === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400' :
                      notification.type === 'warning' ? 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400' :
                      notification.type === 'error' ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400' :
                      'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                    }`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-lg text-slate-800 dark:text-slate-200">{notification.title}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{notification.message}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">{formatTimeAgo(notification.timestamp)}</p>
                    </div>
                    {!notification.read && (
                      <Badge className="bg-red-500 hover:bg-red-600 text-white animate-pulse">
                        New
                      </Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default Dashboard