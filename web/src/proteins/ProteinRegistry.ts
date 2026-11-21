/** The protein registry (web/public/proteins.json) and URL helpers. Nothing here is protein-specific. */

export interface RegistryEntry {
  id: string;
  name: string;
  organism: string;
  model: string;
  metadata: string;
}

export interface Registry {
  defaultProtein: string;
  proteins: RegistryEntry[];
}

export class AppError extends Error {
  constructor(
    public readonly title: string,
    message: string,
  ) {
    super(message);
  }
}

/** Fetch JSON with clear, visitor-friendly errors for network and format problems. */
export async function fetchJson<T>(url: string, what: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new AppError('Network unavailable', `Could not reach the server while loading the ${what}. Check your connection and try again.`);
  }
  if (!response.ok) {
    throw new AppError(`${capitalise(what)} not found`, `The ${what} (${url}) could not be loaded (HTTP ${response.status}).`);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new AppError(`Invalid ${what}`, `The ${what} (${url}) is not valid JSON.`);
  }
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export async function loadRegistry(): Promise<Registry> {
  const registry = await fetchJson<Registry>('/proteins.json', 'protein registry');
  if (!Array.isArray(registry.proteins) || registry.proteins.length === 0) {
    throw new AppError('Empty registry', 'proteins.json does not list any proteins.');
  }
  return registry;
}

/** Work out which protein id the current URL asks for: "/" -> default, "/protein/<ID>" -> ID. */
export function proteinIdFromPath(pathname: string, registry: Registry): string {
  const match = pathname.match(/^\/protein\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]).toUpperCase() : registry.defaultProtein;
}

export function findEntry(registry: Registry, id: string): RegistryEntry {
  const entry = registry.proteins.find((p) => p.id.toUpperCase() === id.toUpperCase());
  if (!entry) {
    const known = registry.proteins.map((p) => `${p.name} (${p.id})`).join(', ');
    throw new AppError('Unknown protein', `"${id}" is not in the protein registry. Available: ${known}.`);
  }
  return entry;
}
