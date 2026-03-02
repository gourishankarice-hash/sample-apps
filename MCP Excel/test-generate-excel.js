import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

console.log("🧪 Testing Excel Generation");
console.log("============================\n");

// Sample data - same format that the MCP server would accept
const testData = {
  employees: [
    { name: "John Doe", age: 30, city: "New York", salary: 75000, department: "Engineering" },
    { name: "Jane Smith", age: 25, city: "San Francisco", salary: 85000, department: "Design" },
    { name: "Bob Johnson", age: 35, city: "Chicago", salary: 65000, department: "Sales" },
    { name: "Alice Williams", age: 28, city: "Boston", salary: 72000, department: "Marketing" },
    { name: "Charlie Brown", age: 32, city: "Austin", salary: 78000, department: "Engineering" }
  ],
  products: [
    { product: "Laptop", price: 999, stock: 15, category: "Electronics", supplier: "TechCorp" },
    { product: "Mouse", price: 25, stock: 100, category: "Accessories", supplier: "PeriphCo" },
    { product: "Keyboard", price: 75, stock: 50, category: "Accessories", supplier: "PeriphCo" },
    { product: "Monitor", price: 299, stock: 30, category: "Electronics", supplier: "DisplayInc" },
    { product: "Webcam", price: 89, stock: 45, category: "Electronics", supplier: "TechCorp" }
  ],
  sales: [
    { date: "2024-01-15", customer: "ABC Corp", amount: 5000, status: "Paid", region: "East" },
    { date: "2024-01-16", customer: "XYZ Inc", amount: 3500, status: "Pending", region: "West" },
    { date: "2024-01-17", customer: "Tech Solutions", amount: 7200, status: "Paid", region: "Central" },
    { date: "2024-01-18", customer: "Global Ltd", amount: 4200, status: "Paid", region: "East" },
    { date: "2024-01-19", customer: "StartUp Co", amount: 2800, status: "Pending", region: "West" }
  ]
};

// Generate Excel files for each dataset
Object.entries(testData).forEach(([name, data]) => {
  try {
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, name.charAt(0).toUpperCase() + name.slice(1));

    // Generate filename
    const fileName = `sample_${name}.xlsx`;

    // Write to file
    XLSX.writeFile(workbook, fileName);

    const fullPath = path.resolve(fileName);
    const stats = fs.statSync(fileName);

    console.log(`✅ Generated: ${fileName}`);
    console.log(`   📂 Location: ${fullPath}`);
    console.log(`   📊 Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`   📋 Rows: ${data.length}`);
    console.log(`   🔑 Columns: ${Object.keys(data[0]).length}\n`);

    // Also generate base64 version (like the MCP server does)
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const base64 = buffer.toString('base64');

    // Save base64 to a text file for reference
    fs.writeFileSync(`${fileName}.base64.txt`, base64);
    console.log(`   🔐 Base64 saved to: ${fileName}.base64.txt\n`);

  } catch (error) {
    console.error(`❌ Error generating ${name}:`, error.message);
  }
});

console.log("============================");
console.log("✨ Test Complete!");
console.log("\nGenerated files:");
console.log("  • sample_employees.xlsx");
console.log("  • sample_products.xlsx");
console.log("  • sample_sales.xlsx");
console.log("\nYou can now:");
console.log("  1. Open these files in Excel");
console.log("  2. Compare with MCP server output");
console.log("  3. Use the .base64.txt files to test the decoder");
