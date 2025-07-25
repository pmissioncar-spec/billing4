import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { Calculator, FileText, Download, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';

type Client = Database['public']['Tables']['clients']['Row'];
type Stock = Database['public']['Tables']['stock']['Row'];

interface TransactionRecord {
  date: string;
  type: 'udhar' | 'jama';
  challan_number: string;
  items: Array<{
    plate_size: string;
    quantity: number;
    daily_rate: number;
  }>;
}

interface PeriodCalculation {
  start_date: string;
  end_date: string;
  days: number;
  plate_balances: Record<string, number>;
  period_charges: Record<string, number>;
  total_period_charge: number;
}

interface BillingData {
  client: Client;
  period_start: string;
  period_end: string;
  transactions: TransactionRecord[];
  period_calculations: PeriodCalculation[];
  service_charge: number;
  total_rental_charge: number;
  previous_balance: number;
  payments_received: number;
  net_due: number;
  total_bill_amount: number;
}

export type { BillingData };

interface BillingCalculatorProps {
  selectedClient: Client | null;
  onBillGenerated: (billData: BillingData) => void;
}

export function BillingCalculator({ selectedClient, onBillGenerated }: BillingCalculatorProps) {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [stockRates, setStockRates] = useState<Record<string, number>>({});
  const [serviceRate, setServiceRate] = useState(5); // Default 5% service charge
  const [loading, setLoading] = useState(false);
  const [billingData, setBillingData] = useState<BillingData | null>(null);

  useEffect(() => {
    fetchStockRates();
    // Set default period to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setPeriodStart(format(firstDay, 'yyyy-MM-dd'));
    setPeriodEnd(format(lastDay, 'yyyy-MM-dd'));
  }, []);

  const fetchStockRates = async () => {
    try {
      const { data, error } = await supabase
        .from('stock')
        .select('plate_size, daily_rate');

      if (error) throw error;

      const rates: Record<string, number> = {};
      data?.forEach(item => {
        rates[item.plate_size] = item.daily_rate || 10; // Default rate
      });
      setStockRates(rates);
    } catch (error) {
      console.error('Error fetching stock rates:', error);
    }
  };

  const fetchTransactionHistory = async (clientId: string, startDate: string, endDate: string): Promise<TransactionRecord[]> => {
    try {
      // Fetch udhar transactions
      const { data: udharData, error: udharError } = await supabase
        .from('challans')
        .select(`
          challan_number,
          challan_date,
          challan_items (plate_size, borrowed_quantity)
        `)
        .eq('client_id', clientId)
        .gte('challan_date', startDate)
        .lte('challan_date', endDate)
        .order('challan_date');

      if (udharError) throw udharError;

      // Fetch jama transactions
      const { data: jamaData, error: jamaError } = await supabase
        .from('returns')
        .select(`
          return_challan_number,
          return_date,
          return_line_items (plate_size, returned_quantity)
        `)
        .eq('client_id', clientId)
        .gte('return_date', startDate)
        .lte('return_date', endDate)
        .order('return_date');

      if (jamaError) throw jamaError;

      const transactions: TransactionRecord[] = [];

      // Process udhar transactions
      udharData?.forEach(challan => {
        transactions.push({
          date: challan.challan_date,
          type: 'udhar',
          challan_number: challan.challan_number,
          items: challan.challan_items.map(item => ({
            plate_size: item.plate_size,
            quantity: item.borrowed_quantity,
            daily_rate: stockRates[item.plate_size] || 10
          }))
        });
      });

      // Process jama transactions
      jamaData?.forEach(returnRecord => {
        transactions.push({
          date: returnRecord.return_date,
          type: 'jama',
          challan_number: returnRecord.return_challan_number,
          items: returnRecord.return_line_items.map(item => ({
            plate_size: item.plate_size,
            quantity: item.returned_quantity,
            daily_rate: stockRates[item.plate_size] || 10
          }))
        });
      });

      // Sort chronologically
      return transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      return [];
    }
  };

  const calculateBilling = async () => {
    if (!selectedClient || !periodStart || !periodEnd) {
      alert('Please select client and billing period');
      return;
    }

    setLoading(true);
    try {
      const transactions = await fetchTransactionHistory(selectedClient.id, periodStart, periodEnd);
      
      // Calculate period-wise charges
      const periodCalculations: PeriodCalculation[] = [];
      let currentBalances: Record<string, number> = {};
      let totalRentalCharge = 0;
      let totalBorrowQuantity = 0;

      // Add period start as first calculation point
      let lastDate = periodStart;

      transactions.forEach((transaction, index) => {
        const transactionDate = transaction.date;
        const daysBetween = differenceInDays(parseISO(transactionDate), parseISO(lastDate));

        // Calculate charges for the period before this transaction
        if (daysBetween > 0 && Object.keys(currentBalances).length > 0) {
          const periodCharges: Record<string, number> = {};
          let periodTotal = 0;

          Object.entries(currentBalances).forEach(([plateSize, quantity]) => {
            if (quantity > 0) {
              const dailyRate = stockRates[plateSize] || 10;
              const periodCharge = quantity * dailyRate * daysBetween;
              periodCharges[plateSize] = periodCharge;
              periodTotal += periodCharge;
            }
          });

          if (periodTotal > 0) {
            periodCalculations.push({
              start_date: lastDate,
              end_date: transactionDate,
              days: daysBetween,
              plate_balances: { ...currentBalances },
              period_charges: periodCharges,
              total_period_charge: periodTotal
            });

            totalRentalCharge += periodTotal;
          }
        }

        // Update balances based on transaction
        transaction.items.forEach(item => {
          const currentBalance = currentBalances[item.plate_size] || 0;
          if (transaction.type === 'udhar') {
            currentBalances[item.plate_size] = currentBalance + item.quantity;
            totalBorrowQuantity += item.quantity;
          } else {
            currentBalances[item.plate_size] = Math.max(0, currentBalance - item.quantity);
          }
        });

        lastDate = transactionDate;
      });

      // Calculate charges for the final period (last transaction to period end)
      const finalDays = differenceInDays(parseISO(periodEnd), parseISO(lastDate));
      if (finalDays > 0 && Object.keys(currentBalances).length > 0) {
        const periodCharges: Record<string, number> = {};
        let periodTotal = 0;

        Object.entries(currentBalances).forEach(([plateSize, quantity]) => {
          if (quantity > 0) {
            const dailyRate = stockRates[plateSize] || 10;
            const periodCharge = quantity * dailyRate * finalDays;
            periodCharges[plateSize] = periodCharge;
            periodTotal += periodCharge;
          }
        });

        if (periodTotal > 0) {
          periodCalculations.push({
            start_date: lastDate,
            end_date: periodEnd,
            days: finalDays,
            plate_balances: { ...currentBalances },
            period_charges: periodCharges,
            total_period_charge: periodTotal
          });

          totalRentalCharge += periodTotal;
        }
      }

      // Calculate service charge
      const serviceCharge = (totalBorrowQuantity * serviceRate) / 100 * 50; // ₹50 per plate service rate

      // Fetch previous balance and payments
      const { data: previousBills } = await supabase
        .from('bills')
        .select('total_amount, payment_status')
        .eq('client_id', selectedClient.id)
        .lt('period_end', periodStart);

      const previousBalance = previousBills
        ?.filter(bill => bill.payment_status === 'pending')
        .reduce((sum, bill) => sum + (bill.total_amount || 0), 0) || 0;

      const paymentsReceived = previousBills
        ?.filter(bill => bill.payment_status === 'paid')
        .reduce((sum, bill) => sum + (bill.total_amount || 0), 0) || 0;

      const totalBillAmount = totalRentalCharge + serviceCharge;
      const netDue = totalBillAmount + previousBalance - paymentsReceived;

      const billingData: BillingData = {
        client: selectedClient,
        period_start: periodStart,
        period_end: periodEnd,
        transactions,
        period_calculations: periodCalculations,
        service_charge: serviceCharge,
        total_rental_charge: totalRentalCharge,
        previous_balance: previousBalance,
        payments_received: paymentsReceived,
        net_due: netDue,
        total_bill_amount: totalBillAmount
      };

      setBillingData(billingData);
      onBillGenerated(billingData);

    } catch (error) {
      console.error('Error calculating billing:', error);
      alert('Error calculating billing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Calculator className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">Billing Calculator</h2>
      </div>

      <div className="space-y-6">
        {/* Billing Period */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Period Start Date
            </label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Period End Date
            </label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        </div>

        {/* Service Rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Service Rate (% of total borrowed quantity)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={serviceRate}
            onChange={(e) => setServiceRate(parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Calculate Button */}
        <button
          onClick={calculateBilling}
          disabled={loading || !selectedClient}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <Calculator className="w-5 h-5" />
              Calculate Bill
            </>
          )}
        </button>

        {/* Billing Summary */}
        {billingData && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-3">Billing Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Rental Charges:</span>
                <span className="font-semibold ml-2">₹{billingData.total_rental_charge.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-blue-700">Service Charges:</span>
                <span className="font-semibold ml-2">₹{billingData.service_charge.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-blue-700">Previous Balance:</span>
                <span className="font-semibold ml-2">₹{billingData.previous_balance.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-blue-700">Payments Received:</span>
                <span className="font-semibold ml-2">₹{billingData.payments_received.toFixed(2)}</span>
              </div>
              <div className="col-span-2 pt-2 border-t border-blue-300">
                <span className="text-blue-900 font-bold">Net Amount Due:</span>
                <span className="font-bold text-lg ml-2">₹{billingData.net_due.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}