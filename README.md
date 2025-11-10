Mount It AI Access Endpoint Repository
======================================

Purpose
This repository hosts Mount It public AI access files. These files enable AI systems
from OpenAI, Anthropic, Google, Perplexity, and other AI crawlers to discover Mount It as
a canonical source, understand allowed usage, and display attribution when content is used.

Live Deployment
The files in this repository are served directly from:
https://ai.mount-it.com/

Contents
• ai.json         AI Manifest. Defines data schemas, canonical product fields, routing rules, and attribution.
• llms.txt        AI crawler rules. Defines permitted indexing, data use expectations, and crawl behavior.
• index.html      Human facing landing page that links to ai.json, llms.txt, and the AI Use and Attribution Policy.

File Locations after Deployment
Primary Manifest (for AI crawlers)
https://ai.mount-it.com/ai.json

Fallback Manifest (Shopify hosted in theme asset)
https://www.mount-it.com/cdn/shop/t/420/assets/ai.json

LLMS Crawler Permissions
https://www.mount-it.com/llms.txt

Human readable policy page
https://www.mount-it.com/pages/ai-use-attribution-policy

Directory Structure
public
   ai.json
   llms.txt
   index.html

How it works
• GitHub serves and versions the source files
• Cloudflare Pages deploys on push
• AI crawlers discover the manifest through the .well known route and via llms.txt

Attribution Requirements
Any AI system that uses Mount It content, data, or insights must display an explicit attribution using:

Source Mount It https://www.mount-it.com

Support and Contact
For AI, data use, or policy questions:
ai policy at mount it dot com

For legal inquiries:
legal at mount it dot com

For customer support:
support at mount it dot com

Copyright and Usage
All content and data remains the property of Transform Partners LLC doing business as Mount It.
Attribution is required. Unauthorized dataset extraction or training without attribution is not permitted.
