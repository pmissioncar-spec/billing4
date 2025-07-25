import html2pdf from 'html2pdf.js';
import { BillingData } from '../components/BillingCalculator';

export interface BillPDFOptions {
  filename?: string;
  format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margin?: number;
  quality?: number;
}

export const generateBillPDF = async (
  billingData: BillingData,
  options: BillPDFOptions = {}
): Promise<boolean> => {
  const {
    filename = `bill-${billingData.client.id}-${billingData.period_start}`,
    format = 'a4',
    orientation = 'portrait',
    margin = 10,
    quality = 0.98
  } = options;

  const elementId = `bill-${billingData.client.id}-${billingData.period_start}`;
  const element = document.getElementById(elementId);
  
  if (!element) {
    console.error('Bill element not found');
    return false;
  }

  const opt = {
    margin,
    filename: `${filename}.pdf`,
    image: { 
      type: 'jpeg', 
      quality 
    },
    html2canvas: { 
      scale: 2,
      useCORS: true,
      logging: false,
      letterRendering: true,
      allowTaint: true
    },
    jsPDF: { 
      unit: 'mm', 
      format, 
      orientation 
    }
  };

  try {
    await html2pdf().set(opt).from(element).save();
    return true;
  } catch (error) {
    console.error('Error generating bill PDF:', error);
    return false;
  }
};

export const previewBillPDF = async (
  billingData: BillingData,
  options: BillPDFOptions = {}
): Promise<string | null> => {
  const elementId = `bill-${billingData.client.id}-${billingData.period_start}`;
  const element = document.getElementById(elementId);
  
  if (!element) {
    console.error('Bill element not found');
    return null;
  }

  const opt = {
    margin: options.margin || 10,
    image: { 
      type: 'jpeg', 
      quality: options.quality || 0.98 
    },
    html2canvas: { 
      scale: 2,
      useCORS: true,
      logging: false
    },
    jsPDF: { 
      unit: 'mm', 
      format: options.format || 'a4', 
      orientation: options.orientation || 'portrait' 
    }
  };

  try {
    const pdf = await html2pdf().set(opt).from(element).outputPdf('datauristring');
    return pdf;
  } catch (error) {
    console.error('Error generating bill PDF preview:', error);
    return null;
  }
};

// Utility function to save bill data to database
export const saveBillToDatabase = async (billingData: BillingData): Promise<boolean> => {
  try {
    const { supabase } = await import('../lib/supabase');
    
    const { error } = await supabase
      .from('bills')
      .insert([{
        client_id: billingData.client.id,
        period_start: billingData.period_start,
        period_end: billingData.period_end,
        total_amount: billingData.net_due,
        payment_status: 'pending'
      }]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error saving bill to database:', error);
    return false;
  }
};

// Utility function to format bill data for email
export const formatBillForEmail = (billingData: BillingData): string => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return `
Dear ${billingData.client.name},

Your rental bill for the period ${billingData.period_start} to ${billingData.period_end} is ready.

Bill Summary:
- Rental Charges: ${formatCurrency(billingData.total_rental_charge)}
- Service Charges: ${formatCurrency(billingData.service_charge)}
- Previous Balance: ${formatCurrency(billingData.previous_balance)}
- Payments Received: ${formatCurrency(billingData.payments_received)}

Net Amount Due: ${formatCurrency(billingData.net_due)}

Please make payment within 30 days.

Thank you for your business!

NO WERE TECH
Centering Plates Rental Service
  `.trim();
};