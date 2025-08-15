import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'

import { 
  Camera, 
  Scan, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Ticket,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react'
import { useTicketStore } from '../stores/ticketStore'
import { QRCodeGenerator, QRCodeData } from '../lib/qrcode'
import { useToast } from '../hooks/use-toast'

interface ScanResult {
  success: boolean
  ticketData?: QRCodeData
  error?: string
  timestamp: string
}

interface TicketScannerProps {
  mode: 'entry' | 'exit'
  gateId: string
  staffId: string
}

export default function TicketScanner({ mode, gateId, staffId }: TicketScannerProps) {
  const { recordValidation, getValidationHistory } = useTicketStore()
  const { toast } = useToast()
  
  const [isScanning, setIsScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const handleOnlineStatus = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', handleOnlineStatus)
    window.addEventListener('offline', handleOnlineStatus)
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus)
      window.removeEventListener('offline', handleOnlineStatus)
    }
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsScanning(true)
      }
    } catch (error) {
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please use manual entry.",
        variant: "destructive"
      })
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setIsScanning(false)
  }

  const processTicketCode = async (code: string) => {
    try {
      // Parse QR code data
      const ticketData = QRCodeGenerator.parseQRCode(code)
      if (!ticketData) {
        throw new Error('Invalid QR code format')
      }

      // Validate ticket
      const isValid = QRCodeGenerator.validateQRCode(ticketData)
      if (!isValid) {
        throw new Error('Ticket has expired or is invalid')
      }

      // Check if ticket was already used
      const validationHistory = getValidationHistory()
      const alreadyUsed = validationHistory.some(v => 
        v.ticket_id === ticketData.ticketId && v.validation_type === mode && v.is_valid
      )

      if (alreadyUsed && mode === 'entry') {
        throw new Error('Ticket already used for entry')
      }

      // Record validation
      const validation = {
        id: `VAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ticket_id: ticketData.ticketId,
        validation_type: mode,
        gate_id: gateId,
        staff_id: staffId,
        timestamp: new Date().toISOString(),
        is_valid: true
      }

      recordValidation(validation)

      const result: ScanResult = {
        success: true,
        ticketData,
        timestamp: new Date().toLocaleTimeString()
      }

      setLastScanResult(result)
      setScanHistory(prev => [result, ...prev.slice(0, 9)])

      toast({
        title: "Scan Successful",
        description: `${mode === 'entry' ? 'Entry' : 'Exit'} recorded for ${ticketData.attendeeName}`
      })

    } catch (error) {
      const result: ScanResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toLocaleTimeString()
      }

      setLastScanResult(result)
      setScanHistory(prev => [result, ...prev.slice(0, 9)])

      toast({
        title: "Scan Failed",
        description: result.error,
        variant: "destructive"
      })
    }
  }

  const handleManualEntry = () => {
    if (manualCode.trim()) {
      processTicketCode(manualCode.trim())
      setManualCode('')
    }
  }

  const syncOfflineData = async () => {
    if (!isOnline) return
    
    // In a real implementation, this would sync offline validation data
    // to the server when connection is restored
    toast({
      title: "Sync Complete",
      description: "Offline validation data has been synchronized."
    })
  }

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant={mode === 'entry' ? 'default' : 'secondary'} className="text-sm">
                {mode === 'entry' ? 'ENTRY' : 'EXIT'} GATE
              </Badge>
              <span className="text-sm text-muted-foreground">Gate: {gateId}</span>
            </div>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <div className="flex items-center gap-1 text-green-600">
                  <Wifi className="h-4 w-4" />
                  <span className="text-sm">Online</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-orange-600">
                  <WifiOff className="h-4 w-4" />
                  <span className="text-sm">Offline</span>
                  <Button size="sm" variant="outline" onClick={syncOfflineData}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scanner Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera Scanner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              QR Code Scanner
            </CardTitle>
            <CardDescription>
              Scan ticket QR codes for {mode}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isScanning ? (
              <div className="text-center py-8">
                <Camera className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <Button onClick={startCamera}>
                  <Scan className="h-4 w-4 mr-2" />
                  Start Camera
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-64 bg-black rounded-lg"
                />
                <canvas ref={canvasRef} className="hidden" />
                <Button variant="outline" onClick={stopCamera} className="w-full">
                  Stop Camera
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Entry */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Manual Entry
            </CardTitle>
            <CardDescription>
              Enter ticket code manually
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Enter ticket code or QR data"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleManualEntry()}
              />
              <Button onClick={handleManualEntry} className="w-full">
                Process Ticket
              </Button>
            </div>

            {/* Last Scan Result */}
            {lastScanResult && (
              <Alert className={lastScanResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-center gap-2">
                  {lastScanResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium">
                    {lastScanResult.success ? 'Success' : 'Failed'}
                  </span>
                  <span className="text-sm text-muted-foreground ml-auto">
                    {lastScanResult.timestamp}
                  </span>
                </div>
                <AlertDescription className="mt-2">
                  {lastScanResult.success && lastScanResult.ticketData ? (
                    <div>
                      <p><strong>{lastScanResult.ticketData.attendeeName}</strong></p>
                      <p className="text-sm">{lastScanResult.ticketData.ticketType}</p>
                    </div>
                  ) : (
                    <p>{lastScanResult.error}</p>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scan History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Scans
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scanHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No scans recorded yet
            </p>
          ) : (
            <div className="space-y-2">
              {scanHistory.map((scan, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {scan.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      {scan.success && scan.ticketData ? (
                        <div>
                          <p className="font-medium">{scan.ticketData.attendeeName}</p>
                          <p className="text-sm text-muted-foreground">{scan.ticketData.ticketType}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-red-600">{scan.error}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">{scan.timestamp}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}