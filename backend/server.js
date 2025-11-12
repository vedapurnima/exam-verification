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

app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  SHEET_ID = '1w6K6K4zMiSkMGlXswOdka3GuqzcpZzh0YBai8zl26kE',
  SHEET_RANGE = 'student_exam_data!A2:G',
  GOOGLE_APPLICATION_CREDENTIALS,
} = process.env;

const [sheetNamePart = 'student_exam_data', columnRangePart = 'A2:G'] = SHEET_RANGE.split('!');
const [startColumnRaw = 'A2', endColumnRaw = 'G'] = columnRangePart.split(':');
const startColumnLetter = startColumnRaw.replace(/\d+/g, '') || 'A';
const endColumnLetter = endColumnRaw.replace(/\d+/g, '') || 'G';
const sheetName = sheetNamePart;

const credentialsPath = GOOGLE_APPLICATION_CREDENTIALS
  ? path.resolve(GOOGLE_APPLICATION_CREDENTIALS)
  : path.join(__dirname, 'credentials.json');

let initializationError = null;
let serviceAccountEmail = '';

if (!fs.existsSync(credentialsPath)) {
  initializationError = new Error(
    `Google service account credentials not found at ${credentialsPath}. ` +
      'Ensure the credentials.json file exists or set GOOGLE_APPLICATION_CREDENTIALS.'
  );
  console.error(`❌ ${initializationError.message}`);
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

const HEADERS = [
  'Name',
  'MobileNo',
  'District',
  'State',
  'Paid',
  'Attempted',
  'RetakeAllowed',
];

const googleAuth = !initializationError
  ? new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
  : null;

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
  const data = HEADERS.reduce((acc, header, index) => {
    acc[header] = row[index] ?? '';
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

function buildRowFromStudent(student) {
  return HEADERS.map((header) => student[header] ?? '');
}

async function findStudentByMobile(mobileNo) {
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
    });

    const rows = response.data.values ?? [];
    const index = rows.findIndex((row) => (row[1] ?? '').trim() === mobileNo.trim());

    if (index === -1) {
      return null;
    }

    const rowNumber = index + 2; // Account for header row
    return mapRowToStudent(rows[index], rowNumber);
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
      stack: error.stack
    });
    
    // Return specific error messages based on error type
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
      error: 'Failed to fetch student data',
      message: 'Could not connect to Google Sheets. Please check your connection and credentials.',
      details: errorMessage
    });
  }
});

app.post('/student', async (req, res) => {
  const { Name, MobileNo, District, State, Paid } = req.body;

  if (!Name || !MobileNo || !District || !State || typeof Paid === 'undefined') {
    return res.status(400).json({ 
      error: 'Name, MobileNo, District, State, and Paid are required.',
      message: 'Please fill in all required fields.' 
    });
  }

  try {
    const sheets = await getSheetsClient();

    const newStudent = {
      Name: Name.trim(),
      MobileNo: MobileNo.trim(),
      District: District.trim(),
      State: State.trim(),
      Paid: normalizeYesNo(Paid),
      Attempted: 'No',
      RetakeAllowed: 'No',
    };

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [buildRowFromStudent(newStudent)],
      },
    });

    return res.status(201).json({ student: newStudent });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error('❌ Error adding student:', {
      message: errorMessage,
      code: error.code,
      stack: error.stack
    });
    
    if (error.code === 403) {
      return res.status(403).json({ 
        error: 'Permission denied',
        message: 'Could not write to Google Sheets. Please ensure the sheet is shared with the service account email.',
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
      error: 'Failed to add student',
      message: 'Could not connect to Google Sheets. Please check your connection and credentials.',
      details: errorMessage
    });
  }
});

app.post('/student/update', async (req, res) => {
  const { mobileNo, updates } = req.body;

  if (!mobileNo || !updates) {
    return res.status(400).json({ 
      error: 'mobileNo and updates are required in the request body.',
      message: 'Please provide mobile number and update fields.' 
    });
  }

  try {
    const student = await findStudentByMobile(mobileNo);
    if (!student) {
      return res.status(404).json({ 
        message: 'Student not found.',
        found: false 
      });
    }

    const updatedStudent = { ...student, ...updates };

    if (typeof updatedStudent.Paid !== 'undefined') {
      updatedStudent.Paid = normalizeYesNo(updatedStudent.Paid);
    }
    if (typeof updatedStudent.Attempted !== 'undefined') {
      updatedStudent.Attempted = normalizeYesNo(updatedStudent.Attempted);
    }
    if (typeof updatedStudent.RetakeAllowed !== 'undefined') {
      updatedStudent.RetakeAllowed = normalizeYesNo(updatedStudent.RetakeAllowed);
    }

    const sheets = await getSheetsClient();

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!${startColumnLetter}${student.rowNumber}:${endColumnLetter}${student.rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [buildRowFromStudent(updatedStudent)],
      },
    });

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
        range: `${sheetName}!A1:G1`, // Just the header row
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
    console.error('   1. Ensure credentials.json is in the backend folder');
    console.error('   2. Verify the Google Sheet ID is correct:', SHEET_ID);
    console.error('   3. Share the Google Sheet with the service account email (check console above)');
    console.error('   4. Ensure the service account has Editor access');
    console.error('\n⚠️  Server will start, but API calls may fail until connection is fixed.\n');
  }
}

const server = app.listen(port, async () => {
  console.log(`\n🚀 Exam Verification API running on http://localhost:${port}\n`);
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


