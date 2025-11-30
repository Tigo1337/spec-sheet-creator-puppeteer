import * as XLSX from "xlsx";
import type { ExcelData } from "@shared/schema";
import { nanoid } from "nanoid";

export interface ParsedExcelResult {
  success: boolean;
  data?: ExcelData;
  error?: string;
}

export async function parseExcelFile(file: File): Promise<ParsedExcelResult> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    
    // Get the first sheet
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { success: false, error: "No sheets found in the workbook" };
    }
    
    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      return { success: false, error: "Could not read worksheet" };
    }
    
    // Convert to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      header: 1,
      raw: false,
      defval: "",
    }) as unknown[][];
    
    if (jsonData.length === 0) {
      return { success: false, error: "The spreadsheet is empty" };
    }
    
    // First row is headers
    const headers = (jsonData[0] as string[]).map((h) => String(h || "").trim()).filter(Boolean);
    
    if (headers.length === 0) {
      return { success: false, error: "No column headers found in the first row" };
    }
    
    // Convert remaining rows to objects
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < jsonData.length; i++) {
      const rowData = jsonData[i] as string[];
      if (!rowData || rowData.every((cell) => !cell)) continue;
      
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = String(rowData[index] || "");
      });
      rows.push(row);
    }
    
    const excelData: ExcelData = {
      id: nanoid(),
      fileName: file.name,
      headers,
      rows,
      uploadedAt: new Date().toISOString(),
    };
    
    return { success: true, data: excelData };
  } catch (error) {
    console.error("Excel parsing error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse Excel file",
    };
  }
}

export function parseCSVFile(file: File): Promise<ParsedExcelResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          resolve({ success: false, error: "Could not read file content" });
          return;
        }
        
        const lines = text.split(/\r?\n/).filter((line) => line.trim());
        if (lines.length === 0) {
          resolve({ success: false, error: "The file is empty" });
          return;
        }
        
        // Parse headers from first line
        const headers = parseCSVLine(lines[0]).map((h) => h.trim()).filter(Boolean);
        
        if (headers.length === 0) {
          resolve({ success: false, error: "No column headers found" });
          return;
        }
        
        // Parse data rows
        const rows: Record<string, string>[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.every((v) => !v.trim())) continue;
          
          const row: Record<string, string> = {};
          headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || "";
          });
          rows.push(row);
        }
        
        const excelData: ExcelData = {
          id: nanoid(),
          fileName: file.name,
          headers,
          rows,
          uploadedAt: new Date().toISOString(),
        };
        
        resolve({ success: true, data: excelData });
      } catch (error) {
        resolve({
          success: false,
          error: error instanceof Error ? error.message : "Failed to parse CSV file",
        });
      }
    };
    
    reader.onerror = () => {
      resolve({ success: false, error: "Failed to read file" });
    };
    
    reader.readAsText(file);
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

export function isExcelFile(file: File): boolean {
  const excelTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.oasis.opendocument.spreadsheet",
  ];
  const excelExtensions = [".xlsx", ".xls", ".ods"];
  
  return (
    excelTypes.includes(file.type) ||
    excelExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
  );
}

export function isCSVFile(file: File): boolean {
  return (
    file.type === "text/csv" ||
    file.type === "application/csv" ||
    file.name.toLowerCase().endsWith(".csv")
  );
}

export async function parseDataFile(file: File): Promise<ParsedExcelResult> {
  if (isExcelFile(file)) {
    return parseExcelFile(file);
  } else if (isCSVFile(file)) {
    return parseCSVFile(file);
  } else {
    return {
      success: false,
      error: "Unsupported file type. Please upload an Excel (.xlsx, .xls) or CSV file.",
    };
  }
}
