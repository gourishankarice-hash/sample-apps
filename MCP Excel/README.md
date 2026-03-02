# MCP Excel Server

A Model Context Protocol (MCP) server that converts tabular data to Excel files.

## Features

- Convert arrays of objects to Excel spreadsheets
- Customize sheet names and file names
- Base64-encoded output for easy integration
- TypeScript implementation with full type safety
- Zod schema validation for input data

## Installation

```bash
npm install
npm run build
```

## Usage

### Standalone Testing

To run the server directly:

```bash
npm run build
node build/index.js
```

The server will run on stdio and wait for MCP protocol messages.

### With MCP Inspector

For interactive testing during development, use the MCP Inspector:

```bash
npm install -g @modelcontextprotocol/inspector
mcp-inspector node build/index.js
```

This opens a web interface where you can:
- See registered tools
- Execute the `convert_to_excel` tool
- Inspect request/response payloads
- Debug errors

### Claude Desktop Integration

To use this server with Claude Desktop, add it to your MCP server configuration:

**Configuration file location:**
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

**Add this configuration:**

```json
{
  "mcpServers": {
    "excel-converter": {
      "command": "node",
      "args": ["C:\\Users\\gouri\\mcp-excel-server\\build\\index.js"]
    }
  }
}
```

**Note:** Replace the path with the absolute path to your `build/index.js` file. On Windows, make sure to use double backslashes (`\\`) in the path.

After updating the configuration:
1. Save the file
2. Restart Claude Desktop
3. The `convert_to_excel` tool will be available

## Tool: convert_to_excel

Converts tabular data (array of objects) to an Excel file.

### Parameters

- **data** (required): `Array<object>` - Array of objects representing table rows. Each object's keys become column headers.
- **sheetName** (optional): `string` - Name for the Excel sheet (default: "Sheet1")
- **fileName** (optional): `string` - Name for the output file (default: "output.xlsx")

### Example Usage

**Simple conversion:**

```json
{
  "data": [
    {"name": "John", "age": 30, "city": "New York"},
    {"name": "Jane", "age": 25, "city": "San Francisco"}
  ]
}
```

**With custom sheet and file names:**

```json
{
  "data": [
    {"product": "Laptop", "price": 999, "stock": 15},
    {"product": "Mouse", "price": 25, "stock": 100}
  ],
  "sheetName": "Products",
  "fileName": "inventory.xlsx"
}
```

### Response Format

The tool returns:
1. A success message with the file name
2. The Excel file as a base64-encoded string

You can decode the base64 string and save it as an `.xlsx` file.

## Development

### Watch Mode

For development with automatic recompilation:

```bash
npm run watch
```

### Build

To compile TypeScript to JavaScript:

```bash
npm run build
```

The compiled output will be in the `build/` directory.

## Testing

### Manual Testing with MCP Inspector

1. Install the MCP Inspector:
   ```bash
   npm install -g @modelcontextprotocol/inspector
   ```

2. Run the server with the inspector:
   ```bash
   npm run build
   mcp-inspector node build/index.js
   ```

3. Open the web interface and test with sample data

### Decoding Base64 Output

To verify the Excel file, you can decode the base64 string:

```javascript
// decode.js
import fs from 'fs';

const base64Data = "YOUR_BASE64_STRING_HERE";
const buffer = Buffer.from(base64Data, 'base64');
fs.writeFileSync('output.xlsx', buffer);
console.log('Excel file saved as output.xlsx');
```

Then run:
```bash
node decode.js
```

## Project Structure

```
mcp-excel-server/
├── src/
│   └── index.ts          # Main server implementation
├── build/                # Compiled JavaScript output
│   └── index.js
├── package.json          # Project configuration
├── tsconfig.json         # TypeScript configuration
├── .gitignore           # Git ignore file
└── README.md            # This file
```

## Technical Details

### MCP Protocol

This server implements the Model Context Protocol (MCP) using:
- **Transport**: StdioServerTransport for stdio communication
- **Tools**: Single tool `convert_to_excel` for Excel generation
- **Logging**: Uses `console.error()` for logging (never `console.log()` which would corrupt stdio)

### Excel Generation

Uses the `xlsx` library (SheetJS) to:
1. Create a new workbook
2. Convert JSON data to worksheet
3. Generate Excel file as buffer
4. Encode as base64 for transmission

### Input Validation

Uses Zod schemas to validate:
- Data array is not empty
- Data is an array of objects
- Optional parameters have proper types

### Error Handling

- Validation errors return clear messages
- Excel generation errors are caught and reported
- All errors use `isError: true` in responses

## Limitations

- **Memory usage**: All processing is in-memory, suitable for datasets up to ~10,000 rows
- **Base64 overhead**: Increases file size by ~33%
- **File formats**: Only supports `.xlsx` format (not `.xls` or `.csv`)

## Future Enhancements

Potential features for future versions:
- Multiple sheets support
- Cell styling and formatting
- Column width customization
- Excel formula support
- CSV output option
- Template-based generation

## Troubleshooting

### Server won't start

- Make sure dependencies are installed: `npm install`
- Make sure the project is built: `npm run build`
- Check that Node.js is installed: `node --version`

### Claude Desktop doesn't see the tool

- Verify the path in `claude_desktop_config.json` is absolute and correct
- Restart Claude Desktop after config changes
- Check that the server starts without errors: `node build/index.js`

### Base64 output is invalid

- Ensure the input data is properly formatted
- Check that the data array is not empty
- Verify each object in the array has the same keys

## License

MIT

## Support

For issues or questions, please check the MCP documentation:
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
