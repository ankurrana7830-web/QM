// Web App load karne ke liye
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Redcliffe Quote Master')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Google Sheet se credentials verify karne ka function
function verifyLoginUser(email, password) {
  // Active sheet se 'Users' tab ko access karna
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  
  if (!sheet) {
    return { success: false, message: "Database 'Users' tab not found!" };
  }

  const data = sheet.getDataRange().getValues();
  
  // Loop chalayenge Row 2 se (index 1) kyunki Row 1 mein headers hain
  for (let i = 1; i < data.length; i++) {
    let dbEmail = data[i][0]; // Column A
    let dbPass = data[i][1];  // Column B
    let dbRole = data[i][2];  // Column C
    let dbName = data[i][3];  // Column D

    // Trim and ignore case for robust matching
    if (dbEmail && dbPass && 
        email.toString().trim().toLowerCase() === dbEmail.toString().trim().toLowerCase() && 
        password.toString().trim() === dbPass.toString().trim()) {
      return { 
        success: true, 
        role: dbRole, 
        name: dbName, 
        message: "Authentication Successful" 
      };
    }
  }
  
  // Agar loop khatam ho jaye aur match na mile
  return { success: false, message: "Invalid Access Code or Email!" };
}

// Function to fetch raw data for frontend KPI/Chart calculations
function getDashboardRawData() {
  const sheetName = "Quote Master 2026";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  
  if (!sheet) {
    return { error: "Database Offline: " + sheetName + " tab missing." };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  let rawRecords = [];

  function findCol(name) {
    for (let c = 0; c < headers.length; c++) {
      if (headers[c] && headers[c].toString().trim().toLowerCase() === name.toLowerCase()) {
        return c;
      }
    }
    return -1;
  }
  const colType = findCol("Type");
  const colRevenue = findCol("Revenue"); // Dynamic lookup for the new Revenue column

  for (let i = 1; i < data.length; i++) {
    let quoteCode = data[i][0];
    if (quoteCode) {
      
      let rawDate = data[i][2];
      let monthYear = "Unknown";
      if (rawDate instanceof Date) {
        monthYear = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "MMM yyyy");
      } else if (rawDate !== "") {
        monthYear = rawDate.toString().trim();
      }

      // Parse revenue ensuring it's a number
      let rawRev = colRevenue >= 0 ? data[i][colRevenue] : 0;
      let parsedRev = parseFloat(rawRev);
      let revenueVal = isNaN(parsedRev) ? 0 : parsedRev;

      rawRecords.push({
        quoteCode: quoteCode,
        monthYear: monthYear,
        clientName: data[i][5] ? data[i][5].toString().trim() : "",
        type: (colType >= 0 && data[i][colType]) ? data[i][colType].toString().trim() : "Unknown",
        amName: data[i][15] ? data[i][15].toString().trim() : "Unassigned",
        quoteStatus: data[i][16] ? data[i][16].toString().trim() : "Pending",
        dealStatus: data[i][19] ? data[i][19].toString().trim().toLowerCase() : "",
        revenue: revenueVal
      });
    }
  }
  return { success: true, records: rawRecords };
}

// ============== PHASE 3: QUOTEMASTER FORM FUNCTIONS ==============

// Function to get dropdown data from "Source Data" + "Quote Master 2026" sheets
function getFormDropdownData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // ===== 1. Read "Source Data" sheet for contacts & AM =====
  const sourceSheet = ss.getSheetByName("Source Data");
  let sourceContacts = [];
  let uniqueClients = new Set();
  let uniqueAMs = new Set();

  if (sourceSheet) {
    const srcData = sourceSheet.getDataRange().getValues();
    const srcHeaders = srcData[0];
    
    // Dynamic column detection for Source Data
    function findSrcCol(name) {
      for (let c = 0; c < srcHeaders.length; c++) {
        if (srcHeaders[c] && srcHeaders[c].toString().trim().toLowerCase() === name.toLowerCase()) {
          return c;
        }
      }
      return -1;
    }

    const cClient = findSrcCol("Company/Client Name");
    const cContact = findSrcCol("Company Contact Person");
    const cPhone = findSrcCol("CompanyContactNumber");
    const cAM = findSrcCol("Account manager name");
    const cEmail = findSrcCol("Email ID");
    const cCC = findSrcCol("CC Email ID");

    for (let i = 1; i < srcData.length; i++) {
      let clientName = cClient >= 0 && srcData[i][cClient] ? srcData[i][cClient].toString().trim() : "";
      let contactPerson = cContact >= 0 && srcData[i][cContact] ? srcData[i][cContact].toString().trim() : "";
      let phone = cPhone >= 0 && srcData[i][cPhone] ? srcData[i][cPhone].toString().trim() : "";
      let am = cAM >= 0 && srcData[i][cAM] ? srcData[i][cAM].toString().trim() : "";
      let email = cEmail >= 0 && srcData[i][cEmail] ? srcData[i][cEmail].toString().trim() : "";
      let ccEmail = cCC >= 0 && srcData[i][cCC] ? srcData[i][cCC].toString().trim() : "";

      if (clientName) {
        uniqueClients.add(clientName);
        if (am) uniqueAMs.add(am);

        sourceContacts.push({
          clientName: clientName,
          contactPerson: contactPerson,
          phone: phone,
          am: am,
          email: email,
          ccEmail: ccEmail
        });
      }
    }
  }

  // ===== 2. Read "Quote Master 2026" for Type, Requirement, City, QuoteSharedBy =====
  const mainSheet = ss.getSheetByName("Quote Master 2026");
  let types = [], requirements = [], cities = [], quoteSharedBy = [];

  if (mainSheet) {
    const mainData = mainSheet.getDataRange().getValues();
    const mainHeaders = mainData[0];

    function findMainCol(name) {
      for (let c = 0; c < mainHeaders.length; c++) {
        if (mainHeaders[c] && mainHeaders[c].toString().trim().toLowerCase() === name.toLowerCase()) {
          return c;
        }
      }
      return -1;
    }

    // Read Data Validation dropdown list from a column
    function getValidationValues(colIdx) {
      if (colIdx === -1) return [];
      try {
        // Check data validation on row 2 of this column
        let rule = mainSheet.getRange(2, colIdx + 1).getDataValidation();
        if (rule) {
          let criteriaType = rule.getCriteriaType();
          // VALUE_IN_LIST = hardcoded list in validation
          if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
            let values = rule.getCriteriaValues();
            if (values && values.length > 0) {
              return values[0]; // Array of allowed values
            }
          }
          // VALUE_IN_RANGE = validation from a cell range
          if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
            let range = rule.getCriteriaValues()[0];
            if (range) {
              let rangeValues = range.getValues();
              let result = [];
              for (let r = 0; r < rangeValues.length; r++) {
                let val = rangeValues[r][0];
                if (val !== "" && val !== undefined && val !== null) {
                  result.push(val.toString().trim());
                }
              }
              return result;
            }
          }
        }
      } catch(e) {
        // If validation read fails, fall back to unique values
      }
      
      // Fallback: read unique values from existing data
      let uniqueSet = new Set();
      for (let i = 1; i < mainData.length; i++) {
        let val = mainData[i][colIdx];
        if (val !== "" && val !== undefined && val !== null) {
          uniqueSet.add(val.toString().trim());
        }
      }
      return Array.from(uniqueSet).sort();
    }

    types = getValidationValues(findMainCol("Type"));
    requirements = getValidationValues(findMainCol("Requirement"));
    quoteSharedBy = getValidationValues(findMainCol("Quote Shared By"));
    
    // Cities: always from unique values (no validation dropdown)
    let cityCol = findMainCol("Required City");
    if (cityCol >= 0) {
      let citySet = new Set();
      for (let i = 1; i < mainData.length; i++) {
        let val = mainData[i][cityCol];
        if (val !== "" && val !== undefined && val !== null) {
          citySet.add(val.toString().trim());
        }
      }
      cities = Array.from(citySet).sort();
    }
  }

  return {
    sourceContacts: sourceContacts,
    dropdowns: {
      clients: Array.from(uniqueClients).sort(),
      accountManagers: Array.from(uniqueAMs).sort(),
      types: types,
      requirements: requirements,
      cities: cities,
      quoteSharedBy: quoteSharedBy
    }
  };
}

// Function to submit a new lead entry to the Google Sheet
function submitNewLead(formData) {
  const sheetName = "Quote Master 2026";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  
  if (!sheet) {
    return { success: false, message: "Sheet not found: " + sheetName };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Build column index map (case-insensitive)
  let colMap = {};
  for (let c = 0; c < headers.length; c++) {
    if (headers[c]) {
      colMap[headers[c].toString().trim().toLowerCase()] = c;
    }
  }

  // ==========================================
  // SMART SEQUENCE LOGIC (LAST ID + 1)
  // ==========================================
  const date = new Date();
  const lastRow = sheet.getLastRow();
  
  // Read last Quote Code from Column A (Quote code column)
  let lastQuoteCode = "";
  if (lastRow > 1) {
    let quoteCodeCol = colMap["quote code"];
    if (quoteCodeCol !== undefined) {
      lastQuoteCode = sheet.getRange(lastRow, quoteCodeCol + 1).getValue().toString().trim();
    } else {
      // Fallback: read from column A
      lastQuoteCode = sheet.getRange(lastRow, 1).getValue().toString().trim();
    }
  }
  
  let nextNum = 1; // Default starting number
  
  if (lastQuoteCode && lastQuoteCode.length > 5) {
    // Extract number from last code (e.g., "MAY26279" → 279)
    let numPart = lastQuoteCode.substring(5);
    let parsedNum = parseInt(numPart, 10);
    
    if (!isNaN(parsedNum)) {
      nextNum = parsedNum + 1; // 279 + 1 = 280
    } else {
      nextNum = lastRow; // Failsafe backup
    }
  } else {
    nextNum = lastRow; // If ID is blank
  }
  
  // Format number with minimum 3 digits (001, 280, 1005, etc.)
  let numStr = nextNum.toString();
  while (numStr.length < 3) {
    numStr = "0" + numStr;
  }

  // Generate Quote Code: MAY26280 format (MMMyy + sequence)
  const quoteCode = 
    Utilities.formatDate(date, Session.getScriptTimeZone(), "MMM").toUpperCase() +
    date.getFullYear().toString().slice(-2) +
    numStr;

  // Create new row array (same size as header row)
  let newRow = new Array(headers.length).fill("");

  // Helper to set value by column name
  function setCol(name, value) {
    let idx = colMap[name.toLowerCase()];
    if (idx !== undefined && idx >= 0) {
      newRow[idx] = value;
    }
  }

  // Format dates for the sheet
  const formattedDate = Utilities.formatDate(date, Session.getScriptTimeZone(), "M/d/yyyy");
  const monthYearStr = Utilities.formatDate(date, Session.getScriptTimeZone(), "MMMyy");
  // Capitalize first letter: "Jan26" format
  const monthYearFinal = monthYearStr.charAt(0).toUpperCase() + monthYearStr.slice(1).toLowerCase();
  const weekNum = Math.ceil(date.getDate() / 7).toString();

  // Map form data to EXACT sheet column headers
  setCol("Quote code", quoteCode);
  setCol("Quote Requested Date", formattedDate);
  setCol("Month/Year", monthYearFinal);
  setCol("Week", weekNum);
  setCol("Email Subject Line", formData.emailSubject || "");
  setCol("Company/Client Name", formData.clientName || "");
  setCol("Type", formData.type || "");
  setCol("Requirement", formData.requirement || "");
  setCol("Priority", formData.isUrgent ? "High" : "Normal/Regular");
  setCol("Quote shared by", formData.quoteSharedBy || "");
  setCol("Service required address", formData.serviceAddress || "");
  setCol("Required cities", formData.city || "");
  setCol("Company Contact Person", formData.contactPerson || "");
  setCol("Company Contact Number", formData.contactNumber || "");
  setCol("Employees count", formData.employeesCount || "");
  setCol("Account Manager", formData.accountManager || "");
  setCol("Quote Status", "Quote Shared");

  // Append row to sheet
  sheet.appendRow(newRow);

  return { 
    success: true, 
    message: "Lead submitted successfully!", 
    quoteCode: quoteCode 
  };
}

// Function to get last N rows for the Lead Intelligence table
function getLeadTableData() {
  const sheetName = "Quote Master 2026";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  
  if (!sheet) {
    return { error: "Sheet not found" };
  }

  let lastRow = sheet.getLastRow();
  let lastCol = Math.min(35, sheet.getLastColumn());
  const data = lastRow > 0 ? sheet.getRange(1, 1, lastRow, lastCol).getValues() : [];
  if (data.length === 0) return { rows: [], total: 0 };
  const headers = data[0];
  
  // Build column index map
  let colMap = {};
  for (let c = 0; c < headers.length; c++) {
    if (headers[c]) {
      colMap[headers[c].toString().trim().toLowerCase()] = c;
    }
  }

  function getCol(row, name) {
    let idx = colMap[name.toLowerCase()];
    if (idx !== undefined && idx >= 0 && row[idx] !== undefined) {
      let val = row[idx];
      if (val instanceof Date) {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let day = val.getDate();
        let dayStr = day < 10 ? "0" + day : day;
        return dayStr + " " + monthNames[val.getMonth()] + " " + val.getFullYear();
      }
      return val.toString().trim();
    }
    return "";
  }

  // Get last 50 rows (most recent first)
  let rows = [];
  let start = Math.max(1, data.length - 50);
  for (let i = data.length - 1; i >= start; i--) {
    if (data[i][0] && data[i][0] !== "") {
      rows.push({
        rowNumber: i + 1, // Actual sheet row (1-indexed)
        quoteCode: getCol(data[i], "Quote code"),
        date: getCol(data[i], "Month/Year"),
        subject: getCol(data[i], "Email Subject Line"),
        client: getCol(data[i], "Company/Client Name"),
        contact: getCol(data[i], "Company Contact Person"),
        phone: getCol(data[i], "Company Contact Number"),
        type: getCol(data[i], "Type"),
        requirement: getCol(data[i], "Requirement"),
        am: getCol(data[i], "Account Manager"),
        quoteStatus: getCol(data[i], "Quote Status"),
        quoteRepliedDate: getCol(data[i], "Quote Replied Date"),
        clientResponse: getCol(data[i], "Client Response Status"),
        dealStatus: getCol(data[i], "Deal Status"),
        remarks: getCol(data[i], "Additional Remarks"),
        packageCount: getCol(data[i], "Created Package Count"),
        packageCode: getCol(data[i], "Package Code"),
        packageDate: getCol(data[i], "Package Creation Date"),
        followupBy: getCol(data[i], "Followup By"),
        emailReady: getCol(data[i], "Email Ready"),
        attachmentLink: getCol(data[i], "Attachment Link")
      });
    }
  }

  return { rows: rows, total: data.length - 1 };
}

// ============== PHASE 4: UPDATE DEAL ROW ==============
function updateDealRow(updateData) {
  const sheetName = "Quote Master 2026";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  
  if (!sheet) {
    return { success: false, message: "Sheet not found" };
  }

  const rowNum = updateData.rowNumber;
  if (!rowNum || rowNum < 2) {
    return { success: false, message: "Invalid row number" };
  }

  // Read headers to find column positions
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  function findCol(name) {
    for (let c = 0; c < headers.length; c++) {
      if (headers[c] && headers[c].toString().trim().toLowerCase() === name.toLowerCase()) {
        return c + 1; // 1-indexed for setRange
      }
    }
    return -1;
  }

  // Map of field name -> column header
  const fieldMap = {
    quoteStatus: "Quote Status",
    quoteRepliedDate: "Quote Replied Date",
    clientResponse: "Client Response Status",
    dealStatus: "Deal Status",
    remarks: "Additional Remarks",
    packageCount: "Created Package Count",
    packageCode: "Package Code",
    packageDate: "Package Creation Date",
    followupBy: "Followup By",
    emailReady: "Email Ready",
    attachmentLink: "Attachment Link"
  };

  // Update only provided fields
  for (let key in fieldMap) {
    if (updateData[key] !== undefined && updateData[key] !== null) {
      let colNum = findCol(fieldMap[key]);
      if (colNum > 0) {
        sheet.getRange(rowNum, colNum).setValue(updateData[key]);
      }
    }
  }

  return { success: true, message: "Deal updated successfully!" };
}

// Get Data Validation values for Deal Status and Client Response dropdowns
function getDealDropdowns() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Quote Master 2026");
  if (!sheet) return { dealStatuses: [], clientResponses: [] };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  function findCol(name) {
    for (let c = 0; c < headers.length; c++) {
      if (headers[c] && headers[c].toString().trim().toLowerCase() === name.toLowerCase()) {
        return c + 1;
      }
    }
    return -1;
  }

  function getValidation(colNum) {
    if (colNum <= 0) return [];
    try {
      let rule = sheet.getRange(2, colNum).getDataValidation();
      if (rule) {
        let type = rule.getCriteriaType();
        if (type === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
          let vals = rule.getCriteriaValues();
          return (vals && vals.length > 0) ? vals[0] : [];
        }
        if (type === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
          let range = rule.getCriteriaValues()[0];
          if (range) {
            let rSheet = range.getSheet();
            let numRows = range.getNumRows();
            if (numRows > 100) {
              let lastRowInSheet = rSheet.getLastRow();
              let startRow = range.getRow();
              let actualRows = Math.min(numRows, Math.max(1, lastRowInSheet - startRow + 1));
              let col = range.getColumn();
              let numCols = range.getNumColumns();
              return rSheet.getRange(startRow, col, actualRows, numCols).getValues().flat().filter(v => v !== "").map(v => v.toString().trim());
            } else {
              return range.getValues().flat().filter(v => v !== "").map(v => v.toString().trim());
            }
          }
        }
      }
    } catch(e) {}
    return [];
  }

  return {
    dealStatuses: getValidation(findCol("Deal Status")),
    clientResponses: getValidation(findCol("Client Response Status")),
    quoteStatuses: getValidation(findCol("Quote Status"))
  };
}

function getRevenueData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = "Revenue Data";
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return { error: "Database Offline: " + sheetName + " tab missing." };
  }

  // Build client→AM mapping from Source Data
  let clientToAM = {};
  const srcSheet = ss.getSheetByName("Source Data");
  if (srcSheet) {
    const srcData = srcSheet.getDataRange().getValues();
    const srcHeaders = srcData[0];
    let cClient = -1, cAM = -1;
    for (let c = 0; c < srcHeaders.length; c++) {
      let h = srcHeaders[c] ? srcHeaders[c].toString().trim().toLowerCase() : '';
      if (h === 'company/client name') cClient = c;
      if (h === 'account manager name') cAM = c;
    }
    if (cClient >= 0 && cAM >= 0) {
      for (let i = 1; i < srcData.length; i++) {
        let client = srcData[i][cClient] ? srcData[i][cClient].toString().trim().toLowerCase() : '';
        let am = srcData[i][cAM] ? srcData[i][cAM].toString().trim() : '';
        if (client && am) {
          clientToAM[client] = am;
        }
      }
    }
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, records: [] };

  const headers = data[0];
  let rawRecords = [];

  function findCol(name) {
    for (let c = 0; c < headers.length; c++) {
      if (headers[c] && headers[c].toString().trim().toLowerCase() === name.toLowerCase()) {
        return c;
      }
    }
    return -1;
  }
  
  const colPackage = findCol("package");
  const colPackageCode = findCol("package_code");
  const colCreated = findCol("package_created");
  const colCenter = findCol("center_name");
  const colSalesManager = findCol("sales_manager_text");
  const colMonth = findCol("month_date");
  const colSource = findCol("sourcetype");
  const colRev = findCol("prevenue");

  for (let i = 1; i < data.length; i++) {
    let rawRev = colRev >= 0 ? data[i][colRev] : 0;
    let parsedRev = parseFloat(rawRev);
    let revVal = isNaN(parsedRev) ? 0 : parsedRev;
    
    let centerName = colCenter >= 0 ? data[i][colCenter].toString().trim() : "Unknown";
    
    // Lookup AM from sales_manager_text first, fallback to clientToAM
    let amName = colSalesManager >= 0 ? data[i][colSalesManager].toString().trim() : "";
    if (!amName || amName === "Unknown" || amName === "-" || amName === "") {
      amName = clientToAM[centerName.toLowerCase()] || "Unassigned";
    }

    rawRecords.push({
      package: colPackage >= 0 ? data[i][colPackage].toString().trim() : "",
      package_code: colPackageCode >= 0 ? data[i][colPackageCode].toString().trim() : "",
      package_created: colCreated >= 0 ? data[i][colCreated].toString().trim() : "",
      center_name: centerName,
      month_date: colMonth >= 0 ? data[i][colMonth].toString().trim() : "Unknown",
      sourcetype: colSource >= 0 ? data[i][colSource].toString().trim() : "Unknown",
      prevenue: revVal,
      amName: amName
    });
  }
  return { success: true, records: rawRecords };
}

// ============== PHASE 11: OTP FORGOT PASSWORD ==============
function sendOTP(email) {
  if (!email || typeof email !== 'string') {
    return { success: false, message: "Please enter a valid email address." };
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  if (!sheet) return { success: false, message: "Users database not found!" };
  
  const data = sheet.getDataRange().getValues();
  let foundRow = -1;
  let userName = '';
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().trim().toLowerCase() === email.trim().toLowerCase()) {
      foundRow = i;
      userName = data[i][3] ? data[i][3].toString().trim() : 'User';
      break;
    }
  }
  
  if (foundRow === -1) {
    return { success: false, message: "Email not registered in the system." };
  }
  
  // Generate 6-digit OTP
  let otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store OTP in Script Properties with timestamp
  let props = PropertiesService.getScriptProperties();
  props.setProperty('otp_' + email.trim().toLowerCase(), JSON.stringify({
    otp: otp,
    timestamp: new Date().getTime(),
    name: userName
  }));
  
  // Send OTP via email
  try {
    MailApp.sendEmail({
      to: email.trim(),
      subject: "Redcliffe Quote Master - Your OTP Code",
      htmlBody: '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:30px;background:#0f172a;border-radius:16px;border:1px solid #1e293b;">' +
        '<div style="text-align:center;margin-bottom:24px;">' +
        '<h1 style="color:#38bdf8;font-size:24px;margin:0;">REDCLIFFE</h1>' +
        '<p style="color:#64748b;font-size:12px;letter-spacing:3px;margin:4px 0 0;">QUOTE MASTER</p>' +
        '</div>' +
        '<p style="color:#cbd5e1;font-size:14px;">Hello <strong style="color:#fff;">' + userName + '</strong>,</p>' +
        '<p style="color:#94a3b8;font-size:13px;">Your one-time password (OTP) for password reset is:</p>' +
        '<div style="text-align:center;margin:24px 0;">' +
        '<div style="display:inline-block;background:#1e293b;border:2px solid #38bdf8;border-radius:12px;padding:16px 40px;">' +
        '<span style="font-size:36px;font-weight:900;color:#38bdf8;letter-spacing:12px;font-family:monospace;">' + otp + '</span>' +
        '</div>' +
        '</div>' +
        '<p style="color:#f87171;font-size:12px;text-align:center;">⏰ This OTP expires in 10 minutes</p>' +
        '<hr style="border:none;border-top:1px solid #1e293b;margin:20px 0;">' +
        '<p style="color:#475569;font-size:11px;text-align:center;">If you did not request this, please ignore this email.</p>' +
        '</div>'
    });
  } catch(e) {
    let errStr = e.toString();
    if (errStr.includes("permission") || errStr.includes("MailApp")) {
      return { success: false, message: "Email permission missing. Click 'Run' on any function in Apps Script to authorize permissions." };
    }
    return { success: false, message: "Failed to send email. Check network or parameters." };
  }
  
  return { success: true, message: "OTP sent to " + email };
}

function verifyOTPAndResetPassword(email, otp, newPassword) {
  if (!email || !otp || !newPassword) {
    return { success: false, message: "Required parameters are missing." };
  }
  let props = PropertiesService.getScriptProperties();
  let stored = props.getProperty('otp_' + email.trim().toLowerCase());
  
  if (!stored) {
    return { success: false, message: "No OTP found. Please request a new one." };
  }
  
  let otpData = JSON.parse(stored);
  let now = new Date().getTime();
  let elapsed = now - otpData.timestamp;
  
  // 10-minute expiry (600000 ms)
  if (elapsed > 600000) {
    props.deleteProperty('otp_' + email.trim().toLowerCase());
    return { success: false, message: "OTP expired. Please request a new one." };
  }
  
  if (otpData.otp !== otp.toString().trim()) {
    return { success: false, message: "Invalid OTP. Please try again." };
  }
  
  // OTP verified — update password in Users sheet
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  if (!sheet) return { success: false, message: "Users database not found!" };
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().trim().toLowerCase() === email.trim().toLowerCase()) {
      // Column B = password (index 1), sheet is 1-indexed so col=2, row=i+1
      sheet.getRange(i + 1, 2).setValue(newPassword);
      
      // Clear used OTP
      props.deleteProperty('otp_' + email.trim().toLowerCase());
      
      return { 
        success: true, 
        message: "Password updated successfully! Please login with your new password."
      };
    }
  }
  
  return { success: false, message: "Email not found in database." };
}

// Combined fetch for fast loading and reduced API calls (PHASE 12)
function getCombinedDashboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Read Quote Master 2026 sheet
  const qmSheet = ss.getSheetByName("Quote Master 2026");
  if (!qmSheet) {
    return { success: false, error: "Quote Master 2026 tab missing." };
  }
  
  let qmLastRow = qmSheet.getLastRow();
  let qmLastCol = Math.min(35, qmSheet.getLastColumn());
  const qmValues = qmLastRow > 0 ? qmSheet.getRange(1, 1, qmLastRow, qmLastCol).getValues() : [];
  if (qmValues.length === 0) return { success: true, quoteMasterRecords: [], revenueRecords: [], dropdownData: {}, leadTableData: { rows: [], total: 0 } };
  
  // 2. Read Revenue Data sheet
  const revSheet = ss.getSheetByName("Revenue Data");
  let revValues = [];
  if (revSheet) {
    let revLastRow = revSheet.getLastRow();
    let revLastCol = Math.min(15, revSheet.getLastColumn());
    revValues = revLastRow > 0 ? revSheet.getRange(1, 1, revLastRow, revLastCol).getValues() : [];
  }
  
  // 3. Read Source Data sheet
  const srcSheet = ss.getSheetByName("Source Data");
  let srcValues = [];
  if (srcSheet) {
    let srcLastRow = srcSheet.getLastRow();
    let srcLastCol = Math.min(15, srcSheet.getLastColumn());
    srcValues = srcLastRow > 0 ? srcSheet.getRange(1, 1, srcLastRow, srcLastCol).getValues() : [];
  }

  // --- PROCESS QUOTE MASTER DATA FOR DASHBOARD RAW RECORDS ---
  const qmHeaders = qmValues[0];
  function findQmCol(name) {
    for (let c = 0; c < qmHeaders.length; c++) {
      if (qmHeaders[c] && qmHeaders[c].toString().trim().toLowerCase() === name.toLowerCase()) {
        return c;
      }
    }
    return -1;
  }
  const qmColType = findQmCol("Type");
  const qmColRevenue = findQmCol("Revenue");
  const qmColClient = findQmCol("Company/Client Name");
  const qmColAM = findQmCol("Account Manager");
  const qmColStatus = findQmCol("Quote Status");
  const qmColDealStatus = findQmCol("Deal Status");
  const qmColPackageCount = findQmCol("Created Package Count");
  const qmColPackageCode = findQmCol("Package Code");
  const qmColDate = findQmCol("Month/Year");
  const qmColEmployees = findQmCol("Employees count");

  let quoteMasterRecords = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  for (let i = 1; i < qmValues.length; i++) {
    let quoteCode = qmValues[i][0];
    if (quoteCode) {
      let rawDate = qmColDate >= 0 ? qmValues[i][qmColDate] : "";
      let monthYear = "Unknown";
      if (rawDate instanceof Date) {
        monthYear = monthNames[rawDate.getMonth()] + " " + rawDate.getFullYear();
      } else if (rawDate !== "") {
        monthYear = rawDate.toString().trim();
      }

      let rawRev = qmColRevenue >= 0 ? qmValues[i][qmColRevenue] : 0;
      let parsedRev = parseFloat(rawRev);
      let revenueVal = isNaN(parsedRev) ? 0 : parsedRev;

      let rawPkgCount = qmColPackageCount >= 0 ? qmValues[i][qmColPackageCount] : 0;
      let parsedPkgCount = parseFloat(rawPkgCount);
      let packageCountVal = isNaN(parsedPkgCount) ? 0 : parsedPkgCount;

      quoteMasterRecords.push({
        quoteCode: quoteCode,
        monthYear: monthYear,
        clientName: qmColClient >= 0 ? qmValues[i][qmColClient].toString().trim() : "",
        type: (qmColType >= 0 && qmValues[i][qmColType]) ? qmValues[i][qmColType].toString().trim() : "Unknown",
        amName: qmColAM >= 0 ? qmValues[i][qmColAM].toString().trim() : "Unassigned",
        quoteStatus: qmColStatus >= 0 ? qmValues[i][qmColStatus].toString().trim() : "Pending",
        dealStatus: qmColDealStatus >= 0 ? qmValues[i][qmColDealStatus].toString().trim().toLowerCase() : "",
        revenue: revenueVal,
        packageCount: packageCountVal,
        packageCode: qmColPackageCode >= 0 ? qmValues[i][qmColPackageCode].toString().trim() : "",
        employeesCount: qmColEmployees >= 0 ? qmValues[i][qmColEmployees].toString().trim() : ""
      });
    }
  }

  // --- PROCESS REVENUE RECORDS ---
  let revenueRecords = [];
  let clientToAM = {};
  
  if (srcValues.length > 0) {
    const srcHeaders = srcValues[0];
    let srcCClient = -1, srcCAM = -1;
    for (let c = 0; c < srcHeaders.length; c++) {
      let h = srcHeaders[c] ? srcHeaders[c].toString().trim().toLowerCase() : '';
      if (h === 'company/client name') srcCClient = c;
      if (h === 'account manager name') srcCAM = c;
    }
    if (srcCClient >= 0 && srcCAM >= 0) {
      for (let i = 1; i < srcValues.length; i++) {
        let client = srcValues[i][srcCClient] ? srcValues[i][srcCClient].toString().trim().toLowerCase() : '';
        let am = srcValues[i][srcCAM] ? srcValues[i][srcCAM].toString().trim() : '';
        if (client && am) {
          clientToAM[client] = am;
        }
      }
    }
  }

  if (revValues.length > 1) {
    const revHeaders = revValues[0];
    function findRevCol(name) {
      for (let c = 0; c < revHeaders.length; c++) {
        if (revHeaders[c] && revHeaders[c].toString().trim().toLowerCase() === name.toLowerCase()) {
          return c;
        }
      }
      return -1;
    }
    const colPackage = findRevCol("package");
    const colPackageCode = findRevCol("package_code");
    const colCreated = findRevCol("package_created");
    const colCenter = findRevCol("center_name");
    const colSalesManager = findRevCol("sales_manager_text");
    const colMonth = findRevCol("month_date");
    const colSource = findRevCol("sourcetype");
    const colRev = findRevCol("prevenue");

    for (let i = 1; i < revValues.length; i++) {
      let rawRev = colRev >= 0 ? revValues[i][colRev] : 0;
      let parsedRev = parseFloat(rawRev);
      let revVal = isNaN(parsedRev) ? 0 : parsedRev;
      
      let centerName = colCenter >= 0 ? revValues[i][colCenter].toString().trim() : "Unknown";
      
      // sales_manager_text directly mapping, fallback to clientToAM
      let amName = colSalesManager >= 0 ? revValues[i][colSalesManager].toString().trim() : "";
      if (!amName || amName === "Unknown" || amName === "-" || amName === "") {
        amName = clientToAM[centerName.toLowerCase()] || "Unassigned";
      }

      revenueRecords.push({
        package: colPackage >= 0 ? revValues[i][colPackage].toString().trim() : "",
        package_code: colPackageCode >= 0 ? revValues[i][colPackageCode].toString().trim() : "",
        package_created: colCreated >= 0 ? revValues[i][colCreated].toString().trim() : "",
        center_name: centerName,
        month_date: colMonth >= 0 ? revValues[i][colMonth].toString().trim() : "Unknown",
        sourcetype: colSource >= 0 ? revValues[i][colSource].toString().trim() : "Unknown",
        prevenue: revVal,
        amName: amName
      });
    }
  }

  // --- PROCESS DROPDOWNS DATA ---
  let sourceContacts = [];
  let uniqueClients = new Set();
  let uniqueAMs = new Set();

  if (srcValues.length > 1) {
    const srcHeaders = srcValues[0];
    function findSrcCol(name) {
      for (let c = 0; c < srcHeaders.length; c++) {
        if (srcHeaders[c] && srcHeaders[c].toString().trim().toLowerCase() === name.toLowerCase()) {
          return c;
        }
      }
      return -1;
    }
    const cClient = findSrcCol("Company/Client Name");
    const cContact = findSrcCol("Company Contact Person");
    const cPhone = findSrcCol("CompanyContactNumber");
    const cAM = findSrcCol("Account manager name");
    const cEmail = findSrcCol("Email ID");
    const cCC = findSrcCol("CC Email ID");

    for (let i = 1; i < srcValues.length; i++) {
      let clientName = cClient >= 0 && srcValues[i][cClient] ? srcValues[i][cClient].toString().trim() : "";
      let contactPerson = cContact >= 0 && srcValues[i][cContact] ? srcValues[i][cContact].toString().trim() : "";
      let phone = cPhone >= 0 && srcValues[i][cPhone] ? srcValues[i][cPhone].toString().trim() : "";
      let am = cAM >= 0 && srcValues[i][cAM] ? srcValues[i][cAM].toString().trim() : "";
      let email = cEmail >= 0 && srcValues[i][cEmail] ? srcValues[i][cEmail].toString().trim() : "";
      let ccEmail = cCC >= 0 && srcValues[i][cCC] ? srcValues[i][cCC].toString().trim() : "";

      if (clientName) {
        uniqueClients.add(clientName);
        if (am) uniqueAMs.add(am);

        sourceContacts.push({
          clientName: clientName,
          contactPerson: contactPerson,
          phone: phone,
          am: am,
          email: email,
          ccEmail: ccEmail
        });
      }
    }
  }

  // Fetch validations from qmSheet ranges
  let types = [], requirements = [], cities = [], quoteSharedBy = [];
  function getValidationValuesFromSheet(colIdx) {
    if (colIdx === -1) return [];
    try {
      let rule = qmSheet.getRange(2, colIdx + 1).getDataValidation();
      if (rule) {
        let criteriaType = rule.getCriteriaType();
        if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
          let values = rule.getCriteriaValues();
          if (values && values.length > 0) return values[0];
        }
        if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
          let range = rule.getCriteriaValues()[0];
          if (range) {
            let rSheet = range.getSheet();
            let numRows = range.getNumRows();
            if (numRows > 100) {
              let lastRowInSheet = rSheet.getLastRow();
              let startRow = range.getRow();
              let actualRows = Math.min(numRows, Math.max(1, lastRowInSheet - startRow + 1));
              let col = range.getColumn();
              let numCols = range.getNumColumns();
              return rSheet.getRange(startRow, col, actualRows, numCols).getValues().flat().filter(v => v !== "").map(v => v.toString().trim());
            } else {
              return range.getValues().flat().filter(v => v !== "").map(v => v.toString().trim());
            }
          }
        }
      }
    } catch(e) {}
    
    // Fallback: unique values in column
    let uniqueSet = new Set();
    for (let i = 1; i < qmValues.length; i++) {
      let val = qmValues[i][colIdx];
      if (val !== "" && val !== undefined && val !== null) {
        uniqueSet.add(val.toString().trim());
      }
    }
    return Array.from(uniqueSet).sort();
  }

  types = getValidationValuesFromSheet(findQmCol("Type"));
  requirements = getValidationValuesFromSheet(findQmCol("Requirement"));
  quoteSharedBy = getValidationValuesFromSheet(findQmCol("Quote Shared By"));

  let cityCol = findQmCol("Required City");
  if (cityCol >= 0) {
    let citySet = new Set();
    for (let i = 1; i < qmValues.length; i++) {
      let val = qmValues[i][cityCol];
      if (val !== "" && val !== undefined && val !== null) {
        citySet.add(val.toString().trim());
      }
    }
    cities = Array.from(citySet).sort();
  }

  let dropdownData = {
    sourceContacts: sourceContacts,
    dropdowns: {
      clients: Array.from(uniqueClients).sort(),
      accountManagers: Array.from(uniqueAMs).sort(),
      types: types,
      requirements: requirements,
      cities: cities,
      quoteSharedBy: quoteSharedBy
    }
  };

  // --- PROCESS LEAD TABLE DATA (LAST 50 ROWS) ---
  let leadRows = [];
  let qmColMap = {};
  for (let c = 0; c < qmHeaders.length; c++) {
    if (qmHeaders[c]) {
      qmColMap[qmHeaders[c].toString().trim().toLowerCase()] = c;
    }
  }
  function getColFromRow(row, name) {
    let idx = qmColMap[name.toLowerCase()];
    if (idx !== undefined && idx >= 0 && row[idx] !== undefined) {
      let val = row[idx];
      if (val instanceof Date) {
        let day = val.getDate();
        let dayStr = day < 10 ? "0" + day : day;
        return dayStr + " " + monthNames[val.getMonth()] + " " + val.getFullYear();
      }
      return val.toString().trim();
    }
    return "";
  }

  let start = Math.max(1, qmValues.length - 50);
  for (let i = qmValues.length - 1; i >= start; i--) {
    if (qmValues[i][0] && qmValues[i][0] !== "") {
      leadRows.push({
        rowNumber: i + 1,
        quoteCode: getColFromRow(qmValues[i], "Quote code"),
        date: getColFromRow(qmValues[i], "Month/Year"),
        subject: getColFromRow(qmValues[i], "Email Subject Line"),
        client: getColFromRow(qmValues[i], "Company/Client Name"),
        contact: getColFromRow(qmValues[i], "Company Contact Person"),
        phone: getColFromRow(qmValues[i], "Company Contact Number"),
        type: getColFromRow(qmValues[i], "Type"),
        requirement: getColFromRow(qmValues[i], "Requirement"),
        am: getColFromRow(qmValues[i], "Account Manager"),
        quoteStatus: getColFromRow(qmValues[i], "Quote Status"),
        quoteRepliedDate: getColFromRow(qmValues[i], "Quote Replied Date"),
        clientResponse: getColFromRow(qmValues[i], "Client Response Status"),
        dealStatus: getColFromRow(qmValues[i], "Deal Status"),
        remarks: getColFromRow(qmValues[i], "Additional Remarks"),
        packageCount: getColFromRow(qmValues[i], "Created Package Count"),
        packageCode: getColFromRow(qmValues[i], "Package Code"),
        packageDate: getColFromRow(qmValues[i], "Package Creation Date"),
        followupBy: getColFromRow(qmValues[i], "Followup By"),
        emailReady: getColFromRow(qmValues[i], "Email Ready"),
        attachmentLink: getColFromRow(qmValues[i], "Attachment Link")
      });
    }
  }

  let leadTableData = { rows: leadRows, total: qmValues.length - 1 };

  return {
    success: true,
    quoteMasterRecords: quoteMasterRecords,
    revenueRecords: revenueRecords,
    dropdownData: dropdownData,
    leadTableData: leadTableData
  };
}

// Helper to force-trigger MailApp permission dialog
function testSendEmail() {
  MailApp.sendEmail(Session.getActiveUser().getEmail(), "Redcliffe Quote Master - Permission Test", "If you receive this, permissions are authorized successfully!");
}