import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Checkbox } from './ui/checkbox'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { 
  User, 
  // Mail,
  // Phone,
  // Calendar, 
  CreditCard, 
  Shield, 
  CheckCircle,
  AlertCircle,
  QrCode,
  Download,
  Smartphone
} from 'lucide-react'
import { useTicketStore } from '../stores/ticketStore'

interface TicketType {
  id: string
  name: string
  description: string
  price: number
  currency: 'IDR' | 'USD'
  features: string[]
  available: boolean
  early_bird?: boolean
  discount_percentage?: number
}

interface AttendeeData {
  firstName: string
  lastName: string
  email: string
  phone: string
  dateOfBirth: string
  emergencyContact: string
  emergencyPhone: string
  dietaryRestrictions: string
  accessibilityNeeds: string
  agreeToTerms: boolean
  agreeToMarketing: boolean
  selectedTicketType: string
}

const AttendeeRegistration: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registrationComplete, setRegistrationComplete] = useState(false)
  const [generatedTicket, setGeneratedTicket] = useState<string | null>(null)
  
  const { addPurchase } = useTicketStore()

  const [attendeeData, setAttendeeData] = useState<AttendeeData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    emergencyContact: '',
    emergencyPhone: '',
    dietaryRestrictions: '',
    accessibilityNeeds: '',
    agreeToTerms: false,
    agreeToMarketing: false,
    selectedTicketType: ''
  })

  const [errors, setErrors] = useState<Partial<AttendeeData>>({})

  // Mock ticket types
  const ticketTypes: TicketType[] = [
    {
      id: 'general',
      name: 'General Admission',
      description: 'Standard event access',
      price: 150000,
      currency: 'IDR',
      features: [
        'Event access for 2 days',
        'Access to all public areas',
        'Event guidebook',
        'Basic customer support'
      ],
      available: true
    },
    {
      id: 'premium',
      name: 'Premium Pass',
      description: 'Enhanced experience with exclusive access',
      price: 300000,
      currency: 'IDR',
      features: [
        'All General Admission benefits',
        'Priority entry',
        'Access to VIP lounge',
        'Exclusive merchandise',
        'Meet & greet opportunities',
        'Premium customer support'
      ],
      available: true,
      early_bird: true,
      discount_percentage: 15
    },
    {
      id: 'vip',
      name: 'VIP Experience',
      description: 'Ultimate convention experience',
      price: 500000,
      currency: 'IDR',
      features: [
        'All Premium Pass benefits',
        'Reserved seating at events',
        'Complimentary refreshments',
        'Exclusive VIP events',
        'Personal concierge service',
        'Professional photo opportunities'
      ],
      available: true
    }
  ]

  const formatPrice = (price: number, currency: string) => {
    if (currency === 'IDR') {
      return `Rp ${price.toLocaleString('id-ID')}`
    }
    return `$${price.toLocaleString('en-US')}`
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<AttendeeData> = {}

    if (step === 1) {
      if (!attendeeData.firstName.trim()) newErrors.firstName = 'First name is required'
      if (!attendeeData.lastName.trim()) newErrors.lastName = 'Last name is required'
      if (!attendeeData.email.trim()) {
        newErrors.email = 'Email is required'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendeeData.email)) {
        newErrors.email = 'Please enter a valid email address'
      }
      if (!attendeeData.phone.trim()) newErrors.phone = 'Phone number is required'
      if (!attendeeData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required'
    }

    if (step === 2) {
      if (!attendeeData.selectedTicketType) {
        alert('Please select a ticket type')
        return false
      }
    }

    if (step === 3) {
      if (!attendeeData.agreeToTerms) {
        alert('You must agree to the terms and conditions')
        return false
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1)
  }

  const handleSubmit = async () => {
    if (!validateStep(3)) return

    setIsSubmitting(true)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Generate ticket
      const ticketId = `TICKET-${Date.now()}`
      const selectedTicket = ticketTypes.find(t => t.id === attendeeData.selectedTicketType)
      
      if (selectedTicket) {
        addPurchase({
          id: ticketId,
          ticket_type_id: selectedTicket.id,
          attendee_name: `${attendeeData.firstName} ${attendeeData.lastName}`,
          attendee_email: attendeeData.email,
          attendee_phone: attendeeData.phone,
          quantity: 1,
          total_price_idr: selectedTicket.currency === 'IDR' ? selectedTicket.price : 0,
          total_price_usd: selectedTicket.currency === 'USD' ? selectedTicket.price : 0,
          currency: selectedTicket.currency,
          payment_status: 'paid',
          qr_code: `QR-${ticketId}`,
          purchase_date: new Date().toISOString(),
          valid_from: new Date().toISOString(),
          valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          is_used: false
        })
      }
      
      setGeneratedTicket(ticketId)
      setRegistrationComplete(true)
    } catch (error) {
      console.error('Registration failed:', error)
      alert('Registration failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof AttendeeData, value: string | boolean) => {
    setAttendeeData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  if (registrationComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Registration Complete!</CardTitle>
            <CardDescription>
              Your ticket has been generated successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <QrCode className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Ticket ID:</strong> {generatedTicket}</p>
                  <p><strong>Email:</strong> {attendeeData.email}</p>
                  <p>A confirmation email has been sent with your digital ticket.</p>
                </div>
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Button className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Ticket
              </Button>
              <Button variant="outline" className="w-full">
                <Smartphone className="h-4 w-4 mr-2" />
                Add to Wallet
              </Button>
            </div>
            
            <div className="text-center text-sm text-gray-600">
              <p>Save this ticket to your device for event entry</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                  currentStep >= step 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {step}
                </div>
                <div className="ml-2 text-sm">
                  {step === 1 && 'Personal Info'}
                  {step === 2 && 'Ticket Selection'}
                  {step === 3 && 'Review & Payment'}
                </div>
                {step < 3 && (
                  <div className={`ml-8 w-16 h-1 ${
                    currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Attendee Registration</span>
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && 'Please provide your personal information'}
              {currentStep === 2 && 'Choose your ticket type'}
              {currentStep === 3 && 'Review your information and complete registration'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={attendeeData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      className={errors.firstName ? 'border-red-500' : ''}
                    />
                    {errors.firstName && (
                      <p className="text-sm text-red-600 mt-1">{errors.firstName}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={attendeeData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      className={errors.lastName ? 'border-red-500' : ''}
                    />
                    {errors.lastName && (
                      <p className="text-sm text-red-600 mt-1">{errors.lastName}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={attendeeData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-600 mt-1">{errors.email}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      value={attendeeData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className={errors.phone ? 'border-red-500' : ''}
                    />
                    {errors.phone && (
                      <p className="text-sm text-red-600 mt-1">{errors.phone}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={attendeeData.dateOfBirth}
                      onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                      className={errors.dateOfBirth ? 'border-red-500' : ''}
                    />
                    {errors.dateOfBirth && (
                      <p className="text-sm text-red-600 mt-1">{errors.dateOfBirth}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="emergencyContact">Emergency Contact Name</Label>
                    <Input
                      id="emergencyContact"
                      value={attendeeData.emergencyContact}
                      onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyPhone">Emergency Contact Phone</Label>
                    <Input
                      id="emergencyPhone"
                      value={attendeeData.emergencyPhone}
                      onChange={(e) => handleInputChange('emergencyPhone', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="dietaryRestrictions">Dietary Restrictions</Label>
                  <Textarea
                    id="dietaryRestrictions"
                    value={attendeeData.dietaryRestrictions}
                    onChange={(e) => handleInputChange('dietaryRestrictions', e.target.value)}
                    placeholder="Please list any dietary restrictions or allergies"
                  />
                </div>

                <div>
                  <Label htmlFor="accessibilityNeeds">Accessibility Needs</Label>
                  <Textarea
                    id="accessibilityNeeds"
                    value={attendeeData.accessibilityNeeds}
                    onChange={(e) => handleInputChange('accessibilityNeeds', e.target.value)}
                    placeholder="Please describe any accessibility accommodations needed"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Ticket Selection */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {ticketTypes.map((ticket) => (
                    <Card 
                      key={ticket.id} 
                      className={`cursor-pointer transition-all ${
                        attendeeData.selectedTicketType === ticket.id 
                          ? 'ring-2 ring-blue-500 bg-blue-50' 
                          : 'hover:shadow-lg'
                      } ${!ticket.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => ticket.available && handleInputChange('selectedTicketType', ticket.id)}
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{ticket.name}</CardTitle>
                            {ticket.early_bird && (
                              <Badge className="mt-1">Early Bird - {ticket.discount_percentage}% Off</Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">
                              {formatPrice(ticket.price, ticket.currency)}
                            </div>
                            {ticket.early_bird && ticket.discount_percentage && (
                              <div className="text-sm text-gray-500 line-through">
                                {formatPrice(Math.round(ticket.price / (1 - ticket.discount_percentage / 100)), ticket.currency)}
                              </div>
                            )}
                          </div>
                        </div>
                        <CardDescription>{ticket.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {ticket.features.map((feature, index) => (
                            <li key={index} className="flex items-center text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                        {!ticket.available && (
                          <div className="mt-4 text-center">
                            <Badge variant="secondary">Sold Out</Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Review & Payment */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Registration Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Registration Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Attendee</p>
                        <p className="font-semibold">{attendeeData.firstName} {attendeeData.lastName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p>{attendeeData.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Phone</p>
                        <p>{attendeeData.phone}</p>
                      </div>
                      {attendeeData.selectedTicketType && (
                        <div>
                          <p className="text-sm text-gray-600">Ticket Type</p>
                          <p className="font-semibold">
                            {ticketTypes.find(t => t.id === attendeeData.selectedTicketType)?.name}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Payment Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Payment Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {attendeeData.selectedTicketType && (() => {
                        const selectedTicket = ticketTypes.find(t => t.id === attendeeData.selectedTicketType)
                        if (!selectedTicket) return null
                        
                        return (
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span>{selectedTicket.name}</span>
                              <span>{formatPrice(selectedTicket.price, selectedTicket.currency)}</span>
                            </div>
                            {selectedTicket.early_bird && selectedTicket.discount_percentage && (
                              <div className="flex justify-between text-green-600">
                                <span>Early Bird Discount ({selectedTicket.discount_percentage}%)</span>
                                <span>-{formatPrice(
                                  Math.round(selectedTicket.price * selectedTicket.discount_percentage / 100), 
                                  selectedTicket.currency
                                )}</span>
                              </div>
                            )}
                            <div className="border-t pt-3">
                              <div className="flex justify-between font-bold text-lg">
                                <span>Total</span>
                                <span>{formatPrice(selectedTicket.price, selectedTicket.currency)}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </CardContent>
                  </Card>
                </div>

                {/* Terms and Conditions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Shield className="h-5 w-5" />
                      <span>Terms and Conditions</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="agreeToTerms"
                        checked={attendeeData.agreeToTerms}
                        onCheckedChange={(checked) => handleInputChange('agreeToTerms', checked as boolean)}
                      />
                      <div className="text-sm">
                        <Label htmlFor="agreeToTerms" className="cursor-pointer">
                          I agree to the <a href="#" className="text-blue-600 hover:underline">Terms and Conditions</a> and <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a> *
                        </Label>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="agreeToMarketing"
                        checked={attendeeData.agreeToMarketing}
                        onCheckedChange={(checked) => handleInputChange('agreeToMarketing', checked as boolean)}
                      />
                      <div className="text-sm">
                        <Label htmlFor="agreeToMarketing" className="cursor-pointer">
                          I would like to receive marketing communications about future events
                        </Label>
                      </div>
                    </div>

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Important:</strong> Tickets are non-refundable. Please review all information carefully before completing your registration.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t">
              <Button 
                variant="outline" 
                onClick={handlePrevious}
                disabled={currentStep === 1}
              >
                Previous
              </Button>
              
              {currentStep < 3 ? (
                <Button onClick={handleNext}>
                  Next
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit}
                  disabled={isSubmitting || !attendeeData.agreeToTerms}
                  className="min-w-[120px]"
                >
                  {isSubmitting ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <CreditCard className="h-4 w-4" />
                      <span>Complete Registration</span>
                    </div>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default AttendeeRegistration