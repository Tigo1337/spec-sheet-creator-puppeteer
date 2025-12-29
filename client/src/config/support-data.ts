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
    label: "Getting Started",
    subOptions: [
      {
        id: "how-to-create",
        label: "How do I create a new Spec Sheet?",
        response: "Start in the 'Editor'. You can use the 'Tools' on the left to add text and shapes, or browse the 'Designs' tab on the right to load a pre-made template.",
      },
      {
        id: "import-data",
        label: "How do I import product data?",
        response: "Open the 'Data' tab in the Right Panel. Upload a CSV or Excel file. Use 'AI Auto-Mapping' to automatically match your spreadsheet columns to your design fields.",
      },
      {
        id: "manage-designs",
        label: "Where are my saved designs?",
        response: "All your work is stored in the 'Designs' tab on the Right Panel. You can save current designs as templates or reload previous projects from there.",
      }
    ]
  },
  {
    id: "design-tools",
    label: "Design & Layout",
    subOptions: [
      {
        id: "catalog-mode",
        label: "How do I create a Multi-page Catalog?",
        response: "Enable 'Catalog Mode' to design documents with Cover Pages, Table of Contents, and Chapter Dividers. You can switch between these sections using the Catalog Navigator at the top of the canvas.",
      },
      {
        id: "tables",
        label: "How do I add Data Tables?",
        response: "Use the 'Structure' section in the Left Panel to add a Data Table. You can group rows by a specific field (like 'Category') via the Table Properties in the Right Panel.",
      },
      {
        id: "alignment",
        label: "How do I align elements perfectly?",
        response: "Use the 'Snap to Grid' feature (Magnet icon) in the top header. You can also select multiple items and use the Alignment tools in the 'Properties' tab to distribute them evenly.",
      },
      {
        id: "layers",
        label: "How do I manage element layering?",
        response: "Open the 'Layers' tab in the Right Panel to see all elements on your current page. You can reorder them to bring items to the front or hide them entirely.",
      }
    ]
  },
  {
    id: "ai-features",
    label: "AI & Automation",
    subOptions: [
      {
        id: "ai-enrichment",
        label: "How do I generate AI content?",
        response: "In the 'Data' tab, click 'Generate with AI'. You can create Marketing Descriptions, SEO titles, or Feature Lists based on your existing spreadsheet data.",
      },
      {
        id: "ai-standardization",
        label: "What is the 'Wand' icon for?",
        response: "That is the AI Standardizer. Click it to instantly fix formatting, convert measurements (e.g., lbs to kg), or apply Title Case to your columns using Gemini AI.",
      },
      {
        id: "knowledge-base",
        label: "How does AI Memory work?",
        response: "AI Memory saves your approved generated content. To use it, select a 'Unique ID Column' (like SKU) in the Data tab. The AI will then auto-fill that product's details in any future design (Scale Plan required).",
      }
    ]
  },
  {
    id: "export-printing",
    label: "Export & History",
    subOptions: [
      {
        id: "export-modes",
        label: "Digital Ready vs. Print Ready",
        response: "'Digital Ready' uses RGB colors and compression for fast sharing. 'Print Ready' (Pro feature) uses high-resolution images and CMYK color profiles for professional results.",
      },
      {
        id: "bulk-export",
        label: "Can I export all products at once?",
        response: "Yes! Use 'Bulk Export as ZIP' in the Export tab. This generates a separate PDF for every row in your spreadsheet and packages them together.",
      },
      {
        id: "filename-patterns",
        label: "How do I customize filenames?",
        response: "Use the 'Filename Pattern' field in the Export tab. You can insert variables like {{Model}} or {{Date}} to automatically name your files based on your product data.",
      },
      {
        id: "export-history",
        label: "Where are my previous exports?",
        response: "Recent exports are listed at the bottom of the 'Export' tab. You can re-download any completed files from the last 30 days.",
      }
    ]
  },
  {
    id: "account-billing",
    label: "Account & Credits",
    subOptions: [
      {
        id: "ai-credits",
        label: "How do AI Credits work?",
        response: "Credits are used for generating text and standardizing data. Your balance resets every 30 days based on your plan. You can view your current balance in the 'Account' settings.",
      },
      {
        id: "plan-comparison",
        label: "Which plan is right for me?",
        response: "Starter is for basics (50 watermarked PDFs/mo). Pro offers unlimited clean exports and Print Ready quality. Scale adds AI Product Memory and massive credit limits.",
        actionLabel: "Compare Plans",
        actionLink: "/pricing"
      },
      {
        id: "manage-billing",
        label: "How do I cancel or update billing?",
        response: "Click the 'Account' icon in the Editor header and select 'Manage Billing' to open the secure Stripe portal for invoices and plan changes.",
      }
    ]
  },
  {
    id: "contact",
    label: "Contact Support",
    response: "Need a custom template or technical help? Our team is available to assist you via email.",
    actionLabel: "Email Support",
    actionLink: "mailto:support@doculoom.io"
  }
];