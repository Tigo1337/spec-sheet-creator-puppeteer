export type SupportOption = {
  id: string;
  label: string;
  response?: string;
  actionLabel?: string;
  actionLink?: string;
  subOptions?: SupportOption[];
};

export const SUPPORT_DATA: SupportOption[] = [
  {
    id: "getting-started",
    label: "🚀 Getting Started",
    subOptions: [
      {
        id: "how-to-create",
        label: "How do I create a new Spec Sheet?",
        response: "Go to the 'Editor' page. You can start from a blank canvas or use one of our pre-made templates to get started quickly.",
        actionLabel: "Go to Editor",
        actionLink: "/editor"
      },
      {
        id: "import-data",
        label: "How do I import product data?",
        response: "In the Editor, click the 'Data' tab on the left. You can upload a CSV or Excel file. Our AI can effectively map your columns to the template fields automatically.",
      },
      {
        id: "save-design",
        label: "How do I save my design?",
        response: "Your design is auto-saved as you work. You can also manually name your design in the top toolbar to find it easily in your 'Saved Designs' tab later.",
      }
    ]
  },
  {
    id: "features",
    label: "✨ AI & Features",
    subOptions: [
      {
        id: "ai-enrichment",
        label: "How does AI Data Enrichment work?",
        response: "Select a row in your data tab and choose an enrichment type (like 'Marketing Copy' or 'SEO Title'). Our Gemini-powered AI will read your product specs and generate professional text for you.",
      },
      {
        id: "knowledge-base",
        label: "What is the 'Knowledge Base'?",
        response: "When you generate content with AI, you can save it to your Knowledge Base. This allows you to reuse approved product descriptions across different designs without regenerating them.",
      },
      {
        id: "dynamic-qr",
        label: "How do Dynamic QR Codes work?",
        response: "Dynamic QR codes allow you to change the destination URL even after you've printed the PDF. This is a Pro feature perfect for inventory tags or marketing materials.",
      }
    ]
  },
  {
    id: "billing",
    label: "💳 Pricing & Plans",
    subOptions: [
      {
        id: "free-vs-pro",
        label: "What is the difference between Free and Pro?",
        response: "The Free plan includes 50 PDF exports/month (with watermark) and basic RGB export. The Pro plan offers unlimited exports, CMYK color support for print, and Dynamic QR codes.",
        actionLabel: "View Pricing",
        actionLink: "/pricing"
      },
      {
        id: "remove-watermark",
        label: "How do I remove the 'Created with Doculoom' watermark?",
        response: "The watermark is automatically removed when you upgrade to the Pro plan.",
        actionLabel: "Upgrade Now",
        actionLink: "/checkout"
      },
      {
        id: "cancel-subscription",
        label: "How do I cancel my subscription?",
        response: "You can manage your billing, view invoices, and cancel your subscription via the Stripe Customer Portal.",
        actionLabel: "Manage Billing",
        actionLink: "/api/customer-portal" // This will redirect via your backend route
      }
    ]
  },
  {
    id: "troubleshooting",
    label: "🔧 Troubleshooting",
    subOptions: [
      {
        id: "pdf-colors",
        label: "My PDF colors look wrong (CMYK)",
        response: "If you are exporting for print, make sure you selected 'CMYK' in the export settings. This is a Pro feature. Free exports are in RGB (screen colors).",
      },
      {
        id: "export-failed",
        label: "PDF Export Failed",
        response: "This can happen if the image files are too large or the canvas is extremely complex. Try reducing image sizes or contact support if the issue persists.",
      }
    ]
  },
  {
    id: "contact",
    label: "Contact Support",
    response: "Need more help? Our team is available to assist you with any technical issues or questions.",
    actionLabel: "Email Support",
    actionLink: "mailto:support@doculoom.io"
  }
];