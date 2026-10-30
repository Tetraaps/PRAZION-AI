# PRAZION AI

A full-stack Next.js starter for a premium, multi-provider AI workspace. It includes the responsive branded chat UI, Supabase Google OAuth wiring, server-side OpenAI/Anthropic streaming endpoints, conversation persistence, RLS schema, and private attachment upload scaffolding.

## Current implementation status

**Implemented in this starter**
- Premium Deep Navy / Midnight Blue / Electric Blue design tokens, responsive workspace and mobile drawer.
- Google OAuth flow through Supabase Auth and protected `/app` route middleware.
- Server-side provider calls for OpenAI and Anthropic; streaming deltas; clear missing-key errors.
- Conversation create/load/delete and message persistence.
- SQL schema with RLS for profiles, conversations, messages, attachments, and settings.
- Private Storage upload route with extension/MIME/size allowlist.
- Markdown and GitHub-flavored Markdown rendering.
- Basic theme toggle, conversation search, copy response, and sign-out.

**Not yet production-complete**
- Uploaded file contents are **not yet extracted or passed to the AI model**. The UI explicitly tells the user this. PDF/DOCX/XLSX parsers and image-vision payloads still need implementation.
- Edit/resend, regenerate, cancellation propagation to provider, usage/token tracking, rate limiting, and automated tests need implementation.
- The current chat request sends the latest user message only, not the full prior conversation context. Add server-side message retrieval and provider message mapping before treating it as a full conversational memory experience.
- Profile and user-settings records are created by the SQL trigger; run the schema first.
- Review security policies, abuse controls, quotas, logging, retention and privacy terms before production use.

## Requirements
- Node.js 20+
- Supabase project
- Google OAuth credentials
- At least one provider API key (OpenAI or Anthropic)

## Local setup
1. Install Node.js 20 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and populate values.
4. In Supabase SQL Editor, run `supabase/schema.sql`.
5. In Supabase Authentication settings, enable Google and configure the Google client ID/secret. Set the callback URL to `https://YOUR_PROJECT.supabase.co/auth/v1/callback`. Add your local app URL and deployed URL to the allowed redirect URLs, including `http://localhost:3000/auth/callback`.
6. Ensure the `prazion-attachments` bucket exists and is private. The schema attempts to create it and adds per-user path policies.
7. Set at least one of `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`. These are server-only variables; never prefix them with `NEXT_PUBLIC_`.
8. Run `npm run dev` and open `http://localhost:3000`.

## Environment variables
See `.env.example`. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public client configuration; service-role and AI keys must remain server-side. The service-role key is not required by this starter's routes and should not be exposed to browsers.

## Deployment checklist
- Configure environment variables in the hosting provider's secret settings.
- Add production domain to Supabase Auth redirect URLs.
- Configure Google OAuth authorized redirect URI to Supabase's callback endpoint.
- Run schema migration against production Supabase.
- Confirm bucket privacy and RLS policies with two separate test accounts.
- Add rate limiting (e.g. per-user and per-IP), provider budgets, request timeouts, monitoring and error redaction.
- Add tests for authorization, RLS, malformed input, upload abuse, provider failures and stream disconnects.
- Implement attachment parsing/vision before marketing uploads as AI-readable.
- Run `npm run build` and resolve all type/build errors in your deployment environment.

## Architecture
- `src/app/api/chat/route.ts`: authenticated, server-only provider adapter and SSE response.
- `src/app/api/upload/route.ts`: authenticated private upload route.
- `src/app/api/conversations`: authenticated conversation CRUD/read routes.
- `src/lib/supabase`: browser and server clients.
- `supabase/schema.sql`: schema, RLS, private storage bucket and profile bootstrap trigger.

## Privacy
Messages are stored in your Supabase database. When a user submits a prompt, the selected AI provider receives the prompt to generate a response. Uploaded files are stored privately, but this starter does not yet send file contents to the AI provider. Update the privacy notice to match the final deployed architecture and retention practices.
