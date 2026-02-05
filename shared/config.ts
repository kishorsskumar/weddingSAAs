/**
 * Wedding SaaS Platform Configuration
 * 
 * This file contains all configurable settings for the platform.
 * Values are read from environment variables with sensible defaults.
 */

export const config = {
  // Company Branding
  company: {
    name: process.env.COMPANY_NAME || 'Wedding SaaS Platform',
    shortName: process.env.COMPANY_SHORT_NAME || 'WeddingSaaS',
    tagline: process.env.COMPANY_TAGLINE || 'Event Management',
    email: process.env.COMPANY_EMAIL || 'contact@example.com',
    phone: process.env.COMPANY_PHONE || '',
    website: process.env.COMPANY_WEBSITE || '',
    address: process.env.COMPANY_ADDRESS || '',
  },

  // Theme Configuration
  theme: {
    primaryColor: process.env.THEME_PRIMARY_COLOR || '224 76% 40%', // HSL format - Atbott Blue
    primaryHex: process.env.THEME_PRIMARY_HEX || '#1E40AF',
    logoUrl: process.env.LOGO_URL || '',
    faviconUrl: process.env.FAVICON_URL || '',
  },

  // Document Settings (for invoices, estimates, etc.)
  documents: {
    prefix: {
      event: process.env.DOC_PREFIX_EVENT || 'EVT',
      customer: process.env.DOC_PREFIX_CUSTOMER || 'CUST',
      estimate: process.env.DOC_PREFIX_ESTIMATE || 'EST',
      invoice: process.env.DOC_PREFIX_INVOICE || 'INV',
      receipt: process.env.DOC_PREFIX_RECEIPT || 'REC',
      expense: process.env.DOC_PREFIX_EXPENSE || 'EXP',
      bill: process.env.DOC_PREFIX_BILL || 'BILL',
      vendorPayment: process.env.DOC_PREFIX_VENDOR_PAYMENT || 'VPY',
    },
    gstNumber: process.env.COMPANY_GST_NUMBER || '',
    panNumber: process.env.COMPANY_PAN_NUMBER || '',
    placeOfSupply: process.env.PLACE_OF_SUPPLY || '',
  },

  // Bank Details
  bank: {
    name: process.env.BANK_NAME || '',
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || '',
    ifscCode: process.env.BANK_IFSC_CODE || '',
    branch: process.env.BANK_BRANCH || '',
  },

  // Default Admin Account (only used on first setup)
  defaultAdmin: {
    email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!',
    name: process.env.DEFAULT_ADMIN_NAME || 'Super Admin',
  },

  // Feature Flags
  features: {
    whatsappEnabled: process.env.FEATURE_WHATSAPP === 'true',
    aiAssistantEnabled: process.env.FEATURE_AI_ASSISTANT === 'true',
    googleCalendarEnabled: process.env.FEATURE_GOOGLE_CALENDAR === 'true',
    rsvpEnabled: process.env.FEATURE_RSVP === 'true',
  },

  // Regional Settings
  regional: {
    currency: process.env.CURRENCY || 'INR',
    currencySymbol: process.env.CURRENCY_SYMBOL || '₹',
    country: process.env.DEFAULT_COUNTRY || 'India',
    timezone: process.env.TIMEZONE || 'Asia/Kolkata',
  },
};

// Type for the config object
export type Config = typeof config;
