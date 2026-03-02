import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("🔧 Excel Base64 Decoder");
console.log("========================\n");

rl.question("📋 Paste your base64 string here: ", (base64Data) => {
  rl.question("\n💾 Enter output filename (default: output.xlsx): ", (filename) => {
    const outputFileName = filename.trim() || "output.xlsx";

    // Ensure .xlsx extension
    const finalFileName = outputFileName.endsWith('.xlsx')
      ? outputFileName
      : outputFileName + '.xlsx';

    try {
      if (!base64Data || base64Data.trim() === "") {
        console.error("❌ Error: No base64 string provided");
        rl.close();
        process.exit(1);
      }

      const buffer = Buffer.from(base64Data.trim(), 'base64');
      fs.writeFileSync(finalFileName, buffer);

      const fullPath = path.resolve(finalFileName);
      console.log(`\n✅ Success! Excel file saved!`);
      console.log(`📂 Location: ${fullPath}`);
      console.log(`📊 File size: ${(buffer.length / 1024).toFixed(2)} KB`);
      console.log(`\n✨ You can now open the file in Excel!`);
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      console.log("\nPossible issues:");
      console.log("- Invalid base64 string");
      console.log("- No write permissions");
      console.log("- File is currently open");
    } finally {
      rl.close();
    }
  });
});
