import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { 
  Receipt, 
  Search, 
  User, 
  Calendar, 
  DollarSign, 
  Download, 
  Plus, 
  Lock,
  FileText,
  Calculator,
  Eye,
  Mail
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { BillingCalculator, BillingData } from './BillingCalculator';
import { BillPDFGenerator } from './BillPDFGenerator';
import { generateBillPDF, saveBillToDatabase, formatBillForEmail } from '../utils/billPDFGenerator';

type Client = Database['public']['Tables']['clients']['Row'];
type Bill = Database['public']['Tables']['bills']['Row'] & {
  clients: Client;
};

export function EnhancedBillingPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCalculator, setShowCalculator] = useState(false);
  const [currentBillingData, setCurrentBillingData] = useState<BillingData | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [clientsResult, billsResult] = await Promise.all([
        supabase.from('clients').select('*').order('id'),
        supabase.from('bills').select(`
          *,
          clients (*)
        `).order('created_at', { ascending: false })
      ]);

      if (clientsResult.error) throw clientsResult.error;
      if (billsResult.error) throw billsResult.error;

      setClients(clientsResult.data || []);
      setBills(billsResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBillGenerated = async (billingData: BillingData) => {
    setCurrentBillingData(billingData);
    
    // Auto-save to database if admin
    if (user?.isAdmin) {
      const saved = await saveBillToDatabase(billingData);
      if (saved) {
        await fetchData(); // Refresh bills list
      }
    }
  };

  const handleDownloadPDF = async () => {
    if (!currentBillingData) return;
    
    setGeneratingPDF(true);
    try {
      // Wait for the component to render
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const success = await generateBillPDF(currentBillingData, {
        filename: `bill-${currentBillingData.client.name}-${currentBillingData.period_start}`,
        quality: 0.98
      });
      
      if (success) {
        alert('Bill PDF downloaded successfully!');
      } else {
        alert('Error generating PDF. Please try again.');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error downloading PDF. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleEmailBill = () => {
    if (!currentBillingData) return;
    
    const emailBody = formatBillForEmail(currentBillingData);
    const subject = `Rental Bill - ${currentBillingData.period_start} to ${currentBillingData.period_end}`;
    const mailtoLink = `mailto:${currentBillingData.client.mobile_number}@example.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    
    window.open(mailtoLink);
  };

  const updatePaymentStatus = async (billId: number, status: string) => {
    if (!user?.isAdmin) return;
    
    try {
      const { error } = await supabase
        .from('bills')
        .update({ payment_status: status })
        .eq('id', billId);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Error updating payment status.');
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBills = bills.filter(bill =>
    bill.clients.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bill.clients.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Enhanced Billing</h1>
          <p className="text-gray-600">Loading billing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hidden PDF Generator */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        {currentBillingData && (
          <BillPDFGenerator billingData={currentBillingData} />
        )}
      </div>

      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Enhanced Billing System</h1>
        <p className="text-gray-600">Advanced billing with detailed calculations and PDF generation</p>
      </div>

      {/* Client Selection & Calculator */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Generate New Bill</h2>
          {user?.isAdmin ? (
            <button
              onClick={() => setShowCalculator(!showCalculator)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 justify-center"
            >
              <Calculator className="w-4 h-4" />
              {showCalculator ? 'Hide Calculator' : 'Show Calculator'}
            </button>
          ) : (
            <div className="bg-gray-200 text-gray-500 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 justify-center">
              <Lock className="w-4 h-4" />
              View Only
            </div>
          )}
        </div>

        {/* Client Selection */}
        {showCalculator && user?.isAdmin && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Client for Billing
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  placeholder="Search clients..."
                />
              </div>
              
              {searchTerm && (
                <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => {
                        setSelectedClient(client);
                        setSearchTerm('');
                      }}
                      className="w-full text-left p-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                    >
                      <p className="font-medium text-gray-900">{client.name}</p>
                      <p className="text-sm text-gray-600">ID: {client.id} | {client.site}</p>
                    </button>
                  ))}
                </div>
              )}
              
              {selectedClient && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="font-medium text-blue-900">{selectedClient.name}</p>
                  <p className="text-sm text-blue-700">ID: {selectedClient.id} | {selectedClient.site}</p>
                </div>
              )}
            </div>

            {/* Billing Calculator */}
            {selectedClient && (
              <BillingCalculator 
                selectedClient={selectedClient}
                onBillGenerated={handleBillGenerated}
              />
            )}

            {/* Generated Bill Actions */}
            {currentBillingData && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-3">Bill Generated Successfully!</h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleDownloadPDF}
                    disabled={generatingPDF}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {generatingPDF ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download PDF
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={handleEmailBill}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Email Bill
                  </button>
                  
                  <button
                    onClick={() => {
                      setCurrentBillingData(null);
                      setSelectedClient(null);
                      setShowCalculator(false);
                    }}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    New Bill
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bills List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">All Bills</h2>
        
        <div className="space-y-4">
          {filteredBills.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No bills found</p>
            </div>
          ) : (
            filteredBills.map((bill) => (
              <div key={bill.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <Receipt className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{bill.clients.name}</h3>
                      <p className="text-sm text-gray-600">ID: {bill.clients.id}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          {new Date(bill.period_start).toLocaleDateString()} - {new Date(bill.period_end).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <DollarSign className="w-4 h-4" />
                          ₹{bill.total_amount?.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    {user?.isAdmin ? (
                      <select
                        value={bill.payment_status || 'pending'}
                        onChange={(e) => updatePaymentStatus(bill.id, e.target.value)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                          bill.payment_status === 'paid' 
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : bill.payment_status === 'overdue'
                            ? 'bg-red-50 border-red-200 text-red-800'
                            : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    ) : (
                      <span className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                        bill.payment_status === 'paid' 
                          ? 'bg-green-50 border-green-200 text-green-800'
                          : bill.payment_status === 'overdue'
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                      }`}>
                        {bill.payment_status?.charAt(0).toUpperCase() + bill.payment_status?.slice(1)}
                      </span>
                    )}
                    
                    <div className="flex gap-2">
                      <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}