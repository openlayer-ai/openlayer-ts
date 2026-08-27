/**
 * Public entry point for the Mastra integration.
 *
 * The implementation lives in `./mastra/`; this flat module exists so the
 * integration is reachable as `openlayer/lib/integrations/mastra`, matching
 * every other integration in this package. `dist/package.json`'s `exports`
 * map is regenerated from a directory scan at build time
 * (scripts/utils/postprocess-files.cjs), which discards hand-authored
 * subpaths — so only paths matching the generated `./lib/*` wildcard are
 * reachable by consumers.
 */
export * from './mastra/index';
