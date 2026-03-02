import fs from 'fs';
import path from 'path';

// Instructions:
// 1. Copy the base64 string from the MCP Inspector response
// 2. Replace the base64Data value below with your copied string
// 3. Run: node decode.js
// 4. The Excel file will be saved in the current directory

const base64Data = "PASTE_YOUR_BASE64_STRING_HERE";

// Optional: Change the output filename here
const outputFileName = "output.xlsx";

try {
  if (base64Data === "PASTE_YOUR_BASE64_STRING_HERE") {
    console.error("❌ Error: Please replace 'PASTE_YOUR_BASE64_STRING_HERE' with your actual base64 string");
    console.log("\nHow to use:");
    console.log("1. Copy the base64 string from the MCP Inspector response");
    console.log("2. Open decode.js and replace the base64Data value");
    console.log("3. Run: node decode.js");
    process.exit(1);
  }

  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(outputFileName, buffer);

  const fullPath = path.resolve(outputFileName);
  console.log(`✅ Success! Excel file saved as: ${outputFileName}`);
  console.log(`📂 Full path: ${fullPath}`);
  console.log(`📊 File size: ${(buffer.length / 1024).toFixed(2)} KB`);
} catch (error) {
  console.error("❌ Error decoding base64 string:", error.message);
  console.log("\nMake sure:");
  console.log("- The base64 string is valid");
  console.log("- You have write permissions in this directory");
  process.exit(1);
}
