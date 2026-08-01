import QRCode from 'qrcode'

/**
 * Rendering half of `ticketCode.ts`: turn a `ticket_passes.qr_token` into a PNG
 * data URL for the attendee wallet.
 *
 * What used to live here — `parseQRCode` / `validateQRCode` — is gone on
 * purpose. It `JSON.parse`d the scanned payload and then decided admission from
 * the payload's own claims, so typing
 * `{"id":"x","valid":"2999-01-01"}` into the manual-entry box admitted a person.
 * Validity now comes from the server (`redeem_tickets`) or the offline mirror.
 */
export const QRCodeGenerator = {
  /**
   * @param qrToken the opaque pass uuid. Nothing else is ever encoded.
   */
  async generateQRCode(qrToken: string): Promise<string> {
    // Error correction 'M': a convention badge gets creased and thumbed. Colours
    // are left at the library default black-on-white — a QR is a contrast
    // target, not a themed surface, and tinting it breaks cheap scanners.
    return QRCode.toDataURL(qrToken, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
    })
  },
}
