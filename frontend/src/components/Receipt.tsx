import { forwardRef } from 'react';

interface ReceiptItem {
  productName: string;
  quantity:    number;
  unitPrice:   number;
  discountPct: number;
  lineTotal:   number;
}

interface ReceiptProps {
  invoiceNumber: string;
  createdAt:     string;
  cashierName:   string;
  customerName?: string;
  type:          'retail' | 'wholesale';
  discount:      number;
  totalAmount:   number;
  items:         ReceiptItem[];
}

function divider() {
  return <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />;
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ invoiceNumber, createdAt, cashierName, customerName, type, discount, totalAmount, items }, ref) => {
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const discountAmt = discount > 0 ? subtotal * (discount / 100) : 0;
    const date = new Date(createdAt);
    const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    return (
      <div
        ref={ref}
        className="receipt-printable"
        style={{
          width: '80mm',
          fontFamily: "'Courier New', monospace",
          fontSize: 11,
          color: '#000',
          background: '#fff',
          padding: '8mm',
          lineHeight: 1.5,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }}>StockFlow</div>
          <div style={{ fontSize: 10, color: '#555' }}>Kitchen Utensils</div>
        </div>

        {divider()}

        <div style={{ fontSize: 10, marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{invoiceNumber}</span>
            <span style={{ textTransform: 'uppercase' }}>{type}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{dateStr} {timeStr}</span>
          </div>
          <div>Cashier: {cashierName}</div>
          {customerName && <div>Customer: {customerName}</div>}
        </div>

        {divider()}

        {/* Items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingBottom: 2 }}>Item</th>
              <th style={{ textAlign: 'right', paddingBottom: 2 }}>Qty</th>
              <th style={{ textAlign: 'right', paddingBottom: 2 }}>Price</th>
              <th style={{ textAlign: 'right', paddingBottom: 2 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td style={{ paddingBottom: 2, maxWidth: '40mm', wordBreak: 'break-word' }}>
                  {item.productName}
                  {item.discountPct > 0 && (
                    <span style={{ color: '#666' }}> (-{item.discountPct}%)</span>
                  )}
                </td>
                <td style={{ textAlign: 'right', paddingBottom: 2 }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', paddingBottom: 2 }}>Rs.{item.unitPrice.toFixed(2)}</td>
                <td style={{ textAlign: 'right', paddingBottom: 2 }}>Rs.{item.lineTotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {divider()}

        {/* Totals */}
        <div style={{ fontSize: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal</span>
            <span>Rs.{subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
              <span>Discount ({discount}%)</span>
              <span>-Rs.{discountAmt.toFixed(2)}</span>
            </div>
          )}
        </div>

        {divider()}

        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>
          <span>TOTAL</span>
          <span>Rs.{totalAmount.toFixed(2)}</span>
        </div>

        {divider()}

        <div style={{ textAlign: 'center', fontSize: 10, color: '#555', marginTop: 8 }}>
          <div>Thank you for your business!</div>
          <div style={{ marginTop: 4 }}>Powered by StockFlow</div>
        </div>
      </div>
    );
  }
);

Receipt.displayName = 'Receipt';
