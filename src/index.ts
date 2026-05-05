#!/usr/bin/env node
/**
 * ProofStream MCP Server
 * Gives AI agents the ability to dispatch a human verifier to physically
 * verify something in the real world — product authenticity, property condition,
 * document existence — and receive a timestamped evidence report.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

const PROOFSTREAM_API = 'https://api.proofstream.ai';

const server = new Server(
  {
    name: 'proofstream',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: 'proofstream_submit_request',
    description: `Submit a human verification request to ProofStream. A real human will go
on-site with a camera, livestream the verification, and deliver a timestamped
evidence report (photo + video + written findings). Use this when your workflow
requires physical confirmation of something in the real world.

Services available:
- product_verification ($39 standard / $79 with livestream): Authenticate a
  physical product — serial numbers, packaging, labels, authentication markers.
- document_verification ($99 standard / $149 with livestream): Confirm a physical
  document exists, matches claimed content, photograph stamps/signatures/seals.
- property_asset_check ($249 standard / $349 with livestream): On-site visual
  condition documentation of a property, vehicle, or asset.

Urgency options: standard (24-72 hours), rush (+50%, within 24h), same_day (+100%)

Returns a case_id you can use to check status. Card is authorized but NOT charged
until ProofStream accepts the request.`,
    inputSchema: {
      type: 'object',
      required: ['name', 'email', 'service', 'description', 'location'],
      properties: {
        name: { type: 'string', description: 'Requester full name' },
        email: { type: 'string', description: 'Email for report delivery and credentials' },
        company: { type: 'string', description: 'Organization name (optional)' },
        client_type: {
          type: 'string',
          enum: ['AI Agent / Autonomous System', 'Enterprise / Business', 'Individual', 'Legal / Compliance', 'Insurance', 'Other'],
          description: 'Type of requester',
          default: 'AI Agent / Autonomous System'
        },
        service: {
          type: 'string',
          enum: ['product', 'document', 'property'],
          description: 'product = Product Verification | document = Document Verification | property = Property & Asset Check'
        },
        livestream: {
          type: 'string',
          enum: ['yes', 'no'],
          description: 'Whether to include live video feed access (adds cost)',
          default: 'no'
        },
        urgency: {
          type: 'string',
          enum: ['standard', 'rush', 'same_day'],
          description: 'standard = 24-72 hours | rush = within 24h (+50%) | same_day = +100%',
          default: 'standard'
        },
        description: { type: 'string', description: 'What needs to be verified — be specific' },
        location: { type: 'string', description: 'Physical address or location of the item/property to verify' },
        preferred_date: { type: 'string', description: 'Preferred verification date (YYYY-MM-DD)' },
        metrics: { type: 'string', description: 'Specific checkpoints or things to look for during verification' },
        access_notes: { type: 'string', description: 'Access instructions, contact info for site access' },
        deliverables: {
          type: 'array',
          items: { type: 'string', enum: ['Timestamped photo report', 'Full video recording', 'Written verification summary', 'Evidence package with metadata'] },
          description: 'Required deliverables (Timestamped photo report always included)'
        },
        billing: {
          type: 'string',
          enum: ['one_time', 'enterprise'],
          default: 'one_time'
        }
      }
    }
  },
  {
    name: 'proofstream_check_status',
    description: `Check the status of a ProofStream verification request by case ID.

Status values:
- pending_review: Request received, awaiting ProofStream acceptance
- confirmed: Accepted, payment captured, verification scheduled
- scheduled: Verification date/time confirmed
- in_progress: Verifier on-site, livestream active (if requested)
- completed: Verification done, report delivered to email
- cancelled: Request declined (no charge)

When status is "completed", the full evidence report and invoice have been
emailed to the address provided at submission.`,
    inputSchema: {
      type: 'object',
      required: ['case_id'],
      properties: {
        case_id: { type: 'string', description: 'Case ID returned from proofstream_submit_request (e.g., PS-ABC123)' }
      }
    }
  },
  {
    name: 'proofstream_get_pricing',
    description: 'Get current ProofStream pricing and service details without making a request.',
    inputSchema: { type: 'object', properties: {} }
  }
];

// ─── Tool Handlers ────────────────────────────────────────────────────────────

async function submitRequest(args: Record<string, unknown>): Promise<string> {
  const payload = {
    name: args.name,
    email: args.email,
    company: args.company || '',
    client_type: args.client_type || 'AI Agent / Autonomous System',
    service: args.service,
    livestream: args.livestream || 'no',
    urgency: args.urgency || 'standard',
    description: args.description,
    location: args.location,
    preferred_date: args.preferred_date || '',
    metrics: args.metrics || '',
    access_notes: args.access_notes || '',
    deliverables: args.deliverables || ['Timestamped photo report', 'Written verification summary'],
    billing: args.billing || 'one_time',
  };

  const res = await fetch(`${PROOFSTREAM_API}/api/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json() as Record<string, unknown>;

  if (!res.ok || !data.success) {
    return JSON.stringify({ error: data.error || data.message || 'Submission failed', status: res.status });
  }

  return JSON.stringify({
    success: true,
    case_id: data.case_id,
    quoted_amount: data.quoted_amount,
    message: data.message,
    next_steps: 'ProofStream will review your request and respond within a few hours. Payment is authorized but not charged until the request is accepted. You will receive a confirmation email at the address provided.',
    status_check: `Use proofstream_check_status with case_id "${data.case_id}" to track progress.`,
  });
}

async function checkStatus(args: Record<string, unknown>): Promise<string> {
  const caseId = String(args.case_id).toUpperCase();
  const res = await fetch(`${PROOFSTREAM_API}/api/cases/${caseId}/status`);
  
  if (!res.ok) {
    return JSON.stringify({ error: `Case ${caseId} not found`, status: res.status });
  }

  const data = await res.json() as Record<string, unknown>;
  return JSON.stringify({
    case_id: data.case_id,
    status: data.status,
    status_label: data.status_label,
    service: data.service,
    submitted_at: data.submitted_at,
    message: getStatusMessage(String(data.status)),
  });
}

function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    pending_review: 'Your request is under review. ProofStream will respond within a few hours.',
    new: 'Request received and queued for review.',
    reviewing: 'ProofStream is reviewing your request and may reach out with questions.',
    quoted: 'A quote has been sent to your email for review.',
    confirmed: 'Verification accepted and payment captured. Scheduling underway.',
    scheduled: 'Verification date confirmed. Verifier will arrive as scheduled.',
    in_progress: 'Verification is underway. If you requested livestream, check your email for watch credentials.',
    completed: 'Verification complete. Your report and invoice have been emailed to you.',
    cancelled: 'Request was not accepted. No charge was made.',
  };
  return messages[status] || 'Unknown status';
}

function getPricing(): string {
  return JSON.stringify({
    services: {
      product_verification: {
        description: 'Physical product authentication — serial numbers, packaging, labels, authentication markers',
        standard: '$39 (photo + video report, 24-48 hour turnaround)',
        with_livestream: '$79 (watch in real time + report)',
        turnaround: '24-48 hours',
      },
      document_verification: {
        description: 'Confirm a physical document exists, matches claimed content, photograph stamps/signatures/seals',
        standard: '$99 (photo evidence + written report, 24-48 hours)',
        with_livestream: '$149',
        turnaround: '24-48 hours',
      },
      property_asset_check: {
        description: 'On-site visual condition documentation — property, vehicle, or asset',
        standard: '$249 (standardized checklist + 30-50 photos + condition summary)',
        with_livestream: '$349 (watch and direct the verifier in real time)',
        turnaround: '48-72 hours (location dependent)',
      },
    },
    urgency_fees: {
      rush: '+50% (verification within 24 hours, limited availability)',
      same_day: '+100% (same-day, very limited availability)',
    },
    travel: 'Travel 50+ miles from verifier location billed at IRS mileage rate',
    payment: 'Card authorized at submission, charged only if request is accepted',
    service_area: 'Ohio, Indiana, Kentucky, West Virginia, Western PA, Southern MI & Eastern IL. Additional areas announced soon.',
    contact: 'verify@proofstream.ai | proofstream.ai',
  });
}

// ─── Request Handlers ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const toolArgs = (args || {}) as Record<string, unknown>;

  try {
    let result: string;
    switch (name) {
      case 'proofstream_submit_request':
        result = await submitRequest(toolArgs);
        break;
      case 'proofstream_check_status':
        result = await checkStatus(toolArgs);
        break;
      case 'proofstream_get_pricing':
        result = getPricing();
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: 'text', text: result }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true };
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ProofStream MCP server running on stdio');
}

main().catch(console.error);
