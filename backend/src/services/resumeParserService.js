/**
 * Resume Parser Service — Phase 2
 *
 * Handles PDF and DOCX text extraction.
 * Uses robust modern parser with multiple fallback strategies.
 * Returns clean, normalized plain text for downstream analysis.
 */

const fs = require('fs');
const path = require('path');

/**
 * Extract text from a PDF file using pdf2json with fallback to pdf-parse.
 * @param {string} filePath - Absolute path to the PDF file
 * @returns {Promise<string>} Extracted text
 */
const extractTextFromPDF = async (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  if (buffer.length === 0) {
    throw new Error('The uploaded PDF file is empty.');
  }

  // Strategy 1: pdf2json (handles all modern xref, form fields, links)
  try {
    const text = await extractWithPdf2Json(filePath);
    if (text && text.trim().length >= 20) {
      return cleanExtractedText(text);
    }
  } catch (pdf2JsonErr) {
    console.warn('[PDFParser] pdf2json warning:', pdf2JsonErr.message);
  }

  // Strategy 2: pdf-parse fallback
  try {
    let pdfParseModule = require('pdf-parse');
    const pdfParse = typeof pdfParseModule === 'function'
      ? pdfParseModule
      : (pdfParseModule.default || pdfParseModule);

    if (typeof pdfParse === 'function') {
      const data = await pdfParse(buffer);
      const text = data?.text || '';
      if (text && text.trim().length >= 20) {
        return cleanExtractedText(text);
      }
    }
  } catch (pdfParseErr) {
    console.warn('[PDFParser] pdf-parse fallback warning:', pdfParseErr.message);
  }

  throw new Error(
    'No machine-readable text was found in this PDF. ' +
    'The file may be a scanned image or image-only PDF. ' +
    'OCR support is not enabled in Phase 2. Please upload a text-based PDF.'
  );
};

/**
 * Helper to extract raw text with pdf2json Promise wrapper.
 */
const extractWithPdf2Json = (filePath) => {
  return new Promise((resolve, reject) => {
    try {
      const PDFParser = require('pdf2json');
      const pdfParser = new PDFParser(null, 1);

      pdfParser.on('pdfParser_dataError', (errData) => {
        reject(new Error(errData?.parserError || 'pdf2json parsing error'));
      });

      pdfParser.on('pdfParser_dataReady', () => {
        try {
          const rawText = pdfParser.getRawTextContent();
          resolve(rawText || '');
        } catch (err) {
          reject(err);
        }
      });

      pdfParser.loadPDF(filePath);
    } catch (e) {
      reject(e);
    }
  });
};

/**
 * Extract text from a DOCX file using mammoth.
 * @param {string} filePath - Absolute path to the DOCX file
 * @returns {Promise<string>} Extracted text
 */
const extractTextFromDOCX = async (filePath) => {
  const mammoth = require('mammoth');

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  if (buffer.length === 0) {
    throw new Error('The uploaded DOCX file is empty.');
  }

  let result;
  try {
    result = await mammoth.extractRawText({ buffer });
  } catch (err) {
    throw new Error(`DOCX parsing failed: ${err.message}`);
  }

  const text = result.value || '';
  if (!text || text.trim().length < 20) {
    throw new Error(
      'No readable text was found in this DOCX file. ' +
      'The document may be corrupted or contain only images.'
    );
  }

  return cleanExtractedText(text);
};

/**
 * Dispatcher — selects PDF or DOCX extractor based on MIME type or extension.
 * @param {string} filePath - Path to the uploaded file
 * @param {string} mimeType - MIME type from multer
 * @returns {Promise<string>} Extracted plain text
 */
const extractTextFromFile = async (filePath, mimeType) => {
  const ext = path.extname(filePath).toLowerCase();

  const isPDF =
    mimeType === 'application/pdf' || ext === '.pdf';

  const isDOCX =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    ext === '.docx' ||
    ext === '.doc';

  if (isPDF) {
    return extractTextFromPDF(filePath);
  } else if (isDOCX) {
    return extractTextFromDOCX(filePath);
  } else {
    throw new Error(
      `Unsupported file type: ${mimeType || ext}. Only PDF and DOCX files are supported.`
    );
  }
};

/**
 * Normalize extracted text:
 * - Remove excessive blank lines (max 2 consecutive)
 * - Normalize tabs/carriage returns
 * - Preserve meaningful line breaks
 * - Remove null bytes and non-printable characters (except newlines)
 *
 * @param {string} rawText
 * @returns {string}
 */
const cleanExtractedText = (rawText) => {
  return rawText
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Replace tabs with spaces
    .replace(/\t/g, ' ')
    // Remove null bytes and control characters (keep newlines)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize more than 2 consecutive blank lines → 2 blank lines
    .replace(/\n{3,}/g, '\n\n')
    // Remove trailing spaces on each line
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
};

module.exports = {
  extractTextFromFile,
  extractTextFromPDF,
  extractTextFromDOCX,
  cleanExtractedText,
};
