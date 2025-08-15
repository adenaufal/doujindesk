import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Badge } from './ui/badge'

import { ScrollArea } from './ui/scroll-area'

import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
// import { useToast } from '../hooks/use-toast'
import { useStaffStore, type StaffMember } from '../stores/staffStore'
import { 
  MessageSquare, Send, Plus, Edit, Eye, Users, ClipboardList, 
  Calendar, AlertTriangle, Settings, UserPlus
} from 'lucide-react'

const StaffCoordination: React.FC = () => {
  // const { toast } = useToast() // unused
  const [activeTab, setActiveTab] = useState('dashboard')
  const {
    staffMembers,
    tasks,
    shifts,
    incidents,
    messages,
    sendMessage
  } = useStaffStore()
  const [currentUser] = useState<StaffMember>({
    id: 'current-user',
    name: 'Admin User',
    email: 'admin@doujindesk.com',
    role: 'Admin',
    department: 'Management',
    status: 'Active',
    joinDate: '2025-01-01',
    skills: ['Management', 'Coordination'],
    certifications: ['Event Management'],
    permissions: ['all']
  })

  // Helper functions for filtering and searching
  const [staffFilter, setStaffFilter] = useState('all')
  const [taskFilter, setTaskFilter] = useState('all')
  const [scheduleFilter, setScheduleFilter] = useState('all')
  const [incidentFilter, setIncidentFilter] = useState('all')
  const [selectedChannel, setSelectedChannel] = useState<'General' | 'Security' | 'Operations' | 'Emergency' | 'Management'>('General')
  const [newMessage, setNewMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Filter functions
  const filteredStaff = staffMembers.filter(staff => {
    const matchesSearch = staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         staff.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = staffFilter === 'all' || staff.role.toLowerCase().replace(' ', '') === staffFilter
    return matchesSearch && matchesFilter
  })

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = taskFilter === 'all' || task.status.toLowerCase().replace(' ', '') === taskFilter
    return matchesSearch && matchesFilter
  })

  const filteredShifts = shifts.filter(shift => {
    const matchesFilter = scheduleFilter === 'all' || shift.position.toLowerCase().includes(scheduleFilter.toLowerCase())
    return matchesFilter
  })

  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch = incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         incident.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = incidentFilter === 'all' || incident.severity.toLowerCase() === incidentFilter
    return matchesSearch && matchesFilter
  })

  const filteredMessages = messages.filter(message => 
    message.channel === selectedChannel
  )

  // Event handlers
  const handleSendMessage = () => {
    if (newMessage.trim()) {
      sendMessage({
        senderId: currentUser.id,
        senderName: currentUser.name,
        channel: selectedChannel as 'General' | 'Security' | 'Operations' | 'Emergency' | 'Management',
        content: newMessage,
        priority: 'Normal'
      })
      setNewMessage('')
    }
  }

  const handleAddStaff = () => {
    // This would open a modal or form for adding new staff
    console.log('Add staff functionality')
  }

  const handleAddTask = () => {
    // This would open a modal or form for adding new task
    console.log('Add task functionality')
  }

  const handleAddShift = () => {
    // This would open a modal or form for adding new shift
    console.log('Add shift functionality')
  }

  const handleReportIncident = () => {
    // This would open a modal or form for reporting incident
    console.log('Report incident functionality')
  }

  // Helper functions for dashboard statistics
  const getActiveStaff = () => {
    return staffMembers.filter(staff => staff.status === 'Active')
  }

  const getActiveTasks = () => {
    return tasks.filter(task => task.status === 'In Progress' || task.status === 'Pending')
  }

  const getTodayShifts = () => {
    const today = new Date().toISOString().split('T')[0]
    return shifts.filter(shift => shift.date === today)
  }

  const getOpenIncidents = () => {
    return incidents.filter(incident => incident.status === 'Open' || incident.status === 'In Progress')
  }

  // Dashboard statistics
  const dashboardStats = {
    totalStaff: staffMembers.length,
    activeStaff: getActiveStaff().length,
    activeTasks: getActiveTasks().length,
    todayShifts: getTodayShifts().length,
    openIncidents: getOpenIncidents().length
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-red-100 text-red-800'
      case 'Staff Manager': return 'bg-blue-100 text-blue-800'
      case 'Staff Member': return 'bg-green-100 text-green-800'
      case 'Volunteer': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-red-100 text-red-800'
      case 'High': return 'bg-orange-100 text-orange-800'
      case 'Medium': return 'bg-yellow-100 text-yellow-800'
      case 'Low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': case 'Resolved': case 'Confirmed': return 'bg-green-100 text-green-800'
      case 'In Progress': case 'Open': return 'bg-blue-100 text-blue-800'
      case 'Pending': case 'Scheduled': return 'bg-yellow-100 text-yellow-800'
      case 'Cancelled': case 'Closed': case 'No Show': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const StaffDashboard = () => (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.totalStaff}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardStats.activeStaff} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardStats.activeTasks}
            </div>
            <p className="text-xs text-muted-foreground">
              {tasks.filter(t => t.priority === 'Critical' || t.priority === 'High').length} high priority
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Shifts</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardStats.todayShifts}
            </div>
            <p className="text-xs text-muted-foreground">
              {shifts.filter(s => s.date === '2025-03-15' && s.status === 'Confirmed').length} confirmed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardStats.openIncidents}
            </div>
            <p className="text-xs text-muted-foreground">
              {incidents.filter(i => i.severity === 'Critical' || i.severity === 'High').length} high severity
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Tasks</CardTitle>
            <CardDescription>Latest task assignments and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {filteredTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{task.title}</h4>
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Due: {new Date(task.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className={getStatusColor(task.status)}>
                      {task.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team Messages</CardTitle>
            <CardDescription>Latest team communications</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {filteredMessages.slice(0, 5).map((message) => (
                  <div key={message.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{message.senderName}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{message.channel}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm">{message.content}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Staff Coordination</h1>
          <p className="text-muted-foreground">
            Manage staff, assignments, schedules, and team communication
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button onClick={handleAddStaff}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Staff
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <StaffDashboard />
        </TabsContent>

        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <CardTitle>Staff Management</CardTitle>
              <CardDescription>
                Manage staff members, roles, and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input 
                      placeholder="Search staff..." 
                      className="max-w-sm" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={staffFilter} onValueChange={setStaffFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="staffmanager">Staff Manager</SelectItem>
                      <SelectItem value="staffmember">Staff Member</SelectItem>
                      <SelectItem value="volunteer">Volunteer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4">
                  {filteredStaff.map((staff) => (
                    <Card key={staff.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={staff.avatar} alt={staff.name} />
                              <AvatarFallback>
                                {staff.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-medium">{staff.name}</h3>
                              <p className="text-sm text-muted-foreground">{staff.email}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className={getRoleColor(staff.role)}>
                                  {staff.role}
                                </Badge>
                                <Badge variant="outline">{staff.department}</Badge>
                                <Badge className={getStatusColor(staff.status)}>
                                  {staff.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Task Management</CardTitle>
              <CardDescription>
                Assign and track tasks for staff members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Input 
                      placeholder="Search tasks..." 
                      className="max-w-sm" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Select value={taskFilter} onValueChange={setTaskFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="inprogress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddTask}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Task
                  </Button>
                </div>

                <div className="grid gap-4">
                  {filteredTasks.map((task) => (
                    <Card key={task.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-medium">{task.title}</h3>
                              <Badge className={getPriorityColor(task.priority)}>
                                {task.priority}
                              </Badge>
                              <Badge className={getStatusColor(task.status)}>
                                {task.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {task.description}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                              <span>Category: {task.category}</span>
                              {task.location && <span>Location: {task.location}</span>}
                              {task.estimatedHours && <span>Est: {task.estimatedHours}h</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle>Staff Schedule</CardTitle>
              <CardDescription>
                Manage staff shifts and scheduling
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Input type="date" className="max-w-sm" defaultValue="2025-03-15" />
                    <Select value={scheduleFilter} onValueChange={setScheduleFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filter by position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Positions</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="security">Security</SelectItem>
                        <SelectItem value="service">Customer Service</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddShift}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Shift
                  </Button>
                </div>

                <div className="grid gap-4">
                  {filteredShifts.map((shift) => {
                    const staff = staffMembers.find(s => s.id === shift.staffId)
                    return (
                      <Card key={shift.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Avatar className="w-10 h-10">
                                <AvatarImage src={staff?.avatar} alt={staff?.name} />
                                <AvatarFallback>
                                  {staff?.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h3 className="font-medium">{staff?.name}</h3>
                                <p className="text-sm text-muted-foreground">{shift.position}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline">{shift.location}</Badge>
                                  <Badge className={getStatusColor(shift.status)}>
                                    {shift.status}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {shift.startTime} - {shift.endTime}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(shift.date).toLocaleDateString()}
                              </div>
                              {shift.breakTime && (
                                <div className="text-xs text-muted-foreground">
                                  Break: {shift.breakTime}min
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents">
          <Card>
            <CardHeader>
              <CardTitle>Incident Reports</CardTitle>
              <CardDescription>
                Track and manage incident reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Input 
                      placeholder="Search incidents..." 
                      className="max-w-sm" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Select value={incidentFilter} onValueChange={setIncidentFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filter by severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severity</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleReportIncident}>
                    <Plus className="h-4 w-4 mr-2" />
                    Report Incident
                  </Button>
                </div>

                <div className="grid gap-4">
                  {filteredIncidents.map((incident) => {
                    const reporter = staffMembers.find(s => s.id === incident.reportedBy)
                    return (
                      <Card key={incident.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-medium">{incident.title}</h3>
                                <Badge className={getPriorityColor(incident.severity)}>
                                  {incident.severity}
                                </Badge>
                                <Badge className={getStatusColor(incident.status)}>
                                  {incident.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {incident.description}
                              </p>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>Reporter: {reporter?.name}</span>
                                <span>Category: {incident.category}</span>
                                <span>Location: {incident.location}</span>
                                <span>Time: {new Date(incident.timestamp).toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Team Communication</CardTitle>
              <CardDescription>
                Internal messaging and announcements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Select value={selectedChannel} onValueChange={(value) => setSelectedChannel(value as 'General' | 'Security' | 'Operations' | 'Emergency' | 'Management')}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="General">General</SelectItem>
                      <SelectItem value="Operations">Operations</SelectItem>
                      <SelectItem value="Security">Security</SelectItem>
                      <SelectItem value="Emergency">Emergency</SelectItem>
                      <SelectItem value="Management">Management</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex-1">
                    <Input 
                      placeholder="Type your message..." 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                  </div>
                  <Button onClick={handleSendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {filteredMessages.map((message) => (
                      <Card key={message.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{message.senderName}</span>
                              <Badge variant="outline">{message.channel}</Badge>
                              {message.priority !== 'Normal' && (
                                <Badge className={getPriorityColor(message.priority)}>
                                  {message.priority}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(message.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">{message.content}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default StaffCoordination