import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { google } from 'googleapis';

dotenv.config();

const app = express();
const port = process.env.PORT || 4001;

// CORS configuration - allow frontend deployed on Vercel and local network
// Backend is deployed at: https://exam-verification-1.onrender.com
// Frontend is deployed at: https://exam-verification.vercel.app
const allowedOrigins = [
  'https://exam-verification.vercel.app', // Vercel frontend (production)
  'https://exam-verification.vercel.app/', // Vercel frontend with trailing slash
  'http://localhost:5173', // Vite dev server
  'http://localhost:3000',
  'http://localhost:4001',
  'http://10.10.10.52:5173', // WiFi IP for frontend
  'http://10.10.10.52:4001', // WiFi IP for backend
];

// CORS middleware with explicit configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      
      // Normalize origin (remove trailing slash for comparison)
      const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
      
      // Check if origin is in allowed list
      const isAllowed = allowedOrigins.some(allowed => {
        const normalizedAllowed = allowed.endsWith('/') ? allowed.slice(0, -1) : allowed;
        return normalizedOrigin === normalizedAllowed;
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        // Log for debugging but allow for now (can be restricted later)
        console.log(`⚠️  CORS: Request from unlisted origin: ${origin}`);
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
    ],
    exposedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// Explicit OPTIONS handler for preflight requests (additional safety)
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.sendStatus(204);
});

// CORS logging middleware (for debugging - can be removed in production)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    console.log(`🔍 CORS Preflight: ${req.method} ${req.path} from origin: ${req.headers.origin || 'no origin'}`);
  }
  next();
});

app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  SHEET_ID = '1w6K6K4zMiSkMGlXswOdka3GuqzcpZzh0YBai8zl26kE',
  SHEET_RANGE = 'student_exam_data!A2:L',
  GOOGLE_APPLICATION_CREDENTIALS,
} = process.env;

const [sheetNamePart = 'student_exam_data', columnRangePart = 'A2:L'] = SHEET_RANGE.split('!');
const [startColumnRaw = 'A2', endColumnRaw = 'L'] = columnRangePart.split(':');
const startColumnLetter = startColumnRaw.replace(/\d+/g, '') || 'A';
const endColumnLetter = endColumnRaw.replace(/\d+/g, '') || 'L';
const sheetName = sheetNamePart;

// Determine credentials path with priority:
// 1. GOOGLE_APPLICATION_CREDENTIALS environment variable (highest priority)
// 2. Render secret files location (/etc/secrets/examCredits.json) for production
// 3. App root directory (for Render secret files in root)
// 4. Local development path (credentials.json or examCredits.json in backend directory)
let credentialsPath;
if (GOOGLE_APPLICATION_CREDENTIALS) {
  credentialsPath = path.resolve(GOOGLE_APPLICATION_CREDENTIALS);
  console.log('📁 Using credentials from GOOGLE_APPLICATION_CREDENTIALS environment variable');
} else {
  // Check Render secret files location first (production - /etc/secrets/)
  const renderSecretPath = '/etc/secrets/examCredits.json';
  if (fs.existsSync(renderSecretPath)) {
    credentialsPath = renderSecretPath;
    console.log('📁 Using Render secret file from /etc/secrets/examCredits.json');
  } else {
    // Check app root directory (Render can also place secret files in root)
    const rootPathExamCredits = path.join(process.cwd(), 'examCredits.json');
    const rootPathCredentials = path.join(process.cwd(), 'credentials.json');
    if (fs.existsSync(rootPathExamCredits)) {
      credentialsPath = rootPathExamCredits;
      console.log('📁 Using credentials from app root directory (examCredits.json)');
    } else if (fs.existsSync(rootPathCredentials)) {
      credentialsPath = rootPathCredentials;
      console.log('📁 Using credentials from app root directory (credentials.json)');
    } else {
      // Fall back to local development path - check both filenames
      const localExamCredits = path.join(__dirname, 'examCredits.json');
      const localCredentials = path.join(__dirname, 'credentials.json');
      if (fs.existsSync(localExamCredits)) {
        credentialsPath = localExamCredits;
        console.log('📁 Using local credentials file from backend directory (examCredits.json)');
      } else if (fs.existsSync(localCredentials)) {
        credentialsPath = localCredentials;
        console.log('📁 Using local credentials file from backend directory (credentials.json)');
      } else {
        // Default to examCredits.json for new setups
        credentialsPath = localExamCredits;
        console.log('📁 Defaulting to examCredits.json (file not found yet)');
      }
    }
  }
}

let initializationError = null;
let serviceAccountEmail = '';

if (!fs.existsSync(credentialsPath)) {
  initializationError = new Error(
    `Google service account credentials not found at ${credentialsPath}. ` +
      'Ensure the examCredits.json file exists in Render Secret Files (/etc/secrets/examCredits.json) or set GOOGLE_APPLICATION_CREDENTIALS environment variable.'
  );
  console.error(`❌ ${initializationError.message}`);
  console.error(`❌ Checked paths:`);
  console.error(`   - /etc/secrets/examCredits.json (Render Secret Files)`);
  console.error(`   - ${path.join(process.cwd(), 'examCredits.json')} (App root)`);
  console.error(`   - ${path.join(__dirname, 'examCredits.json')} (Backend directory)`);
} else {
  try {
    const credentialsContent = fs.readFileSync(credentialsPath, 'utf8').trim();
    
    if (!credentialsContent) {
      initializationError = new Error('Credentials file is empty.');
      console.error(`❌ ${initializationError.message}`);
    } else {
      const credentials = JSON.parse(credentialsContent);
      if (!credentials || typeof credentials !== 'object') {
        initializationError = new Error('Invalid credentials file: not a valid JSON object.');
        console.error(`❌ ${initializationError.message}`);
      } else if (!credentials.client_email || !credentials.private_key) {
        initializationError = new Error('Invalid credentials file: missing client_email or private_key.');
        console.error(`❌ ${initializationError.message}`);
      } else {
        serviceAccountEmail = credentials.client_email;
        console.log(`✅ Credentials loaded from: ${credentialsPath}`);
        console.log(`📧 Service Account Email: ${serviceAccountEmail}`);
        console.log(`📊 Sheet ID: ${SHEET_ID}`);
        console.log(`📋 Sheet Range: ${SHEET_RANGE}`);
      }
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      initializationError = new Error(`Invalid JSON in credentials file: ${error.message}`);
    } else {
      initializationError = new Error(`Failed to read credentials file: ${error.message}`);
    }
    console.error(`❌ ${initializationError.message}`);
  }
}

// ============================================================================
// GOOGLE SHEETS COLUMN DEFINITION (Order is CRITICAL - must match sheet)
// ============================================================================
// Column A: Name
// Column B: MobileNo (UNIQUE KEY - used to prevent duplicates)
// Column C: District
// Column D: State
// Column E: Paid
// Column F: FeeAmount (NEW - fee amount paid by student)
// Column G: Attempted
// Column H: RetakeAllowed
// Column I: LastApprovedAt
// Column J: (reserved/empty)
// Column K: (reserved/empty)
// Column L: CreatedAt (set once on creation, NEVER overwritten)
// ============================================================================
const HEADERS = [
  'Name',
  'MobileNo',
  'District',
  'State',
  'Paid',
  'FeeAmount', // Column F - NEW
  'Attempted',
  'RetakeAllowed',
  'LastApprovedAt',
  '', // Column J - reserved/empty
  '', // Column K - reserved/empty
  'CreatedAt', // Column L
];

const googleAuth = !initializationError
  ? new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
  : null;

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

if (initializationError) {
  console.error(
    '⚠️  Google Sheets integration is not fully initialized. API responses will indicate invalid credentials until resolved.'
  );
}

async function getSheetsClient() {
  if (initializationError || !googleAuth) {
    const error = new Error(
      initializationError?.message ??
        'Google Sheets credentials are missing or invalid. Please check your configuration.'
    );
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  try {
    const authClient = await googleAuth.getClient();
    return google.sheets({ version: 'v4', auth: authClient });
  } catch (error) {
    console.error('❌ Failed to initialize Google Sheets client:', error.message);
    throw new Error('Google Sheets authentication failed. Check your credentials.');
  }
}

function getErrorMessage(error) {
  if (error.code === 'INVALID_CREDENTIALS') {
    return 'Google Sheets credentials are missing or invalid. Verify credentials.json and environment configuration.';
  }
  if (error.code === 403) {
    return 'Permission denied. Ensure the Google Sheet is shared with the service account email.';
  }
  if (error.code === 404) {
    return 'Google Sheet not found. Check the Sheet ID in your configuration.';
  }
  if (error.code === 400) {
    return 'Invalid request. Check the sheet range and data format.';
  }
  if (error.message) {
    return error.message;
  }
  return 'Unknown error occurred while accessing Google Sheets.';
}

function mapRowToStudent(row, rowNumber) {
  // CRITICAL: Must preserve ALL 12 columns (A through L), including J and K
  // Store column J and K values even though they don't have header names
  const data = HEADERS.reduce((acc, header, index) => {
    if (header && header.trim() !== '') {
      // Map named columns (A-I, L)
      acc[header] = row[index] ?? '';
    } else {
      // Preserve columns J and K values (index 9 and 10)
      if (index === 9) {
        acc['_columnJ'] = row[index] ?? ''; // Store column J value
      } else if (index === 10) {
        acc['_columnK'] = row[index] ?? ''; // Store column K value
      }
    }
    return acc;
  }, {});

  return {
    ...data,
    rowNumber,
  };
}

function normalizeYesNo(value) {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'yes' ? 'Yes' : 'No';
  }
  return 'No';
}

/**
 * Builds a row array from a student object
 * CRITICAL: Must return exactly 12 values matching the HEADERS array (A through L)
 * This ensures updates don't shift or overwrite adjacent rows
 * 
 * @param {Object} student - Student object with all fields
 * @returns {Array<string>} - Array of exactly 12 values matching HEADERS order
 */
function buildRowFromStudent(student) {
  // CRITICAL: Must build exactly 12 columns (A through L) in correct order
  const row = HEADERS.map((header, index) => {
    // Handle columns J and K (index 9 and 10) - preserve existing values
    if (!header || header.trim() === '') {
      if (index === 9) {
        // Column J - preserve existing value or empty string
        return student['_columnJ'] ?? '';
      } else if (index === 10) {
        // Column K - preserve existing value or empty string
        return student['_columnK'] ?? '';
      }
      return '';
    }
    
    // Handle named columns (A-I, L)
    const value = student[header];
    // Return empty string if value is undefined, null, or empty
    if (value === undefined || value === null) return '';
    return String(value).trim();
  });
  
  // CRITICAL VALIDATION: Must have exactly 12 columns (A through L)
  if (row.length !== HEADERS.length) {
    console.error(`❌ CRITICAL ERROR: Row has ${row.length} columns, expected ${HEADERS.length}`);
    throw new Error(`Row must have exactly ${HEADERS.length} columns (got ${row.length})`);
  }
  
  return row;
}

/**
 * Builds the exact update range for a specific row
 * CRITICAL: Uses explicit A{row}:L{row} format to ensure only that row is updated
 * 
 * @param {number} rowNumber - The 1-indexed row number in the sheet (row 1 = header, row 2 = first data)
 * @returns {string} - Range string like "student_exam_data!A5:L5"
 */
function buildUpdateRange(rowNumber) {
  // CRITICAL: Use explicit A:L range for exactly 12 columns (A through L)
  // This ensures we update ONLY the specified row and don't affect adjacent rows
  return `${sheetName}!A${rowNumber}:L${rowNumber}`;
}

function parseIsoDate(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Converts current date/time to IST (Indian Standard Time) and returns as ISO string
 * IST is UTC+5:30
 * 
 * @returns {string} - ISO string in IST timezone (format: YYYY-MM-DDTHH:mm:ss.sss+05:30)
 */
function getCurrentISTTimestamp() {
  const now = new Date();
  // IST is UTC+5:30 (5 hours 30 minutes = 330 minutes = 19800000 milliseconds)
  const istOffsetMs = 5.5 * 60 * 60 * 1000; // 19800000 milliseconds
  const istTime = new Date(now.getTime() + istOffsetMs);
  
  // Get UTC components (since we've already added the offset)
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  const hours = String(istTime.getUTCHours()).padStart(2, '0');
  const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
  const milliseconds = String(istTime.getUTCMilliseconds()).padStart(3, '0');
  
  // Return in ISO format with +05:30 timezone indicator
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}+05:30`;
}

// Normalize mobile number for comparison (remove all non-digits)
function normalizeMobileNumber(mobileNo) {
  if (!mobileNo) return '';
  return mobileNo.toString().replace(/\D/g, ''); // Remove all non-digits
}

/**
 * STRICT NO-DUPLICATE VALIDATION
 * This function ensures that before any write operation, we verify no duplicate exists.
 * Returns the existing student if found, null otherwise.
 * 
 * @param {string} mobileNo - The mobile number to check (will be normalized)
 * @returns {Promise<Object|null>} - Existing student object or null
 */
async function ensureNoDuplicate(mobileNo) {
  const normalizedMobileNo = normalizeMobileNumber(mobileNo);
  if (!normalizedMobileNo) {
    return null;
  }
  return await findStudentByMobile(normalizedMobileNo);
}

async function findStudentByMobile(mobileNo) {
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
    });

    const rows = response.data.values ?? [];
    if (rows.length === 0) {
      console.log('No rows found in sheet');
      return null;
    }

    // Normalize the search mobile number
    const searchMobile = normalizeMobileNumber(mobileNo);
    console.log(`🔍 Searching for mobile: "${mobileNo}" (normalized: "${searchMobile}")`);

    // Check if first row is header (if range starts from A1)
    const startRow = SHEET_RANGE.includes('A1') ? 1 : 0;
    const dataRows = startRow === 1 ? rows.slice(1) : rows;
    
    // Log header row for debugging if A1 range
    if (startRow === 1 && rows.length > 0) {
      console.log(`📋 Header row: ${JSON.stringify(rows[0])}`);
    }
    
    console.log(`📊 Total data rows to search: ${dataRows.length}`);

    // Find matching row by comparing normalized mobile numbers
    const index = dataRows.findIndex((row, idx) => {
      // Skip empty rows or rows without enough columns
      if (!row || row.length < 2) {
        return false;
      }
      
      const rowMobile = normalizeMobileNumber(row[1] ?? '');
      // Skip if mobile number is empty
      if (!rowMobile) {
        return false;
      }
      
      const match = rowMobile === searchMobile;
      if (match) {
        const actualRowNum = startRow === 1 ? idx + 2 : idx + 1;
        console.log(`✅ Found match at sheet row ${actualRowNum}, mobile: "${row[1]}" (normalized: "${rowMobile}")`);
      }
      return match;
    });

    if (index === -1) {
      console.log(`No match found. Searched ${dataRows.length} rows.`);
      // Log first few mobile numbers for debugging
      if (dataRows.length > 0) {
        console.log('Sample mobile numbers in sheet:', dataRows.slice(0, 3).map(r => normalizeMobileNumber(r[1] ?? '')));
      }
      return null;
    }

    // Calculate actual row number in sheet (1-indexed)
    // CRITICAL: If header exists (startRow === 1):
    //   - index 0 (first data row) → row 2 (row 1 is header)
    //   - index 1 (second data row) → row 3
    //   Formula: rowNumber = index + 2 (MANDATORY - never use +1)
    // If no header (startRow === 0):
    //   - index 0 → row 1
    //   Formula: rowNumber = index + 1
    const rowNumber = index + 2;
console.log(`📍 Calculated row number (FIXED): ${rowNumber} (index: ${index}, SHEET_RANGE: ${SHEET_RANGE})`);
return mapRowToStudent(dataRows[index], rowNumber);
  } catch (error) {
    console.error('❌ Error in findStudentByMobile:', error);
    throw error;
  }
}

app.get('/student', async (req, res) => {
  const { mobileNo } = req.query;

  if (!mobileNo || !mobileNo.trim()) {
    return res.status(400).json({ 
      error: 'mobileNo query parameter is required.',
      message: 'Please provide a mobile number to search.' 
    });
  }

  try {
    const student = await findStudentByMobile(mobileNo.trim());
    if (!student) {
      return res.status(404).json({ 
        message: 'Student not found.',
        found: false 
      });
    }
    return res.json({ student });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error('❌ Error fetching student:', {
      message: errorMessage,
      code: error.code,
      mobileNo: mobileNo?.trim(),
      stack: error.stack,
      errorType: error.constructor.name
    });
    
    // Check for credential errors
    if (error.code === 'INVALID_CREDENTIALS' || initializationError) {
      return res.status(500).json({ 
        error: 'Credentials Error',
        message: initializationError?.message || 'Google Sheets credentials are missing or invalid.',
        details: 'Please ensure examCredits.json is properly configured in Render Secret Files at /etc/secrets/examCredits.json',
        troubleshooting: [
          'Check that examCredits.json exists in Render Secret Files',
          'Verify the file path: /etc/secrets/examCredits.json',
          'Ensure the credentials file contains valid JSON with client_email and private_key'
        ]
      });
    }
    
    // Return specific error messages based on error type
    if (error.code === 403) {
      return res.status(403).json({ 
        error: 'Permission denied',
        message: 'Could not access Google Sheets. Please ensure the sheet is shared with the service account email.',
        details: errorMessage,
        serviceAccountEmail: serviceAccountEmail || 'Not available'
      });
    }
    if (error.code === 404) {
      return res.status(404).json({ 
        error: 'Sheet not found',
        message: 'The Google Sheet could not be found. Please check the Sheet ID.',
        details: errorMessage,
        sheetId: SHEET_ID
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to fetch student data',
      message: 'Could not connect to Google Sheets. Please check your connection and credentials.',
      details: errorMessage,
      errorCode: error.code || 'UNKNOWN',
      troubleshooting: [
        'Check Render logs for detailed error information',
        'Verify examCredits.json is in Render Secret Files',
        'Ensure the Google Sheet is shared with the service account',
        'Check that the Sheet ID is correct'
      ]
    });
  }
});

app.get('/students', async (req, res) => {
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
    });

    const rows = response.data.values ?? [];
    if (rows.length === 0) {
      return res.json({ students: [] });
    }

    const startRow = SHEET_RANGE.includes('A1') ? 1 : 0;
    const dataRows = startRow === 1 ? rows.slice(1) : rows;

    const students = dataRows
      .filter((row) => row && row.length >= 2 && row[0] && row[1]) // Filter out empty rows
      .map((row, idx) => {
        const rowNumber = startRow === 1 ? idx + 2 : idx + 1;
        return mapRowToStudent(row, rowNumber);
      });

    return res.json({ students });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error('❌ Error fetching all students:', {
      message: errorMessage,
      code: error.code,
      stack: error.stack
    });
    
    if (error.code === 403) {
      return res.status(403).json({ 
        error: 'Permission denied',
        message: 'Could not access Google Sheets. Please ensure the sheet is shared with the service account email.',
        details: errorMessage
      });
    }
    if (error.code === 404) {
      return res.status(404).json({ 
        error: 'Sheet not found',
        message: 'The Google Sheet could not be found. Please check the Sheet ID.',
        details: errorMessage
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to fetch students data',
      message: 'Could not connect to Google Sheets. Please check your connection and credentials.',
      details: errorMessage
    });
  }
});

// ============================================================================
// POST /student - Create or update student record
// ============================================================================
// STRICT NO-DUPLICATE RULE: MobileNo is the UNIQUE KEY
// 
// BEFORE ANY WRITE OPERATION:
//   1. Always check if MobileNo exists using findStudentByMobile()
//   2. Normalize mobile number (remove non-digits) for comparison
//
// IF MobileNo EXISTS:
//   ✅ UPDATE the existing row (same row number)
//   ❌ NEVER append a new row
//   ✅ Preserve CreatedAt (never overwrite)
//   ✅ Update: Name, District, State, Paid
//
// IF MobileNo DOES NOT EXIST:
//   ✅ APPEND new row
//   ✅ Set CreatedAt = current timestamp
//   ✅ Set LastApprovedAt = empty (will be set on approval)
//
// MULTIPLE SAFETY CHECKS:
//   - Initial check before any operation
//   - Final check before append
//   - Pre-append check right before writing
//
// This ensures NO DUPLICATES can ever be created.
// ============================================================================
app.post('/student', async (req, res) => {
  const { Name, MobileNo, District, State, Paid, FeeAmount } = req.body;

  if (!Name || !MobileNo || !District || !State || typeof Paid === 'undefined') {
    return res.status(400).json({
      error: 'Name, MobileNo, District, State, and Paid are required.',
      message: 'Please fill in all required fields.',
    });
  }

  // FeeAmount is required for new users (will be validated when creating new user)
  if (FeeAmount === undefined || FeeAmount === null || FeeAmount === '') {
    return res.status(400).json({
      error: 'FeeAmount is required.',
      message: 'Please provide the fee amount.',
    });
  }

  try {
    // Normalize mobile number (trim and remove spaces)
    const normalizedMobileNo = normalizeMobileNumber(MobileNo);
    if (!normalizedMobileNo) {
      return res.status(400).json({
        error: 'Invalid mobile number.',
        message: 'Please provide a valid mobile number.',
      });
    }

    const sheets = await getSheetsClient();
    const existingStudent = await findStudentByMobile(normalizedMobileNo);
    const normalizedPaid = normalizeYesNo(Paid);

    if (existingStudent) {
      // Duplicate detected - update existing record instead of creating new one
      console.log(`⚠️  Duplicate mobile number detected: "${normalizedMobileNo}". Updating existing record at row ${existingStudent.rowNumber} instead of creating duplicate.`);
      
      // Preserve CreatedAt - never overwrite it
      // CRITICAL: Preserve ALL columns including J, K, and FeeAmount
      const updatedStudent = {
        ...existingStudent, // This preserves _columnJ, _columnK, CreatedAt, FeeAmount, and all other fields
        Name: Name.trim(),
        MobileNo: normalizedMobileNo, // Use normalized mobile number
        District: District.trim(),
        State: State.trim(),
        Paid: normalizedPaid,
        // Update FeeAmount only if provided in request, otherwise preserve existing value
        FeeAmount: FeeAmount !== undefined && FeeAmount !== null && FeeAmount !== '' 
          ? String(FeeAmount).trim() 
          : (existingStudent.FeeAmount ?? ''),
        // CRITICAL: Preserve CreatedAt exactly as-is - NEVER set new timestamp for existing users
        CreatedAt: existingStudent.CreatedAt ?? '',
        // Preserve LastApprovedAt unless it's being updated elsewhere
        LastApprovedAt: existingStudent.LastApprovedAt || '',
        // Ensure columns J and K are preserved
        _columnJ: existingStudent._columnJ ?? '',
        _columnK: existingStudent._columnK ?? '',
      };

      // CRITICAL: Use explicit A{row}:L{row} range to update ONLY this row
      const sheetRow = existingStudent.rowNumber;
      const updateRange = buildUpdateRange(sheetRow);
      const updateValues = buildRowFromStudent(updatedStudent);
      
      // Validate we have exactly 12 values (A through L)
      if (updateValues.length !== 12) {
        throw new Error(`Update values must have exactly 12 columns, got ${updateValues.length}`);
      }
      
      // DEBUG LOGGING: Confirm update details
      console.log(`📝 Updating sheet row: ${sheetRow}`);
      console.log(`📝 Update range: ${updateRange}`);
      console.log(`📝 Data being written (12 columns):`, updateValues);
      console.log(`📝 MobileNo: ${normalizedMobileNo}, CreatedAt preserved: ${updatedStudent.CreatedAt}`);
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: updateRange,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [updateValues], // Exactly 1 row with 12 columns
        },
      });

      console.log(`✅ Successfully updated existing student record at row ${sheetRow} for mobile: ${normalizedMobileNo}`);
      return res.status(200).json({ student: updatedStudent, updated: true });
    }

    // STRICT NO-DUPLICATE RULE: Final check before appending
    // This is a critical safety measure to prevent any possibility of duplicates
    const finalCheck = await findStudentByMobile(normalizedMobileNo);
    if (finalCheck) {
      // CRITICAL: If we reach here and a record exists, we MUST update, never append
      console.log(`🚨 CRITICAL: Duplicate detected in final check for mobile: "${normalizedMobileNo}". Updating existing record at row ${finalCheck.rowNumber} - NEVER appending duplicate.`);
      
      // Preserve CreatedAt - never overwrite it
      // CRITICAL: Preserve ALL columns including J, K, and FeeAmount
      const updatedStudent = {
        ...finalCheck, // This preserves _columnJ, _columnK, CreatedAt, FeeAmount, and all other fields
        Name: Name.trim(),
        MobileNo: normalizedMobileNo,
        District: District.trim(),
        State: State.trim(),
        Paid: normalizedPaid,
        // Update FeeAmount only if provided in request, otherwise preserve existing value
        FeeAmount: FeeAmount !== undefined && FeeAmount !== null && FeeAmount !== '' 
          ? String(FeeAmount).trim() 
          : (finalCheck.FeeAmount ?? ''),
        // CRITICAL: Preserve CreatedAt exactly as-is - NEVER set new timestamp for existing users
        CreatedAt: finalCheck.CreatedAt ?? '',
        // Preserve LastApprovedAt unless it's being updated elsewhere
        LastApprovedAt: finalCheck.LastApprovedAt || '',
        // Ensure columns J and K are preserved
        _columnJ: finalCheck._columnJ ?? '',
        _columnK: finalCheck._columnK ?? '',
      };

      // CRITICAL: Use explicit A{row}:L{row} range to update ONLY this row
      const sheetRow = finalCheck.rowNumber;
      const updateRange = buildUpdateRange(sheetRow);
      const updateValues = buildRowFromStudent(updatedStudent);
      
      // Validate we have exactly 12 values (A through L)
      if (updateValues.length !== 12) {
        throw new Error(`Update values must have exactly 12 columns, got ${updateValues.length}`);
      }
      
      // DEBUG LOGGING: Confirm update details
      console.log(`📝 Updating sheet row: ${sheetRow}`);
      console.log(`📝 Update range: ${updateRange}`);
      console.log(`📝 Data being written (12 columns):`, updateValues);
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: updateRange,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [updateValues], // Exactly 1 row with 12 columns
        },
      });

      console.log(`✅ Successfully updated existing student record at row ${sheetRow} for mobile: ${normalizedMobileNo}`);
      return res.status(200).json({ student: updatedStudent, updated: true });
    }

    // Only append if we have confirmed NO existing record exists
    // This is the ONLY place where append is allowed
    // CRITICAL: This is the ONLY place where CreatedAt is set - never set it anywhere else
    // This is the "Add Student & Approve" flow - new users are immediately marked as attempted
    const newStudent = {
      Name: Name.trim(),
      MobileNo: normalizedMobileNo, // Use normalized mobile number
      District: District.trim(),
      State: State.trim(),
      Paid: normalizedPaid,
      FeeAmount: String(FeeAmount).trim(), // Required fee amount for new users
      Attempted: 'Yes', // CRITICAL: New users created via "Add Student & Approve" are immediately marked as attempted
      RetakeAllowed: 'No',
      LastApprovedAt: getCurrentISTTimestamp(), // Set approval timestamp immediately for new users
      _columnJ: '', // Column J - empty for new students
      _columnK: '', // Column K - empty for new students
      CreatedAt: getCurrentISTTimestamp(), // CRITICAL: ONLY set here for new users - NEVER set in update flows
    };

    // Final verification: One more check right before append
    const preAppendCheck = await findStudentByMobile(normalizedMobileNo);
    if (preAppendCheck) {
      console.log(`🚨 CRITICAL: Record appeared between checks for mobile: "${normalizedMobileNo}". Aborting append, updating row ${preAppendCheck.rowNumber} instead.`);
      const updatedStudent = {
        ...preAppendCheck,
        Name: Name.trim(),
        MobileNo: normalizedMobileNo,
        District: District.trim(),
        State: State.trim(),
        Paid: normalizedPaid,
        // Update FeeAmount only if provided in request, otherwise preserve existing value
        FeeAmount: FeeAmount !== undefined && FeeAmount !== null && FeeAmount !== '' 
          ? String(FeeAmount).trim() 
          : (preAppendCheck.FeeAmount ?? ''),
        // CRITICAL: Preserve CreatedAt exactly as-is - NEVER set new timestamp for existing users
        CreatedAt: preAppendCheck.CreatedAt ?? '',
        LastApprovedAt: preAppendCheck.LastApprovedAt || '',
        // Ensure columns J and K are preserved
        _columnJ: preAppendCheck._columnJ ?? '',
        _columnK: preAppendCheck._columnK ?? '',
      };

      // CRITICAL: Use explicit A{row}:L{row} range to update ONLY this row
      const sheetRow = preAppendCheck.rowNumber;
      const updateRange = buildUpdateRange(sheetRow);
      const updateValues = buildRowFromStudent(updatedStudent);
      
      // Validate we have exactly 12 values (A through L)
      if (updateValues.length !== 12) {
        throw new Error(`Update values must have exactly 12 columns, got ${updateValues.length}`);
      }
      
      // DEBUG LOGGING: Confirm update details
      console.log(`📝 Updating sheet row: ${sheetRow}`);
      console.log(`📝 Update range: ${updateRange}`);
      console.log(`📝 Data being written (12 columns):`, updateValues);
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: updateRange,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [updateValues], // Exactly 1 row with 12 columns
        },
      });

      console.log(`✅ Successfully updated existing student record at row ${sheetRow} for mobile: ${normalizedMobileNo}`);
      return res.status(200).json({ student: updatedStudent, updated: true });
    }

    // SAFE TO APPEND: All checks passed, no duplicate exists
    // CRITICAL FINAL SAFEGUARD: One last check before append to prevent duplicates
    const absoluteFinalCheck = await findStudentByMobile(normalizedMobileNo);
    if (absoluteFinalCheck) {
      const errorMsg = `🚨 CRITICAL ERROR: Attempted to append but record exists for mobile ${normalizedMobileNo} at row ${absoluteFinalCheck.rowNumber}. This should never happen!`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Validate new student row has exactly 12 columns
    const newStudentRow = buildRowFromStudent(newStudent);
    if (newStudentRow.length !== 12) {
      throw new Error(`New student row must have exactly 12 columns, got ${newStudentRow.length}`);
    }
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [newStudentRow],
      },
    });
    
    console.log(`✅ Created new student record for mobile: ${normalizedMobileNo} (CreatedAt: ${newStudent.CreatedAt}, Row has ${newStudentRow.length} columns)`);
    return res.status(201).json({ student: newStudent, created: true });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error('❌ Error adding student:', {
      message: errorMessage,
      code: error.code,
      stack: error.stack,
    });
    
    if (error.code === 403) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Could not write to Google Sheets. Please ensure the sheet is shared with the service account email.',
        details: errorMessage,
      });
    }
    if (error.code === 404) {
      return res.status(404).json({
        error: 'Sheet not found',
        message: 'The Google Sheet could not be found. Please check the Sheet ID.',
        details: errorMessage,
      });
    }

    return res.status(500).json({
      error: 'Failed to add student',
      message: 'Could not connect to Google Sheets. Please check your connection and credentials.',
      details: errorMessage,
    });
  }
});

// ============================================================================
// POST /student/update - Update existing student record
// ============================================================================
// STRICT NO-DUPLICATE RULE: This endpoint NEVER creates new records
// 
// BEHAVIOR:
//   ✅ ALWAYS updates the same row (uses row number from existing record)
//   ❌ NEVER appends new rows
//   ❌ NEVER creates duplicates
//   ✅ Returns 404 if student not found (does NOT create new record)
//
// UPDATE LOGIC:
//   1. Find existing record by MobileNo (normalized)
//   2. If found: Update same row with new values
//   3. If not found: Return 404 (do NOT create)
//
// FIELD PRESERVATION:
//   ✅ CreatedAt: NEVER overwritten (always preserved from original)
//   ✅ LastApprovedAt: Updated when approved/retake, preserved otherwise
//   ✅ MobileNo: Normalized and preserved
//   ✅ Other fields: Updated as specified in request
//
// This ensures updates always happen in-place, never creating duplicates.
// ============================================================================
app.post('/student/update', async (req, res) => {
  const { mobileNo, updates } = req.body;

  if (!mobileNo || !updates) {
    return res.status(400).json({ 
      error: 'mobileNo and updates are required in the request body.',
      message: 'Please provide mobile number and update fields.' 
    });
  }

  try {
    // Normalize mobile number before searching
    const normalizedMobileNo = normalizeMobileNumber(mobileNo);
    if (!normalizedMobileNo) {
      return res.status(400).json({
        error: 'Invalid mobile number.',
        message: 'Please provide a valid mobile number.',
      });
    }

    // STRICT NO-DUPLICATE: Find existing record - if not found, return 404 (never create)
    const student = await findStudentByMobile(normalizedMobileNo);
    if (!student) {
      console.log(`⚠️  Update attempted for non-existent mobile: "${normalizedMobileNo}". Student not found. Returning 404 - NOT creating new record.`);
      return res.status(404).json({ 
        message: 'Student not found.',
        found: false 
      });
    }

    // CRITICAL: We found the record - we will UPDATE the same row, NEVER append
    console.log(`🔄 UPDATING existing student record at row ${student.rowNumber} for mobile: ${normalizedMobileNo} (NOT appending - ensuring no duplicate)`);

    const normalizedUpdates = { ...updates };

    if (typeof normalizedUpdates.Paid !== 'undefined') {
      normalizedUpdates.Paid = normalizeYesNo(normalizedUpdates.Paid);
    }
    if (typeof normalizedUpdates.Attempted !== 'undefined') {
      normalizedUpdates.Attempted = normalizeYesNo(normalizedUpdates.Attempted);
    }
    if (typeof normalizedUpdates.RetakeAllowed !== 'undefined') {
      normalizedUpdates.RetakeAllowed = normalizeYesNo(normalizedUpdates.RetakeAllowed);
    }

    const isRetakeRequest =
      typeof normalizedUpdates.RetakeAllowed !== 'undefined' && normalizedUpdates.RetakeAllowed === 'Yes';
    const isAttemptApproval =
      typeof normalizedUpdates.Attempted !== 'undefined' &&
      normalizedUpdates.Attempted === 'Yes' &&
      normalizeYesNo(student.Attempted) !== 'Yes';

    if (isRetakeRequest) {
      const lastApprovedAtDate = parseIsoDate(student.LastApprovedAt);
      if (lastApprovedAtDate) {
        const timeSinceLastApproval = Date.now() - lastApprovedAtDate.getTime();
        if (timeSinceLastApproval < TWELVE_HOURS_MS) {
          const remainingMs = TWELVE_HOURS_MS - timeSinceLastApproval;
          const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
          return res.status(409).json({
            success: false,
            message: 'Retake not allowed within 12 hours of last approval.',
            remainingHours,
          });
        }
      }
    }

    // CRITICAL: Explicitly remove CreatedAt from updates - it must NEVER be modified for existing users
    // CreatedAt can only be set when creating new users, never during updates
    const { CreatedAt: _, ...updatesWithoutCreatedAt } = normalizedUpdates;
    if (normalizedUpdates.CreatedAt) {
      console.log(`⚠️  IGNORED: CreatedAt field in update request for mobile ${normalizedMobileNo}. CreatedAt can only be set on user creation, not updates.`);
    }

    // Build updated student object, ensuring CreatedAt is NEVER overwritten
    // CRITICAL: Preserve ALL existing values including columns J, K, and FeeAmount
    const updatedStudent = { 
      ...student, // This preserves _columnJ, _columnK, CreatedAt, FeeAmount, and all other fields
      ...updatesWithoutCreatedAt, // Apply updates WITHOUT CreatedAt (FeeAmount can be updated if provided)
      MobileNo: normalizedMobileNo, // Ensure mobile number is normalized
    };

    // CRITICAL: Ensure columns J and K are preserved (they might not be in normalizedUpdates)
    if (!updatedStudent._columnJ) {
      updatedStudent._columnJ = student._columnJ ?? '';
    }
    if (!updatedStudent._columnK) {
      updatedStudent._columnK = student._columnK ?? '';
    }

    // CRITICAL: Preserve FeeAmount if not explicitly updated
    if (typeof updatedStudent.FeeAmount === 'undefined' || updatedStudent.FeeAmount === null) {
      updatedStudent.FeeAmount = student.FeeAmount ?? '';
    }

    // Update LastApprovedAt when student is approved or retakes (in IST)
    if (isRetakeRequest || isAttemptApproval) {
      updatedStudent.LastApprovedAt = getCurrentISTTimestamp();
    } else if (typeof updatedStudent.LastApprovedAt === 'undefined') {
      updatedStudent.LastApprovedAt = student.LastApprovedAt ?? '';
    }

    // CRITICAL: CreatedAt must NEVER be overwritten - always preserve the original value exactly as-is
    // Existing users NEVER get a new CreatedAt, even if it's blank, null, or missing
    updatedStudent.CreatedAt = student.CreatedAt ?? '';
    // Explicit guard: Ensure CreatedAt is never modified
    if (updatedStudent.CreatedAt !== (student.CreatedAt ?? '')) {
      console.error(`🚨 CRITICAL: CreatedAt was modified for existing user ${normalizedMobileNo}. Restoring original value.`);
      updatedStudent.CreatedAt = student.CreatedAt ?? '';
    }

    const sheets = await getSheetsClient();

    // CRITICAL: Using spreadsheets.values.update() - this UPDATES the existing row
    // We are NOT using append() - this ensures no duplicate is created
    // Use explicit A{row}:L{row} range to update ONLY this specific row
    const sheetRow = student.rowNumber;
    const updateRange = buildUpdateRange(sheetRow);
    const updateValues = buildRowFromStudent(updatedStudent);
    
    // CRITICAL VALIDATION: Must have exactly 12 values (matching 12 columns A through L)
    if (updateValues.length !== 12) {
      console.error(`❌ CRITICAL ERROR: Update values have ${updateValues.length} columns, expected 12`);
      throw new Error(`Update values must have exactly 12 columns (got ${updateValues.length})`);
    }
    
    // DEBUG LOGGING: Confirm update details
    console.log(`📝 Updating sheet row: ${sheetRow}`);
    console.log(`📝 Update range: ${updateRange}`);
    console.log(`📝 Data being written (12 columns):`, updateValues);
    console.log(`📝 MobileNo: ${normalizedMobileNo}, CreatedAt preserved: ${updatedStudent.CreatedAt}`);
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: updateRange,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [updateValues], // Exactly 1 row with 11 columns
      },
    });

    console.log(`✅ Successfully UPDATED existing student record at row ${student.rowNumber} for mobile: ${normalizedMobileNo} (CreatedAt preserved: ${updatedStudent.CreatedAt}, no duplicate created)`);
    return res.json({ student: updatedStudent });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error('❌ Error updating student:', {
      message: errorMessage,
      code: error.code,
      mobileNo: mobileNo?.trim(),
      stack: error.stack
    });
    
    if (error.code === 403) {
      return res.status(403).json({ 
        error: 'Permission denied',
        message: 'Could not update Google Sheets. Please ensure the sheet is shared with the service account email.',
        details: errorMessage
      });
    }
    if (error.code === 404) {
      return res.status(404).json({ 
        error: 'Sheet not found',
        message: 'The Google Sheet could not be found. Please check the Sheet ID.',
        details: errorMessage
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to update student',
      message: 'Could not connect to Google Sheets. Please check your connection and credentials.',
      details: errorMessage
    });
  }
});

// Test Google Sheets connection on startup
async function testConnection() {
  try {
    console.log('🔍 Testing Google Sheets connection...');
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });
    console.log('✅ Successfully connected to Google Sheets!');
    
    // Try to read a small range to verify access
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!A1:L1`, // Just the header row (A through L)
      });
      console.log('✅ Successfully verified sheet access and range!');
    } catch (rangeError) {
      console.warn('⚠️  Warning: Could not read sheet range. Check the sheet name and range:', SHEET_RANGE);
      console.warn('   Error:', getErrorMessage(rangeError));
    }
  } catch (error) {
    console.error('❌ Failed to connect to Google Sheets on startup:');
    console.error('   Error:', getErrorMessage(error));
    console.error('   Code:', error.code);
    console.error('\n📋 Troubleshooting steps:');
    console.error('   1. Ensure examCredits.json is in Render Secret Files (/etc/secrets/examCredits.json)');
    console.error('   2. Verify the Google Sheet ID is correct:', SHEET_ID);
    console.error('   3. Share the Google Sheet with the service account email (check console above)');
    console.error('   4. Ensure the service account has Editor access');
    console.error('   5. Check Render logs for credential file path information');
    console.error('\n⚠️  Server will start, but API calls may fail until connection is fixed.\n');
  }
}

const server = app.listen(port, '0.0.0.0', async () => {
  console.log(`\n🚀 Exam Verification API running on:`);
  console.log(`   Local:   http://localhost:${port}`);
  console.log(`   Network: http://10.10.10.52:${port}\n`);
  await testConnection();
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${port} is already in use.`);
    console.error('   Please stop the existing server or use a different port.');
    console.error('   You can set a different port with: PORT=4001 npm run dev\n');
    process.exit(1);
  } else {
    console.error(`\n❌ Server error: ${error.message}\n`);
    process.exit(1);
  }
});


