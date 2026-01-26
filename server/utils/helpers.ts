/**
 * General utility/helper functions for the server
 * Includes email normalization, URL signing, and AI prompt building
 */

import { Storage } from "@google-cloud/storage";

/**
 * Normalize email addresses to detect alias abuse (especially Gmail)
 */
export function normalizeEmail(email: string): string {
  const [localPart, domain] = email.toLowerCase().split('@');
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    // Gmail ignores '.' and everything after '+'
    const cleanLocal = localPart.split('+')[0].replace(/\./g, '');
    return `${cleanLocal}@${domain}`;
  }
  return email.toLowerCase();
}

/**
 * Generate a signed download URL for export files in GCS
 */
export async function generateSignedDownloadUrl(
  jobId: string,
  fileName: string,
  type: string
): Promise<string | null> {
  const gcsKey = process.env.GCLOUD_KEY_JSON;
  if (!gcsKey) return null;

  try {
    const externalStorage = new Storage({ credentials: JSON.parse(gcsKey) });
    const bucketName = "doculoom-exports";
    const ext = type === "pdf_bulk" ? "zip" : "pdf";
    const gcsPath = `exports/${jobId}.${ext}`;
    const [url] = await externalStorage.bucket(bucketName).file(gcsPath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
      responseDisposition: `attachment; filename="${fileName.replace(/"/g, '\\"')}"`
    });
    return url;
  } catch (e) {
    console.error(`Failed to sign URL for job ${jobId}`, e);
    return null;
  }
}

/**
 * Configuration for AI enrichment operations
 */
export interface EnrichmentConfig {
  type: string;
  tone?: string;
  targetLanguage?: string;
  currencySymbol?: string;
  currencyPlacement?: 'before' | 'after';
  currencySpacing?: boolean;
  currencyDecimals?: 'default' | 'whole' | 'two';
  currencyThousandSeparator?: boolean;
  measurementUnit?: string;
  measurementFormat?: 'abbr' | 'full';
  measurementSpacing?: boolean;
  customInstructions?: string;
}

/**
 * Build dynamic AI prompt based on enrichment configuration
 */
export function buildDynamicPrompt(config: EnrichmentConfig): string {
  const {
    type, tone, targetLanguage, currencySymbol, currencyPlacement,
    currencySpacing, currencyDecimals, currencyThousandSeparator,
    measurementUnit, measurementFormat, measurementSpacing
  } = config;

  let instructions = "";

  switch (type) {
    case "marketing":
      instructions = "Write a compelling marketing description highlighting key features.";
      break;
    case "seo":
      instructions = "Write a short, punchy, SEO-optimized product title (under 60 chars).";
      break;
    case "features":
      instructions = "Extract the technical specs and return them as a bulleted list (use • character).";
      break;
    case "email":
      instructions = "Write a short, persuasive sales email blurb introducing this product.";
      break;
    case "social":
      instructions = "Write an engaging social media caption with relevant hashtags.";
      break;
    case "translation":
      instructions = `Translate the provided text strictly into ${targetLanguage || 'English'}. Ensure regional nuances are respected. Keep any HTML like "<br>" exactly as is.`;
      break;
    case "currency":
      instructions = `Identify all price/monetary values. Format them strictly as ${currencySymbol || '$'}. `;
      if (currencyPlacement === 'after') {
        instructions += "Place the currency symbol AFTER the number. ";
      } else {
        instructions += "Place the currency symbol BEFORE the number. ";
      }
      if (currencySpacing) {
        instructions += "Insert a single space between the symbol and the number (e.g. '$ 10'). ";
      } else {
        instructions += "Do NOT place a space between the symbol and the number (e.g. '$10'). ";
      }
      if (currencyDecimals === 'whole') {
        instructions += "Round all values to the nearest whole number (no decimals). ";
      } else if (currencyDecimals === 'two') {
        instructions += "Ensure exactly two decimal places for all values (e.g. 10.00). ";
      }
      if (currencyThousandSeparator) {
        instructions += "Use a comma as a thousand separator. ";
      } else {
        instructions += "Do NOT use thousand separators. ";
      }
      break;
    case "measurements":
      const unit = measurementUnit || 'cm';
      const targetUnit = measurementFormat === 'full'
        ? ({ 'in': 'inches', 'cm': 'centimeters', 'mm': 'millimeters', 'lb': 'pounds', 'kg': 'kilograms' }[unit] || unit)
        : unit;
      const spaceChar = measurementSpacing !== false ? " " : "";
      instructions = `Identify ALL numeric values. Treat them as measurements. Format them to use the unit "${targetUnit}". Formatting Rules: 1. Append "${targetUnit}" to every number found.${spaceChar ? ' Insert a space between number and unit.' : ' Do NOT put a space between number and unit.'} 2. If a field contains multiple numbers, apply unit to EACH. 3. Keep original separators.`;
      break;
    case "title_case":
      instructions = "Convert the text to Title Case (Capitalize First Letter of Each Major Word).";
      break;
    case "uppercase":
      instructions = "Convert the text to UPPERCASE.";
      break;
    case "clean_text":
      instructions = "Remove all special characters, emojis, and HTML tags.";
      break;
    case "custom":
      instructions = config.customInstructions || "Follow the user's request.";
      break;
    default:
      instructions = "Analyze the product data.";
  }

  if (tone && !['currency', 'measurements', 'title_case', 'uppercase', 'clean_text'].includes(type)) {
    instructions += ` Tone: ${tone}.`;
  }

  instructions += `\n\nCRITICAL FORMATTING RULES: 1. Do NOT use actual newline characters (\\n). 2. If separating lines, use "<br>". 3. Return ONLY the final formatted string.`;
  return instructions;
}
