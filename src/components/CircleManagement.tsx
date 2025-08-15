import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Textarea } from './ui/textarea'
import { Search, Eye, CheckCircle, XCircle, Clock, Users, FileText, Mail, MapPin, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import type { Circle } from '../lib/supabase'

interface CircleWithDetails extends Circle {
  event_name?: string
}

const CircleManagement: React.FC = () => {
  const [circles, setCircles] = useState<CircleWithDetails[]>([])
  const [filteredCircles, setFilteredCircles] = useState<CircleWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedCircle, setSelectedCircle] = useState<CircleWithDetails | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [, setIsReviewDialogOpen] = useState(false)

  useEffect(() => {
    fetchCircles()
  }, [])

  useEffect(() => {
    filterCircles()
  }, [circles, searchTerm, statusFilter])

  const fetchCircles = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('circles')
        .select(`
          *,
          events!inner(name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const circlesWithEventName = data?.map(circle => ({
        ...circle,
        event_name: circle.events?.name
      })) || []

      setCircles(circlesWithEventName)
    } catch (error) {
      console.error('Error fetching circles:', error)
      toast.error('Failed to load circle applications')
    } finally {
      setLoading(false)
    }
  }

  const filterCircles = () => {
    let filtered = circles

    if (searchTerm) {
      filtered = filtered.filter(circle => 
        circle.circle_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        circle.pen_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        circle.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(circle => circle.application_status === statusFilter)
    }

    setFilteredCircles(filtered)
  }

  const updateCircleStatus = async (circleId: string, newStatus: string, notes?: string) => {
    try {
      const { error } = await supabase
        .from('circles')
        .update({ 
          application_status: newStatus,
          notes: notes || null,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', circleId)

      if (error) throw error

      await fetchCircles()
      toast.success(`Circle application ${newStatus}`)
      setIsReviewDialogOpen(false)
      setSelectedCircle(null)
      setReviewNotes('')
    } catch (error) {
      console.error('Error updating circle status:', error)
      toast.error('Failed to update circle status')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: 'outline' as const, icon: Clock, color: 'text-yellow-600' },
      approved: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
      rejected: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
      under_review: { variant: 'secondary' as const, icon: Eye, color: 'text-blue-600' }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${config.color}`} />
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    )
  }

  const getStats = () => {
    const stats = {
      total: circles.length,
      pending: circles.filter(c => c.application_status === 'pending').length,
      approved: circles.filter(c => c.application_status === 'accepted').length,
      rejected: circles.filter(c => c.application_status === 'rejected').length,
      under_review: circles.filter(c => c.application_status === 'under_review').length
    }
    return stats
  }

  const stats = getStats()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading circle applications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Circle Management</h1>
          <p className="text-muted-foreground">Review and manage circle applications</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Applications</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Under Review</p>
                <p className="text-2xl font-bold text-blue-600">{stats.under_review}</p>
              </div>
              <Eye className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Circles</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by circle name, representative, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Label htmlFor="status-filter">Filter by Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Circle Applications List */}
      <div className="grid gap-4">
        {filteredCircles.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Applications Found</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== 'all' 
                  ? 'No circle applications match your current filters.'
                  : 'No circle applications have been submitted yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredCircles.map((circle) => (
            <Card key={circle.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-semibold">{circle.circle_name}</h3>
                        <p className="text-sm text-muted-foreground">{circle.event_name}</p>
                      </div>
                      {getStatusBadge(circle.application_status || 'pending')}
                    </div>
                    
                    <p className="text-muted-foreground line-clamp-2">{circle.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{circle.pen_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{circle.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{circle.space_preference}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(circle.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedCircle(circle)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{circle.circle_name}</DialogTitle>
                          <DialogDescription>
                            Circle application details and review
                          </DialogDescription>
                        </DialogHeader>
                        
                        {selectedCircle && (
                          <Tabs defaultValue="details" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="details">Application Details</TabsTrigger>
                              <TabsTrigger value="review">Review &amp; Actions</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="details" className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <Label className="font-semibold">Circle Name</Label>
                                  <p>{selectedCircle.circle_name}</p>
                                </div>
                                <div>
                                  <Label className="font-semibold">Representative</Label>
                                  <p>{selectedCircle.pen_name}</p>
                                </div>
                                <div>
                                  <Label className="font-semibold">Email</Label>
                                  <p>{selectedCircle.email}</p>
                                </div>
                                <div>
                                  <Label className="font-semibold">Phone</Label>
                                  <p>{selectedCircle.phone || 'Not provided'}</p>
                                </div>
                                <div>
                                  <Label className="font-semibold">Address</Label>
                                  <p>{selectedCircle.address}</p>
                                </div>
                                <div>
                                  <Label className="font-semibold">Booth Preference</Label>
                                  <p>{selectedCircle.space_preference}</p>
                                </div>
                                <div>
                                  <Label className="font-semibold">Booth Size</Label>
                                  <p>{selectedCircle.space_size}</p>
                                </div>
                                <div>
                                  <Label className="font-semibold">Power Requirements</Label>
                                  <p>{selectedCircle.additional_power ? 'Yes' : 'No'}</p>
                                </div>
                              </div>
                              
                              <div>
                                <Label className="font-semibold">Circle Description</Label>
                                <p className="mt-1">{selectedCircle.description}</p>
                              </div>
                              
                              <div>
                                <Label className="font-semibold">Work Description</Label>
                                <p className="mt-1">{selectedCircle.works_description}</p>
                              </div>
                              
                              {selectedCircle.special_requests && (
                                <div>
                                  <Label className="font-semibold">Special Requests</Label>
                                  <p className="mt-1">{selectedCircle.special_requests}</p>
                                </div>
                              )}
                              
                              {selectedCircle.sample_works_images && selectedCircle.sample_works_images.length > 0 && (
                <div>
                  <Label className="font-semibold">Sample Works</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {selectedCircle.sample_works_images.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Sample work ${index + 1}`}
                        className="w-full h-32 object-cover rounded border"
                      />
                    ))}
                  </div>
                </div>
              )}
                            </TabsContent>
                            
                            <TabsContent value="review" className="space-y-4">
                              <div>
                                <Label className="font-semibold">Current Status</Label>
                                <div className="mt-2">
                                  {getStatusBadge(selectedCircle.application_status || 'pending')}
                                </div>
                              </div>
                              
                              {selectedCircle.notes && (
                                <div>
                                  <Label className="font-semibold">Previous Review Notes</Label>
                                  <p className="mt-1 p-3 bg-muted rounded">{selectedCircle.notes}</p>
                                </div>
                              )}
                              
                              <div>
                                <Label htmlFor="review-notes">Review Notes</Label>
                                <Textarea
                                  id="review-notes"
                                  placeholder="Add notes about this application..."
                                  value={reviewNotes}
                                  onChange={(e) => setReviewNotes(e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                              
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  onClick={() => updateCircleStatus(selectedCircle.id, 'under_review', reviewNotes)}
                                  variant="secondary"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Mark Under Review
                                </Button>
                                <Button
                                  onClick={() => updateCircleStatus(selectedCircle.id, 'approved', reviewNotes)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>
                                <Button
                                  onClick={() => updateCircleStatus(selectedCircle.id, 'rejected', reviewNotes)}
                                  variant="destructive"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </div>
                            </TabsContent>
                          </Tabs>
                        )}
                      </DialogContent>
                    </Dialog>
                    
                    {circle.application_status === 'pending' && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateCircleStatus(circle.id, 'under_review')}
                        >
                          Review
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => updateCircleStatus(circle.id, 'approved')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

export default CircleManagement