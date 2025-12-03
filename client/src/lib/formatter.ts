import { type ElementFormat } from "@shared/schema";

// Helper: Decimal to Fraction Logic
function toFraction(value: number, precision: number = 16): string {
  const wholeNumber = Math.floor(value);
  const decimalPart = value - wholeNumber;

  // If basically an integer, return just the integer
  if (Math.abs(decimalPart) < 0.0001) return wholeNumber.toString();

  // Calculate numerator for the chosen precision (e.g. 16ths)
  let numerator = Math.round(decimalPart * precision);
  let denominator = precision;

  // Reduce fraction (GCD)
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const commonDivisor = gcd(numerator, denominator);

  numerator /= commonDivisor;
  denominator /= commonDivisor;

  // Handle case where rounding bumped it to the next whole number
  if (numerator === denominator) {
    return (wholeNumber + 1).toString();
  }

  if (numerator === 0) {
    return wholeNumber.toString();
  }

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

// MAIN FUNCTION: formatContent
export function formatContent(content: string | undefined, format?: ElementFormat): string {
  if (!content) return "";
  if (!format) return content;

  // 1. DATA TYPE: NUMBER
  if (format.dataType === "number") {
    // Clean string to get raw number (remove existing $ or units if user typed them)
    const rawNum = parseFloat(content.replace(/[^\d.-]/g, ''));
    if (isNaN(rawNum)) return content; // Fallback if not a number

    let result = "";

    if (format.useFractions) {
      result = toFraction(rawNum, format.fractionPrecision);
    } else {
      result = rawNum.toFixed(format.decimalPlaces ?? 2);
    }

    // Append Unit
    if (format.unit) {
      // Handle prefix units like $ separately if needed, but for now specific requests were suffix
      if (format.unit === "$") result = `$${result}`;
      else result = `${result} ${format.unit}`;
    }

    return result;
  }

  // 2. DATA TYPE: DATE
  if (format.dataType === "date") {
    const date = new Date(content);
    if (isNaN(date.getTime())) return content;

    // Simple format map
    switch (format.dateFormat) {
      case "MM/DD/YYYY":
        return date.toLocaleDateString('en-US'); // 12/25/2025
      case "DD/MM/YYYY":
        return date.toLocaleDateString('en-GB'); // 25/12/2025
      case "YYYY-MM-DD":
        return date.toISOString().split('T')[0]; // 2025-12-25
      case "MMM D, YYYY":
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      case "MMMM D, YYYY":
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      default:
        return date.toLocaleDateString();
    }
  }

  // 3. DATA TYPE: BOOLEAN
  if (format.dataType === "boolean") {
    const isTrue = ["true", "1", "yes", "on"].includes(content.toLowerCase());
    if (isTrue) return format.trueLabel || "Yes";
    return format.falseLabel || "No";
  }

  // 4. DATA TYPE: TEXT (Default)
  let text = content;
  switch (format.casing) {
    case "upper": text = text.toUpperCase(); break;
    case "lower": text = text.toLowerCase(); break;
    case "title": text = toTitleCase(text); break;
  }

  return text;
}