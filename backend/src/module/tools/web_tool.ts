import Exa from 'exa-js';
import type { ToolDefinition } from '../ai_agent/types';
import type { ToolHandler } from './tool_registry';
import ChatSessionModel from '@/database/chat_session';

const MAX_READ_URLS = 5;
const SEARCH_RESULT_LIMIT = 5;

let exaClient: Exa | null = null;
function getExaClient(): Exa {
  if (!exaClient) {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) throw new Error('EXA_API_KEY is not set');
    exaClient = new Exa(apiKey);
  }
  return exaClient;
}

// Tool 1: Search Web
const searchWebDefinition: ToolDefinition = {
  name: "search_web",
  description: `Search the web. Returns up to ${SEARCH_RESULT_LIMIT} results with title, URL, publish date, and a short highlight snippet from each page. Use this to find external information not available in the repository.`,
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query.",
      },
    },
    required: ["query"],
  },
};

export const searchWebHandler: ToolHandler = {
  definition: searchWebDefinition,
  async execute(input, chatSession, _currentUser) {
    const sessionModel = await ChatSessionModel.findByPk(chatSession.id);
    if (!sessionModel) {
      return { output: 'Chat session not found', isError: true };
    }

    const query = input.query as string;
    if (!query) {
      return { output: 'Missing required parameter: query', isError: true };
    }

    try {
      const exa = getExaClient();
      const response = await exa.search(query, {
        numResults: SEARCH_RESULT_LIMIT,
        contents: { highlights: true },
      });

      // TODO: track cost in chat session
      const _costDollars = response.costDollars?.total ?? 0;
      void _costDollars;

      if (response.results.length === 0) {
        return { output: 'No results found.' };
      }

      const sections = response.results.map((r, i) => {
        const highlights = (r.highlights ?? []).join(' ... ') || '(no highlight)';
        const date = r.publishedDate ? ` — ${r.publishedDate}` : '';
        return `[${i + 1}] ${r.title ?? '(no title)'}${date}\n${r.url}\n${highlights}`;
      });

      return { output: sections.join('\n\n') };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { output: `Web search failed: ${message}`, isError: true };
    }
  },
};

// Tool 2: Read Web
const readWebDefinition: ToolDefinition = {
  name: "read_web",
  description: `Fetch the full text content of one or more web pages. Accepts 1 to ${MAX_READ_URLS} URLs per call — pass multiple URLs to read several pages in a single call.`,
  inputSchema: {
    type: "object",
    properties: {
      urls: {
        type: "array",
        items: { type: "string" },
        description: `Array of URLs to fetch (1 to ${MAX_READ_URLS}).`,
      },
    },
    required: ["urls"],
  },
};

export const readWebHandler: ToolHandler = {
  definition: readWebDefinition,
  async execute(input, chatSession, _currentUser) {
    const sessionModel = await ChatSessionModel.findByPk(chatSession.id);
    if (!sessionModel) {
      return { output: 'Chat session not found', isError: true };
    }
    
    const urls = input.urls as string[] | undefined;
    if (!Array.isArray(urls) || urls.length === 0) {
      return { output: 'Missing or invalid parameter: urls (must be a non-empty array).', isError: true };
    }
    if (urls.length > MAX_READ_URLS) {
      return { output: `Too many URLs: max ${MAX_READ_URLS} per call, got ${urls.length}.`, isError: true };
    }

    try {
      const exa = getExaClient();
      const response = await exa.getContents(urls, { text: true });

      // TODO: track cost in chat session
      const _costDollars = response.costDollars?.total ?? 0;
      void _costDollars;

      if (response.results.length === 0) {
        return { output: 'No content returned.' };
      }

      const sections = response.results.map((r) => {
        const text = r.text || '(no text extracted)';
        return `## ${r.title ?? r.url}\nURL: ${r.url}\n\n${text}`;
      });

      return { output: sections.join('\n\n---\n\n') };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { output: `Failed to fetch web pages: ${message}`, isError: true };
    }
  },
};
