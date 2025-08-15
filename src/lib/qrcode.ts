import QRCode from 'qrcode'

export interface QRCodeData {
  ticketId: string
  eventId: string
  ticketType: string
  purchaseDate: string
  validUntil: string
  attendeeName: string
  attendeeEmail: string
}

export class QRCodeGenerator {
  static async generateQRCode(data: QRCodeData): Promise<string> {
    try {
      const qrData = JSON.stringify({
        id: data.ticketId,
        event: data.eventId,
        type: data.ticketType,
        purchased: data.purchaseDate,
        valid: data.validUntil,
        name: data.attendeeName,
        email: data.attendeeEmail,
        timestamp: Date.now()
      })

      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      })

      return qrCodeDataURL
    } catch (error) {
      console.error('Error generating QR code:', error)
      throw new Error('Failed to generate QR code')
    }
  }

  static parseQRCode(qrData: string): QRCodeData | null {
    try {
      const parsed = JSON.parse(qrData)
      return {
        ticketId: parsed.id,
        eventId: parsed.event,
        ticketType: parsed.type,
        purchaseDate: parsed.purchased,
        validUntil: parsed.valid,
        attendeeName: parsed.name,
        attendeeEmail: parsed.email
      }
    } catch (error) {
      console.error('Error parsing QR code:', error)
      return null
    }
  }

  static validateQRCode(qrData: QRCodeData): boolean {
    const now = new Date()
    const validUntil = new Date(qrData.validUntil)
    
    return validUntil > now && !!qrData.ticketId && !!qrData.eventId
  }
}

// RFID simulation for demo purposes
export class RFIDGenerator {
  static generateRFIDCode(): string {
    // Generate a 12-character hexadecimal RFID code
    return Array.from({ length: 12 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('').toUpperCase()
  }

  static validateRFIDFormat(rfidCode: string): boolean {
    return /^[0-9A-F]{12}$/.test(rfidCode)
  }
}