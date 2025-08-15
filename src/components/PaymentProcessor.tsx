import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Separator } from './ui/separator'
import { Badge } from './ui/badge'
import { CreditCard, Shield, Clock, CheckCircle } from 'lucide-react'
import { useTicketStore } from '../stores/ticketStore'
import { useToast } from '../hooks/use-toast'

interface PaymentProcessorProps {
  ticketTypeId: string
  quantity: number
  onPaymentComplete: (paymentId: string) => void
  onCancel: () => void
}

interface PaymentMethod {
  id: string
  name: string
  type: 'credit_card' | 'debit_card' | 'bank_transfer' | 'e_wallet'
  icon: string
  processingFee: number
}

const paymentMethods: PaymentMethod[] = [
  { id: 'visa', name: 'Visa', type: 'credit_card', icon: '💳', processingFee: 0.029 },
  { id: 'mastercard', name: 'Mastercard', type: 'credit_card', icon: '💳', processingFee: 0.029 },
  { id: 'bca', name: 'BCA Transfer', type: 'bank_transfer', icon: '🏦', processingFee: 0.007 },
  { id: 'mandiri', name: 'Mandiri Transfer', type: 'bank_transfer', icon: '🏦', processingFee: 0.007 },
  { id: 'gopay', name: 'GoPay', type: 'e_wallet', icon: '📱', processingFee: 0.015 },
  { id: 'ovo', name: 'OVO', type: 'e_wallet', icon: '📱', processingFee: 0.015 }
]

export default function PaymentProcessor({ 
  ticketTypeId, 
  quantity, 
  onPaymentComplete, 
  onCancel 
}: PaymentProcessorProps) {
  const { ticketTypes, currency } = useTicketStore()
  const { toast } = useToast()
  
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')
  const [paymentStep, setPaymentStep] = useState<'details' | 'payment' | 'processing' | 'complete'>('details')
  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    email: '',
    phone: ''
  })

  const ticketType = ticketTypes.find(t => t.id === ticketTypeId)
  if (!ticketType) return null

  const subtotal = (currency === 'IDR' ? ticketType.price_idr : ticketType.price_usd) * quantity
  const selectedMethod = paymentMethods.find(m => m.id === selectedPaymentMethod)
  const processingFee = selectedMethod ? subtotal * selectedMethod.processingFee : 0
  const total = subtotal + processingFee

  const handlePaymentSubmit = async () => {
    if (!selectedPaymentMethod) {
      toast({
        title: "Payment Method Required",
        description: "Please select a payment method to continue.",
        variant: "destructive"
      })
      return
    }

    setPaymentStep('processing')

    // Simulate payment processing
    setTimeout(() => {
      const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setPaymentStep('complete')
      
      setTimeout(() => {
        onPaymentComplete(paymentId)
        toast({
          title: "Payment Successful",
          description: `Payment of ${currency} ${total.toLocaleString()} completed successfully.`
        })
      }, 2000)
    }, 3000)
  }

  const renderPaymentDetails = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>{ticketType.name} × {quantity}</span>
            <span>{currency} {subtotal.toLocaleString()}</span>
          </div>
          {selectedMethod && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Processing Fee ({(selectedMethod.processingFee * 100).toFixed(1)}%)</span>
              <span>{currency} {processingFee.toLocaleString()}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{currency} {total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Payment Method</h3>
        <div className="grid grid-cols-2 gap-3">
          {paymentMethods.map((method) => (
            <Button
              key={method.id}
              variant={selectedPaymentMethod === method.id ? "default" : "outline"}
              className="h-auto p-4 flex flex-col items-center gap-2"
              onClick={() => setSelectedPaymentMethod(method.id)}
            >
              <span className="text-2xl">{method.icon}</span>
              <span className="text-sm">{method.name}</span>
              <Badge variant="secondary" className="text-xs">
                {(method.processingFee * 100).toFixed(1)}% fee
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {selectedMethod && selectedMethod.type === 'credit_card' && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Card Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="cardNumber">Card Number</Label>
              <Input
                id="cardNumber"
                placeholder="1234 5678 9012 3456"
                value={paymentData.cardNumber}
                onChange={(e) => setPaymentData(prev => ({ ...prev, cardNumber: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input
                id="expiryDate"
                placeholder="MM/YY"
                value={paymentData.expiryDate}
                onChange={(e) => setPaymentData(prev => ({ ...prev, expiryDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="cvv">CVV</Label>
              <Input
                id="cvv"
                placeholder="123"
                value={paymentData.cvv}
                onChange={(e) => setPaymentData(prev => ({ ...prev, cvv: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="cardholderName">Cardholder Name</Label>
              <Input
                id="cardholderName"
                placeholder="John Doe"
                value={paymentData.cardholderName}
                onChange={(e) => setPaymentData(prev => ({ ...prev, cardholderName: e.target.value }))}
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={paymentData.email}
              onChange={(e) => setPaymentData(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              placeholder="+62 812 3456 7890"
              value={paymentData.phone}
              onChange={(e) => setPaymentData(prev => ({ ...prev, phone: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handlePaymentSubmit} className="flex-1">
          <CreditCard className="h-4 w-4 mr-2" />
          Pay {currency} {total.toLocaleString()}
        </Button>
      </div>
    </div>
  )

  const renderProcessing = () => (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
      <h3 className="text-lg font-semibold mb-2">Processing Payment</h3>
      <p className="text-muted-foreground">Please wait while we process your payment...</p>
      <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
        <Shield className="h-4 w-4" />
        <span>Secured by 256-bit SSL encryption</span>
      </div>
    </div>
  )

  const renderComplete = () => (
    <div className="text-center py-8">
      <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold mb-2">Payment Successful!</h3>
      <p className="text-muted-foreground mb-4">
        Your tickets will be generated and sent to your email shortly.
      </p>
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Processing tickets...</span>
      </div>
    </div>
  )

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Processing
        </CardTitle>
        <CardDescription>
          Complete your ticket purchase securely
        </CardDescription>
      </CardHeader>
      <CardContent>
        {paymentStep === 'details' && renderPaymentDetails()}
        {paymentStep === 'processing' && renderProcessing()}
        {paymentStep === 'complete' && renderComplete()}
      </CardContent>
    </Card>
  )
}