import { type ElementFormat } from "@shared/schema";

// Helper: Decimal to Fraction Logic
function toFraction(value: number, precision: number = 16): string {
  const wholeNumber = Math.floor(value);
  const decimalPart = value - wholeNumber;
  if (Math.abs(decimalPart) < 0.0001) return wholeNumber.toString();
  let numerator = Math.round(decimalPart * precision);
  let denominator = precision;
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const commonDivisor = gcd(numerator, denominator);
  numerator /= commonDivisor;
  denominator /= commonDivisor;
  if (numerator === denominator) return (wholeNumber + 1).toString();
  if (numerator === 0) return wholeNumber.toString();
  return wholeNumber === 0 
    ? `${numerator}/${denominator}` 
    : `${wholeNumber} ${numerator}/${denominator}`;
}

// Helper: Title Case
function toTitleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

// Helper: Check if content looks like HTML
function isHtml(content: string): boolean {
  if (!content) return false;
  return /<[a-z][\s\S]*>/i.test(content);
}

// Helper: Apply casing only to text nodes within HTML
function applyCasingToHtml(html: string, casing: "upper" | "lower" | "title" | "none"): string {
  if (typeof document === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  const walk = (node: Node) => {
    if (node.nodeType === 3) { // TEXT_NODE
      const text = node.nodeValue || "";
      if (text.trim().length > 0) {
        let newText = text;
        switch (casing) {
          case "upper": newText = text.toUpperCase(); break;
          case "lower": newText = text.toLowerCase(); break;
          case "title": newText = toTitleCase(text); break;
        }
        if (newText !== text) node.nodeValue = newText;
      }
    } else {
      node.childNodes.forEach(walk);
    }
  };
  walk(div);
  return div.innerHTML;
}

// MAIN FUNCTION
export function formatContent(content: string | undefined, format?: ElementFormat): string {
  if (!content) return "";
  if (!format) return content;

  // 1. DATA TYPE: NUMBER
  if (format.dataType === "number") {
    const rawNum = parseFloat(content.replace(/[^\d.-]/g, ''));
    if (isNaN(rawNum)) return content;
    let result = format.useFractions
      ? toFraction(rawNum, format.fractionPrecision)
      : rawNum.toFixed(format.decimalPlaces ?? 2);

    if (format.unit) {
      if (format.unit === "$") result = `$${result}`;
      else result = `${result} ${format.unit}`;
    }
    return result;
  }

  // 2. DATA TYPE: DATE
  if (format.dataType === "date") {
    const date = new Date(content);
    if (isNaN(date.getTime())) return content;
    switch (format.dateFormat) {
      case "MM/DD/YYYY": return date.toLocaleDateString('en-US');
      case "DD/MM/YYYY": return date.toLocaleDateString('en-GB');
      case "YYYY-MM-DD": return date.toISOString().split('T')[0];
      case "MMM D, YYYY": return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      case "MMMM D, YYYY": return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      default: return date.toLocaleDateString();
    }
  }

  // 3. DATA TYPE: BOOLEAN
  if (format.dataType === "boolean") {
    const isTrue = ["true", "1", "yes", "on"].includes(content.toLowerCase());
    return isTrue ? (format.trueLabel || "Yes") : (format.falseLabel || "No");
  }

  // 4. DATA TYPE: TEXT
  let text = content;

  if (isHtml(text)) {
    // FIX 1: Safely apply casing to HTML content without breaking tags
    if (format.casing && format.casing !== "none") {
      text = applyCasingToHtml(text, format.casing);
    }
  } else {
    // Standard text casing
    switch (format.casing) {
      case "upper": text = text.toUpperCase(); break;
      case "lower": text = text.toLowerCase(); break;
      case "title": text = toTitleCase(text); break;
    }
  }

  // 5. LIST STYLING (For plain text only)
  if (format.listStyle && format.listStyle !== 'none') {
    // Only apply manual list wrapping if it's NOT already HTML
    if (!isHtml(text)) {
       const items = text.split('\n').filter(line => line.trim() !== '');
       if (items.length > 0) {
         const tag = format.listStyle === 'decimal' ? 'ol' : 'ul';
         return `<${tag}>${items.map(i => `<li>${i}</li>`).join('')}</${tag}>`;
       }
    }
  }

  return text;
}