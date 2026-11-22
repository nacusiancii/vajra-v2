/**
 * UPI payment link for the Credit Voucher QR. Any UPI app (PhonePe, GPay, Paytm)
 * scans it. No amount: the customer pays later with interest, so they type
 * what is owed at repayment (CONTEXT.md, Credit Voucher).
 *
 * The UPI ID stays raw (`shop@ybl`, as in the UPI linking spec) — some apps
 * reject `%40`. The payee name is percent-encoded (`%20`, not `+`).
 */
export function upiPayUri(upiId: string, payeeName: string): string {
  const name = payeeName.trim()
  const pn = name ? `&pn=${encodeURIComponent(name)}` : ''
  return `upi://pay?pa=${upiId.trim()}${pn}&cu=INR`
}
