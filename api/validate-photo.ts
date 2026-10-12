// Checks that a report photo actually shows a road (ideally the pothole) and nothing inappropriate,
// before the app uploads it. The Anthropic key only lives here, never in the browser.
// Callers must send a Firebase ID token so nobody outside the app can spend the key.

import Anthropic from '@anthropic-ai/sdk'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'huecos-603c6'
const MODEL = 'claude-haiku-5-5'
const MAX_BYTES = 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

const firebaseKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
)

// Organization-scoped keys must name the workspace to bill on every request.
const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID
const client = new Anthropic({ defaultHeaders: workspaceId ? { 'anthropic-workspace-id': workspaceId } : undefined })

export type PhotoVerdict = 'ok' | 'not_road' | 'inappropriate' | 'unchecked'

// Matches the two photo slots in the report flow: 'closeup' must be of the road surface itself,
// 'context' may be a wider shot (a corner, a facade) that helps locate the pothole.
export type PhotoSlot = 'closeup' | 'context'
const SLOTS: PhotoSlot[] = ['closeup', 'context']

interface Classification {
  shows_road: boolean
  road_is_main_subject: boolean
  pothole_visible: boolean
  inappropriate: boolean
  reason: string
}

const SCHEMA = {
  type: 'object',
  properties: {
    shows_road: {
      type: 'boolean',
      description:
        'True only if this is a real photograph (not a drawing, map, graphic, screenshot or AI render) that shows a street, road, highway, sidewalk or similar paved/unpaved public way.',
    },
    road_is_main_subject: {
      type: 'boolean',
      description:
        'True if the road or sidewalk surface itself is the main subject of the photo. False when a building, entrance, storefront, vehicle, person or decoration is the main subject, even if some pavement is visible.',
    },
    pothole_visible: {
      type: 'boolean',
      description: 'True if a pothole, crack, sinkhole or other damage to the road surface is visible.',
    },
    inappropriate: {
      type: 'boolean',
      description: 'True if the photo contains nudity, sexual content, gore, violence, hate symbols or other content unfit for a public civic app.',
    },
    reason: { type: 'string', description: 'One short sentence explaining the decision.' },
  },
  required: ['shows_road', 'road_is_main_subject', 'pothole_visible', 'inappropriate', 'reason'],
  additionalProperties: false,
}

const PROMPT = `You review photos that people upload to a public civic app where neighbors report potholes in the streets of Peru.
Classify the photo. Be lenient with photo quality: night shots, blur, puddles covering the hole, partial views, rural dirt roads and close-ups of asphalt all count as a road.
A photo taken to give context (a street with house facades, a corner, a road sign) also counts as a road.
Only mark shows_road as false when the photo clearly is not of a public way (landscapes, beaches, people, food, screenshots, memes, interiors, etc.).`

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })

async function isSignedIn(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return false
  try {
    await jwtVerify(token, firebaseKeys, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    })
    return true
  } catch {
    return false
  }
}

function toVerdict(c: Classification, slot: PhotoSlot): PhotoVerdict {
  if (c.inappropriate) return 'inappropriate'
  if (!c.shows_road) return 'not_road'
  if (slot === 'closeup' && !c.road_is_main_subject) return 'not_road'
  return 'ok'
}

export async function classifyPhoto(bytes: ArrayBuffer, mediaType: (typeof ALLOWED_TYPES)[number], slot: PhotoSlot) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: Buffer.from(bytes).toString('base64') } },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  })

  // A safety refusal on a photo almost always means the photo itself is the problem.
  if (response.stop_reason === 'refusal') return { verdict: 'inappropriate' satisfies PhotoVerdict }

  const text = response.content.find((b) => b.type === 'text')?.text
  if (!text) return { verdict: 'unchecked' satisfies PhotoVerdict }

  const classification = JSON.parse(text) as Classification
  return { verdict: toVerdict(classification, slot), potholeVisible: classification.pothole_visible, reason: classification.reason }
}

export async function POST(request: Request) {
  if (!(await isSignedIn(request))) return json({ error: 'unauthorized' }, 401)

  const mediaType = request.headers.get('content-type') as (typeof ALLOWED_TYPES)[number]
  if (!ALLOWED_TYPES.includes(mediaType)) return json({ error: 'unsupported_type' }, 415)

  const slot = new URL(request.url).searchParams.get('slot') as PhotoSlot
  if (!SLOTS.includes(slot)) return json({ error: 'bad_slot' }, 400)

  const bytes = await request.arrayBuffer()
  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) return json({ error: 'bad_size' }, 413)

  try {
    return json(await classifyPhoto(bytes, mediaType, slot))
  } catch (error) {
    // Fail open: an API outage must not block people from reporting.
    if (error instanceof Anthropic.APIError) console.error(`validate-photo: API error ${error.status}`, error.message)
    else console.error('validate-photo:', error)
    return json({ verdict: 'unchecked' satisfies PhotoVerdict })
  }
}
