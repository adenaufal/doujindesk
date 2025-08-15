import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Badge } from './ui/badge'
import { Checkbox } from './ui/checkbox'
import { Textarea } from './ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Progress } from './ui/progress'
import { Separator } from './ui/separator'
import { ScrollArea } from './ui/scroll-area'
import { useTicketStore, TicketType, TicketPurchase } from '../stores/ticketStore'
import { useToast } from '../hooks/use-toast'
import PaymentProcessor from './PaymentProcessor'
import TicketScanner from './TicketScanner'
import {
  CreditCard,
  Plus,
  Edit,
  Trash2,
  Eye,
  Settings,
  Ticket,
  DollarSign,
  UserCheck
} from 'lucide-react'

const TicketingSystem: React.FC = () => {
  const {
    ticketTypes,
    purchases,
    salesStats,
    currency,
    setCurrency,
    // exchangeRate,
    getActiveTicketTypes,
    addPurchase,
    calculateTicketPrice,
    // validateTicket,
    generateQRCode,
    updateSalesStats,
    addTicketType,
    // updateTicketType,
    // deleteTicketType - removed unused
  } = useTicketStore()
  
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('sales')
  const [selectedTicketType, setSelectedTicketType] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [scannerMode, setScannerMode] = useState<'entry' | 'exit'>('entry')
  const [attendeeInfo, setAttendeeInfo] = useState({
    name: '',
    email: '',
    phone: '',
    age: '',
    idNumber: '',
    isPwd: false,
    isChild: false
  })

  // const [scannedCode] = useState('')
  // const [, setValidationResult] = useState<{
  //   isValid: boolean
  //   message: string
  //   ticket?: any
  // } | null>(null)
  
  // New ticket type form
  const [newTicketForm, setNewTicketForm] = useState({
    name: '',
    description: '',
    price_idr: 0,
    price_usd: 0,
    category: 'single_day' as 'weekend' | 'single_day' | 'vip' | 'special',
    day: 'saturday' as 'saturday' | 'sunday' | 'both',
    max_quantity: 1000,
    benefits: [''],
    requires_id: false
  })
  
  useEffect(() => {
    updateSalesStats()
  }, [purchases, updateSalesStats])
  
  const handlePurchaseTicket = async () => {
    if (!selectedTicketType || !attendeeInfo.name || !attendeeInfo.email) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }
    setShowPaymentDialog(true)
  }

  const handlePaymentComplete = (paymentId: string) => {
    const pricing = calculateTicketPrice(selectedTicketType, quantity, {
      isPwd: attendeeInfo.isPwd,
      isChild: attendeeInfo.isChild,
      age: attendeeInfo.age ? parseInt(attendeeInfo.age) : undefined
    })
    
    const purchaseId = `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const qrCode = generateQRCode(purchaseId)
    
    const purchase: TicketPurchase = {
      id: purchaseId,
      ticket_type_id: selectedTicketType,
      attendee_name: attendeeInfo.name,
      attendee_email: attendeeInfo.email,
      attendee_phone: attendeeInfo.phone,
      attendee_age: attendeeInfo.age ? parseInt(attendeeInfo.age) : undefined,
      attendee_id_number: attendeeInfo.idNumber,
      quantity,
      total_price_idr: pricing.price_idr,
      total_price_usd: pricing.price_usd,
      currency,
      discount_applied: pricing.discount_applied,
      payment_status: 'paid',
      payment_reference: paymentId,
      qr_code: qrCode,
      purchase_date: new Date().toISOString(),
      valid_from: new Date().toISOString(),
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Valid for 7 days
      is_used: false
    }
    
    addPurchase(purchase)
    
    toast({
      title: "Ticket Purchased Successfully!",
      description: `QR Code: ${qrCode}`,
    })
    
    // Reset form
    setAttendeeInfo({
      name: '',
      email: '',
      phone: '',
      age: '',
      idNumber: '',
      isPwd: false,
      isChild: false
    })
    setQuantity(1)
    setSelectedTicketType('')
    setShowPaymentDialog(false)
  }
  

  
  const handleAddTicketType = () => {
    if (!newTicketForm.name || !newTicketForm.description) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }
    
    const newTicket: TicketType = {
      id: `ticket_type_${Date.now()}`,
      ...newTicketForm,
      benefits: newTicketForm.benefits.filter(b => b.trim() !== ''),
      available_quantity: newTicketForm.max_quantity,
      is_active: true,
      age_restriction: 'all_ages'
    }
    
    addTicketType(newTicket)
    
    toast({
      title: "Ticket Type Added",
      description: `${newTicket.name} has been created successfully`
    })
    
    // Reset form
    setNewTicketForm({
      name: '',
      description: '',
      price_idr: 0,
      price_usd: 0,
      category: 'single_day',
      day: 'saturday',
      max_quantity: 1000,
      benefits: [''],
      requires_id: false
    })
  }
  
  const formatCurrency = (amount: number, curr: 'IDR' | 'USD') => {
    if (curr === 'IDR') {
      return `Rp ${amount.toLocaleString('id-ID')}`
    }
    return `$${amount.toFixed(2)}`
  }
  
  const activeTicketTypes = getActiveTicketTypes()
  const selectedTicket = ticketTypes.find(t => t.id === selectedTicketType)
  const pricing = selectedTicket ? calculateTicketPrice(selectedTicketType, quantity, {
    isPwd: attendeeInfo.isPwd,
    isChild: attendeeInfo.isChild,
    age: attendeeInfo.age ? parseInt(attendeeInfo.age) : undefined
  }) : null
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ticketing System</h1>
          <p className="text-muted-foreground">
            Manage ticket sales, validation, and analytics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={currency} onValueChange={(value: 'IDR' | 'USD') => setCurrency(value)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IDR">IDR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline">
            {formatCurrency(currency === 'IDR' ? salesStats.total_sales_idr : salesStats.total_sales_usd, currency)} Total Sales
          </Badge>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets Sold</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesStats.total_tickets_sold}</div>
            <p className="text-xs text-muted-foreground">
              Across all ticket types
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(currency === 'IDR' ? salesStats.total_sales_idr : salesStats.total_sales_usd, currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total revenue generated
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Ticket Types</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTicketTypes.length}</div>
            <p className="text-xs text-muted-foreground">
              Available for purchase
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Validation Rate</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {purchases.length > 0 ? Math.round((purchases.filter(p => p.is_used).length / purchases.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Tickets validated
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Ticket Sales</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="management">Management</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        {/* Ticket Sales Tab */}
        <TabsContent value="sales" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Purchase Form */}
            <Card>
              <CardHeader>
                <CardTitle>Purchase Tickets</CardTitle>
                <CardDescription>
                  Select ticket type and enter attendee information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ticket-type">Ticket Type</Label>
                  <Select value={selectedTicketType} onValueChange={setSelectedTicketType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a ticket type" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeTicketTypes.map((ticket) => (
                        <SelectItem key={ticket.id} value={ticket.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{ticket.name}</span>
                            <span className="ml-2 text-sm text-muted-foreground">
                              {formatCurrency(currency === 'IDR' ? ticket.price_idr : ticket.price_usd, currency)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedTicket && (
                  <Card className="p-4 bg-muted/50">
                    <div className="space-y-2">
                      <h4 className="font-medium">{selectedTicket.name}</h4>
                      <p className="text-sm text-muted-foreground">{selectedTicket.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedTicket.benefits.map((benefit, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {benefit}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Available: {selectedTicket.available_quantity}</span>
                        <span className="font-medium">
                          {formatCurrency(currency === 'IDR' ? selectedTicket.price_idr : selectedTicket.price_usd, currency)}
                        </span>
                      </div>
                    </div>
                  </Card>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max="10"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="font-medium">Attendee Information</h4>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={attendeeInfo.name}
                        onChange={(e) => setAttendeeInfo(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter full name"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={attendeeInfo.email}
                        onChange={(e) => setAttendeeInfo(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Enter email address"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={attendeeInfo.phone}
                        onChange={(e) => setAttendeeInfo(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="Enter phone number"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="age">Age</Label>
                      <Input
                        id="age"
                        type="number"
                        value={attendeeInfo.age}
                        onChange={(e) => setAttendeeInfo(prev => ({ ...prev, age: e.target.value }))}
                        placeholder="Enter age"
                      />
                    </div>
                  </div>
                  
                  {selectedTicket?.requires_id && (
                    <div className="space-y-2">
                      <Label htmlFor="id-number">ID Number *</Label>
                      <Input
                        id="id-number"
                        value={attendeeInfo.idNumber}
                        onChange={(e) => setAttendeeInfo(prev => ({ ...prev, idNumber: e.target.value }))}
                        placeholder="Enter ID number"
                      />
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="pwd"
                        checked={attendeeInfo.isPwd}
                        onCheckedChange={(checked) => setAttendeeInfo(prev => ({ ...prev, isPwd: checked as boolean }))}
                      />
                      <Label htmlFor="pwd" className="text-sm">
                        Person with Disability (20% discount)
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="child"
                        checked={attendeeInfo.isChild}
                        onCheckedChange={(checked) => setAttendeeInfo(prev => ({ ...prev, isChild: checked as boolean }))}
                      />
                      <Label htmlFor="child" className="text-sm">
                        Child under 12 (50% discount)
                      </Label>
                    </div>
                  </div>
                </div>
                
                {pricing && (
                  <Card className="p-4 bg-primary/5">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(currency === 'IDR' ? pricing.price_idr : pricing.price_usd, currency)}</span>
                      </div>
                      {pricing.discount_applied && (
                        <div className="flex justify-between items-center text-green-600">
                          <span>Discount ({pricing.discount_applied.percentage}%):</span>
                          <span>-{formatCurrency(pricing.discount_applied.amount, currency)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between items-center font-medium text-lg">
                        <span>Total:</span>
                        <span>{formatCurrency(currency === 'IDR' ? pricing.price_idr : pricing.price_usd, currency)}</span>
                      </div>
                    </div>
                  </Card>
                )}
                
                <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={handlePurchaseTicket} 
                      className="w-full" 
                      size="lg"
                      disabled={!selectedTicketType || !attendeeInfo.name || !attendeeInfo.email}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Purchase Ticket
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Complete Purchase</DialogTitle>
                      <DialogDescription>
                        Secure payment processing for your tickets
                      </DialogDescription>
                    </DialogHeader>
                    {selectedTicketType && (
                      <PaymentProcessor
                        ticketTypeId={selectedTicketType}
                        quantity={quantity}
                        onPaymentComplete={handlePaymentComplete}
                        onCancel={() => setShowPaymentDialog(false)}
                      />
                    )}
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
            
            {/* Available Ticket Types */}
            <Card>
              <CardHeader>
                <CardTitle>Available Ticket Types</CardTitle>
                <CardDescription>
                  Current ticket offerings and availability
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {activeTicketTypes.map((ticket) => (
                      <Card key={ticket.id} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">{ticket.name}</h4>
                              <p className="text-sm text-muted-foreground">{ticket.description}</p>
                            </div>
                            <Badge variant={ticket.category === 'vip' ? 'default' : 'secondary'}>
                              {ticket.category.toUpperCase()}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between text-sm">
                            <span>Price:</span>
                            <span className="font-medium">
                              {formatCurrency(currency === 'IDR' ? ticket.price_idr : ticket.price_usd, currency)}
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>Available:</span>
                              <span>{ticket.available_quantity} / {ticket.max_quantity}</span>
                            </div>
                            <Progress 
                              value={(ticket.available_quantity / ticket.max_quantity) * 100} 
                              className="h-2"
                            />
                          </div>
                          
                          <div className="flex flex-wrap gap-1">
                            {ticket.benefits.slice(0, 3).map((benefit, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {benefit}
                              </Badge>
                            ))}
                            {ticket.benefits.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{ticket.benefits.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Validation Tab */}
        <TabsContent value="validation" className="space-y-4">
          <div className="flex gap-4 mb-6">
            <Button
              variant={scannerMode === 'entry' ? 'default' : 'outline'}
              onClick={() => setScannerMode('entry')}
            >
              Entry Scanner
            </Button>
            <Button
              variant={scannerMode === 'exit' ? 'default' : 'outline'}
              onClick={() => setScannerMode('exit')}
            >
              Exit Scanner
            </Button>
          </div>
          
          <TicketScanner
            mode={scannerMode}
            gateId={`GATE_${scannerMode.toUpperCase()}_01`}
            staffId="STAFF_001"
          />
        </TabsContent>
        
        {/* Management Tab */}
        <TabsContent value="management" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Add New Ticket Type */}
            <Card>
              <CardHeader>
                <CardTitle>Add New Ticket Type</CardTitle>
                <CardDescription>
                  Create a new ticket type for the event
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-name">Name</Label>
                    <Input
                      id="new-name"
                      value={newTicketForm.name}
                      onChange={(e) => setNewTicketForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ticket name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-category">Category</Label>
                    <Select 
                      value={newTicketForm.category} 
                      onValueChange={(value: any) => setNewTicketForm(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single_day">Single Day</SelectItem>
                        <SelectItem value="weekend">Weekend</SelectItem>
                        <SelectItem value="vip">VIP</SelectItem>
                        <SelectItem value="special">Special</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-price-idr">Price (IDR)</Label>
                    <Input
                      id="new-price-idr"
                      type="number"
                      value={newTicketForm.price_idr}
                      onChange={(e) => setNewTicketForm(prev => ({ ...prev, price_idr: parseInt(e.target.value) || 0 }))}
                      placeholder="Price in IDR"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-price-usd">Price (USD)</Label>
                    <Input
                      id="new-price-usd"
                      type="number"
                      step="0.01"
                      value={newTicketForm.price_usd}
                      onChange={(e) => setNewTicketForm(prev => ({ ...prev, price_usd: parseFloat(e.target.value) || 0 }))}
                      placeholder="Price in USD"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-day">Day</Label>
                    <Select 
                      value={newTicketForm.day} 
                      onValueChange={(value: any) => setNewTicketForm(prev => ({ ...prev, day: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="saturday">Saturday</SelectItem>
                        <SelectItem value="sunday">Sunday</SelectItem>
                        <SelectItem value="both">Both Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-quantity">Max Quantity</Label>
                    <Input
                      id="new-quantity"
                      type="number"
                      value={newTicketForm.max_quantity}
                      onChange={(e) => setNewTicketForm(prev => ({ ...prev, max_quantity: parseInt(e.target.value) || 0 }))}
                      placeholder="Maximum tickets"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="new-description">Description</Label>
                  <Textarea
                    id="new-description"
                    value={newTicketForm.description}
                    onChange={(e) => setNewTicketForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Ticket description"
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Benefits</Label>
                  {newTicketForm.benefits.map((benefit, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={benefit}
                        onChange={(e) => {
                          const newBenefits = [...newTicketForm.benefits]
                          newBenefits[index] = e.target.value
                          setNewTicketForm(prev => ({ ...prev, benefits: newBenefits }))
                        }}
                        placeholder="Enter benefit"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newBenefits = newTicketForm.benefits.filter((_, i) => i !== index)
                          setNewTicketForm(prev => ({ ...prev, benefits: newBenefits }))
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewTicketForm(prev => ({ ...prev, benefits: [...prev.benefits, ''] }))}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Benefit
                  </Button>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requires-id"
                    checked={newTicketForm.requires_id}
                    onCheckedChange={(checked) => setNewTicketForm(prev => ({ ...prev, requires_id: checked as boolean }))}
                  />
                  <Label htmlFor="requires-id">Requires ID verification</Label>
                </div>
                
                <Button onClick={handleAddTicketType} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Ticket Type
                </Button>
              </CardContent>
            </Card>
            
            {/* Existing Ticket Types Management */}
            <Card>
              <CardHeader>
                <CardTitle>Manage Ticket Types</CardTitle>
                <CardDescription>
                  Edit or disable existing ticket types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {ticketTypes.map((ticket) => (
                      <Card key={ticket.id} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">{ticket.name}</h4>
                              <p className="text-sm text-muted-foreground">{ticket.description}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Price:</span>
                              <p>{formatCurrency(currency === 'IDR' ? ticket.price_idr : ticket.price_usd, currency)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Available:</span>
                              <p>{ticket.available_quantity} / {ticket.max_quantity}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Category:</span>
                              <p className="capitalize">{ticket.category}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Status:</span>
                              <Badge variant={ticket.is_active ? 'default' : 'secondary'}>
                                {ticket.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-6">
            {/* Sales Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Analytics</CardTitle>
                <CardDescription>
                  Detailed breakdown of ticket sales and revenue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(salesStats.sales_by_type).map(([typeId, stats]) => {
                    const ticketType = ticketTypes.find(t => t.id === typeId)
                    if (!ticketType) return null
                    
                    return (
                      <Card key={typeId} className="p-4">
                        <div className="space-y-2">
                          <h4 className="font-medium">{ticketType.name}</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>Sold:</span>
                              <span className="font-medium">{stats.quantity}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Revenue:</span>
                              <span className="font-medium">
                                {formatCurrency(currency === 'IDR' ? stats.revenue_idr : stats.revenue_usd, currency)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Remaining:</span>
                              <span>{ticketType.available_quantity}</span>
                            </div>
                          </div>
                          <Progress 
                            value={((ticketType.max_quantity - ticketType.available_quantity) / ticketType.max_quantity) * 100}
                            className="h-2"
                          />
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
            
            {/* Recent Purchases */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Purchases</CardTitle>
                <CardDescription>
                  Latest ticket purchases and transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {purchases.slice(-20).reverse().map((purchase) => {
                      const ticketType = ticketTypes.find(t => t.id === purchase.ticket_type_id)
                      return (
                        <div key={purchase.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{purchase.attendee_name}</p>
                            <p className="text-sm text-muted-foreground">{ticketType?.name} × {purchase.quantity}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(purchase.purchase_date).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              {formatCurrency(
                                purchase.currency === 'IDR' ? purchase.total_price_idr : purchase.total_price_usd,
                                purchase.currency
                              )}
                            </p>
                            <Badge 
                              variant={purchase.payment_status === 'paid' ? 'default' : 
                                      purchase.payment_status === 'pending' ? 'secondary' : 'destructive'}
                            >
                              {purchase.payment_status}
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default TicketingSystem