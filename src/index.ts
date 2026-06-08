interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Disney character database MCP.
 *
 * Wraps the keyless Disney API (https://api.disneyapi.dev): a searchable
 * catalog of Disney characters with their film / TV-show / video-game /
 * theme-park-attraction appearances, allies and enemies, plus an image URL.
 */


const BASE = 'https://api.disneyapi.dev';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

interface DisneyCharacter {
  _id?: number;
  name?: string;
  films?: string[];
  shortFilms?: string[];
  tvShows?: string[];
  videoGames?: string[];
  parkAttractions?: string[];
  allies?: string[];
  enemies?: string[];
  imageUrl?: string;
  // The live API returns this as `url`; the upstream docs call it `sourceUrl`.
  sourceUrl?: string;
  url?: string;
}

interface DisneyResponse {
  info?: {
    count?: number;
    totalPages?: number;
    previousPage?: string | null;
    nextPage?: string | null;
  };
  // `data` is an ARRAY for the list/filter endpoints, a SINGLE object for /character/<id>.
  data?: DisneyCharacter | DisneyCharacter[];
}

const tools: McpToolExport['tools'] = [
  {
    name: 'search_characters',
    description:
      'Search the Disney character database by name (e.g. "Mickey Mouse", "Elsa", "Stitch"). Returns matching characters with their film, TV-show, video-game and theme-park-attraction appearances plus an image URL. Matching is exact-ish on the name field.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Character name to search for, e.g. "Mickey Mouse".' },
        limit: { type: 'number', description: 'Max characters to return (default 10).' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_character',
    description:
      'Fetch a single Disney character by numeric id (_id). Returns the full record: films, short films, TV shows, video games, park attractions, allies, enemies, image URL and source URL.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: ['number', 'string'], description: 'The numeric character _id, e.g. 4703 (Mickey Mouse).' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_characters',
    description:
      'List/paginate the Disney character database. Returns a page of characters (id, name, image URL) plus total count and total page count. Useful for browsing the full catalog.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number, 1-based (default 1).' },
        pageSize: { type: 'number', description: 'Characters per page (default 20).' },
      },
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'search_characters':
        return await searchCharacters(args);
      case 'get_character':
        return await getCharacter(args);
      case 'list_characters':
        return await listCharacters(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: errMsg(err) };
  }
}

async function searchCharacters(args: Record<string, unknown>): Promise<unknown> {
  const name = typeof args.name === 'string' ? args.name.trim() : '';
  if (!name) return { error: 'Required argument "name" is missing. Pass a string like "Mickey Mouse".' };
  const limit = toPositiveInt(args.limit, 10);

  const json = (await disneyGet(`/character?name=${encodeURIComponent(name)}`)) as DisneyResponse;
  const list = asArray(json?.data);
  if (list.length === 0) return { count: 0, characters: [] };

  const characters = list.slice(0, limit).map((c) => ({
    id: c?._id ?? null,
    name: c?.name ?? null,
    films: arr(c?.films),
    tvShows: arr(c?.tvShows),
    videoGames: arr(c?.videoGames),
    parkAttractions: arr(c?.parkAttractions),
    imageUrl: c?.imageUrl ?? null,
  }));
  return { count: characters.length, characters };
}

async function getCharacter(args: Record<string, unknown>): Promise<unknown> {
  const id = args.id;
  if (id === undefined || id === null || (typeof id !== 'number' && typeof id !== 'string') || String(id).trim() === '') {
    return { error: 'Required argument "id" is missing. Pass the numeric character _id, e.g. 4703.' };
  }
  const idStr = encodeURIComponent(String(id).trim());

  const json = (await disneyGet(`/character/${idStr}`)) as DisneyResponse;
  // `data` is a single object here; tolerate an array just in case.
  const c = Array.isArray(json?.data) ? json?.data[0] : json?.data;
  if (!c || typeof c !== 'object' || c._id === undefined) {
    return { error: 'character not found', id };
  }

  return {
    id: c._id ?? null,
    name: c.name ?? null,
    films: arr(c.films),
    shortFilms: arr(c.shortFilms),
    tvShows: arr(c.tvShows),
    videoGames: arr(c.videoGames),
    parkAttractions: arr(c.parkAttractions),
    allies: arr(c.allies),
    enemies: arr(c.enemies),
    imageUrl: c.imageUrl ?? null,
    sourceUrl: c.sourceUrl ?? c.url ?? null,
  };
}

async function listCharacters(args: Record<string, unknown>): Promise<unknown> {
  const page = toPositiveInt(args.page, 1);
  const pageSize = toPositiveInt(args.pageSize, 20);

  const json = (await disneyGet(`/character?page=${page}&pageSize=${pageSize}`)) as DisneyResponse;
  const list = asArray(json?.data);
  const characters = list.map((c) => ({
    id: c?._id ?? null,
    name: c?.name ?? null,
    imageUrl: c?.imageUrl ?? null,
  }));
  return {
    count: json?.info?.count ?? characters.length,
    totalPages: json?.info?.totalPages ?? null,
    page,
    characters,
  };
}

async function disneyGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Disney API: ${res.status} ${body.slice(0, 200)}`.trim());
  }
  return res.json();
}

function asArray(data: DisneyResponse['data']): DisneyCharacter[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : [];
}

function toPositiveInt(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
