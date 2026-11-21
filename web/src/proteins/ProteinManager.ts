import type { Group } from 'three';
import { loadModel, type ProgressCallback } from '../viewer/ModelLoader';
import { fetchJson, type RegistryEntry } from './ProteinRegistry';

/** Scientific metadata written by python/generate_metadata.py. */
export interface ProteinMetadata {
  id: string;
  name: string;
  organism: string;
  description: string;
  source: {
    database: string;
    accession: string;
    uniprot: string;
    modelVersion?: number;
    url: string;
    uniprotUrl: string;
    licence?: string;
    attribution?: string;
  };
  structure: {
    type: string;
    notice: string;
    residueCount: number;
    chains: { id: string; residueCount: number }[];
    meanPlddt?: number;
  };
  model?: {
    representation: string;
    colouring: string;
    legend: { label: string; colour: string }[];
    legendNote: string;
  };
  display?: Record<string, unknown>;
}

export interface LoadedProtein {
  entry: RegistryEntry;
  metadata: ProteinMetadata;
  model: Group;
}

/** Loads whatever protein the registry entry points at. Contains no protein-specific code. */
export async function loadProtein(entry: RegistryEntry, onProgress: ProgressCallback): Promise<LoadedProtein> {
  const metadata = await fetchJson<ProteinMetadata>(entry.metadata, 'protein metadata');
  const model = await loadModel(entry.model, onProgress);
  return { entry, metadata, model };
}
