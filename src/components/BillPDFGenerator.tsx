import React from 'react';
import { BillingData } from './BillingCalculator';
import { format } from 'date-fns';

interface BillPDFGeneratorProps {
  billingData: BillingData;
}

export function BillPDFGenerator({ billingData }: BillPDFGeneratorProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy');
  };

  return (
    <div 
      id={`bill-${billingData.client.id}-${billingData.period_start}`}
      className="bg-white p-8 max-w-[210mm] mx-auto"
      style={{
        fontFamily: "'Noto Sans Gujarati', sans-serif",
        fontSize: '14px',
        lineHeight: '1.5'
      }}
    >
      {/* Header */}
      <div className="text-center mb-8 border-b-2 border-blue-600 pb-6">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">NO WERE TECH</h1>
        <p className="text-lg text-gray-600 mb-4">સેન્ટરિંગ પ્લેટ્સ ભાડા સેવા</p>
        <div className="text-xl font-bold text-blue-700">
          RENTAL BILL / ભાડા બિલ
        </div>
      </div>

      {/* Bill Info */}
      <div className="grid grid-cols-2 gap-8 mb-6">
        <div className="space-y-2">
          <h3 className="font-bold text-gray-900 border-b border-gray-300 pb-1">Bill Information</h3>
          <div><strong>Bill Period:</strong> {formatDate(billingData.period_start)} to {formatDate(billingData.period_end)}</div>
          <div><strong>Generated On:</strong> {formatDate(new Date().toISOString())}</div>
          <div><strong>Bill ID:</strong> BILL-{billingData.client.id}-{format(new Date(), 'yyyyMMdd')}</div>
        </div>
        
        <div className="space-y-2">
          <h3 className="font-bold text-gray-900 border-b border-gray-300 pb-1">Client Information</h3>
          <div><strong>Client ID:</strong> {billingData.client.id}</div>
          <div><strong>Name:</strong> {billingData.client.name}</div>
          <div><strong>Site:</strong> {billingData.client.site}</div>
          <div><strong>Mobile:</strong> {billingData.client.mobile_number}</div>
        </div>
      </div>

      {/* Transaction Summary */}
      <div className="mb-6">
        <h3 className="font-bold text-gray-900 border-b border-gray-300 pb-2 mb-4">Transaction Summary</h3>
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-blue-100">
              <th className="border border-gray-300 p-2 text-left">Date</th>
              <th className="border border-gray-300 p-2 text-left">Type</th>
              <th className="border border-gray-300 p-2 text-left">Challan No.</th>
              <th className="border border-gray-300 p-2 text-left">Plate Details</th>
            </tr>
          </thead>
          <tbody>
            {billingData.transactions.map((transaction, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="border border-gray-300 p-2">{formatDate(transaction.date)}</td>
                <td className="border border-gray-300 p-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    transaction.type === 'udhar' 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {transaction.type === 'udhar' ? 'ઉધાર (Issue)' : 'જમા (Return)'}
                  </span>
                </td>
                <td className="border border-gray-300 p-2">{transaction.challan_number}</td>
                <td className="border border-gray-300 p-2">
                  {transaction.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="text-sm">
                      {item.plate_size}: {transaction.type === 'udhar' ? '+' : '-'}{item.quantity}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Period-wise Billing Calculation */}
      <div className="mb-6">
        <h3 className="font-bold text-gray-900 border-b border-gray-300 pb-2 mb-4">Period-wise Billing Calculation</h3>
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-blue-100">
              <th className="border border-gray-300 p-2 text-left">Period</th>
              <th className="border border-gray-300 p-2 text-left">Days</th>
              <th className="border border-gray-300 p-2 text-left">Plate Balance</th>
              <th className="border border-gray-300 p-2 text-left">Daily Rate</th>
              <th className="border border-gray-300 p-2 text-right">Period Charge</th>
            </tr>
          </thead>
          <tbody>
            {billingData.period_calculations.map((period, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="border border-gray-300 p-2">
                  {formatDate(period.start_date)} to {formatDate(period.end_date)}
                </td>
                <td className="border border-gray-300 p-2 text-center">{period.days}</td>
                <td className="border border-gray-300 p-2">
                  {Object.entries(period.plate_balances)
                    .filter(([_, quantity]) => quantity > 0)
                    .map(([plateSize, quantity]) => (
                      <div key={plateSize} className="text-sm">
                        {plateSize}: {quantity}
                      </div>
                    ))}
                </td>
                <td className="border border-gray-300 p-2">
                  {Object.entries(period.plate_balances)
                    .filter(([_, quantity]) => quantity > 0)
                    .map(([plateSize, quantity]) => (
                      <div key={plateSize} className="text-sm">
                        ₹{(period.period_charges[plateSize] / quantity / period.days).toFixed(2)}/day
                      </div>
                    ))}
                </td>
                <td className="border border-gray-300 p-2 text-right font-medium">
                  {formatCurrency(period.total_period_charge)}
                </td>
              </tr>
            ))}
            <tr className="bg-blue-50 font-bold">
              <td colSpan={4} className="border border-gray-300 p-2 text-right">
                Total Rental Charges:
              </td>
              <td className="border border-gray-300 p-2 text-right">
                {formatCurrency(billingData.total_rental_charge)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bill Summary */}
      <div className="mb-8">
        <h3 className="font-bold text-gray-900 border-b border-gray-300 pb-2 mb-4">Bill Summary</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Rental Charges:</span>
                <span className="font-medium">{formatCurrency(billingData.total_rental_charge)}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Charges:</span>
                <span className="font-medium">{formatCurrency(billingData.service_charge)}</span>
              </div>
              <div className="flex justify-between">
                <span>Previous Balance:</span>
                <span className="font-medium">{formatCurrency(billingData.previous_balance)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Current Bill Total:</span>
                <span className="font-medium">{formatCurrency(billingData.total_bill_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Payments Received:</span>
                <span className="font-medium text-green-600">-{formatCurrency(billingData.payments_received)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                <span>Net Amount Due:</span>
                <span className="text-blue-600">{formatCurrency(billingData.net_due)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Instructions */}
      <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h4 className="font-bold text-yellow-800 mb-2">Payment Instructions / ચુકવણી સૂચનાઓ</h4>
        <div className="text-sm text-yellow-700 space-y-1">
          <p>• Please make payment within 30 days of bill generation</p>
          <p>• કૃપા કરીને બિલ જનરેશનના 30 દિવસમાં ચુકવણી કરો</p>
          <p>• For any queries, contact: +91-XXXXXXXXXX</p>
          <p>• કોઈપણ પ્રશ્ન માટે સંપર્ક કરો: +91-XXXXXXXXXX</p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-600 border-t border-gray-300 pt-4">
        <p className="mb-2">
          <strong>NO WERE TECH</strong> - Centering Plates Rental Service
        </p>
        <p>
          Generated on {format(new Date(), 'dd/MM/yyyy HH:mm:ss')} | 
          This is a computer-generated bill
        </p>
      </div>

      {/* Signature Section */}
      <div className="flex justify-between mt-16">
        <div className="text-center w-48">
          <div className="border-t border-black pt-2 mt-12">
            Client's Signature
          </div>
        </div>
        <div className="text-center w-48">
          <div className="border-t border-black pt-2 mt-12">
            Authorized Signature
          </div>
        </div>
      </div>
    </div>
  );
}