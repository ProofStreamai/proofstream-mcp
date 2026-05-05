# ProofStream MCP Server

Give your AI agent the ability to dispatch a human verifier to physically verify something in the real world.

## What It Does

ProofStream is the only API that lets your AI agent send a human to physically verify something — product authenticity, property condition, document existence — and receive back a timestamped evidence report with photos, video, and written findings.

**Your agent stops being blocked by the physical world.**

## Tools

### `proofstream_submit_request`
Submit a verification request. A real human goes on-site with a camera, livestreams the verification (optional), and delivers a full evidence package.

**Services:**
- `product` — Physical product authentication ($39 / $79 with livestream)
- `document` — Document existence and content confirmation ($99 / $149 with livestream)  
- `property` — Property or asset condition documentation ($249 / $349 with livestream)

**Urgency:** `standard` (24-72h) | `rush` (+50%) | `same_day` (+100%)

### `proofstream_check_status`
Check status of a submitted request by case ID.

### `proofstream_get_pricing`
Get current pricing and service details.

## Install

### Claude Desktop / MCP Client

```json
{
  "mcpServers": {
    "proofstream": {
      "command": "npx",
      "args": ["proofstream-mcp"]
    }
  }
}
```

### npm (global)

```bash
npm install -g proofstream-mcp
```

## Example Usage

```
Agent: I need to verify that the product at 123 Main St, Columbus OH matches the description before we complete the purchase.

Tool call: proofstream_submit_request({
  "name": "Acme Corp",
  "email": "ops@acmecorp.com",
  "client_type": "AI Agent / Autonomous System",
  "service": "product",
  "livestream": "yes",
  "description": "Verify a 2024 MacBook Pro 16-inch (Space Black) — confirm serial number MXW73LL/A, check for damage, confirm all original accessories present",
  "location": "123 Main St, Columbus OH 43201",
  "preferred_date": "2026-05-06",
  "urgency": "standard"
})

Response: {
  "success": true,
  "case_id": "PS-XK9M2P",
  "quoted_amount": 79,
  "message": "Request received. ProofStream will review and respond within a few hours."
}
```

## Service Area

Ohio, Indiana, Kentucky, West Virginia, Western PA, Southern MI & Eastern IL. Expanding soon.

## API

Direct REST API also available at `https://api.proofstream.ai`. See `proofstream.ai/request.html` for the full intake form.

**Contact:** verify@proofstream.ai | [proofstream.ai](https://proofstream.ai)
