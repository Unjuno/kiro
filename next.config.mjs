export default {
  // The runtime needs only validated metadata, nodes and a compact manifest.
  // Do not ship the source HTML captures or validation reports to clients.
  outputFileTracingIncludes: {
    '/*': [
      './stories/catalog.json',
      './stories/*/story.json',
      './stories/*/nodes.json',
      './stories/*/source.manifest.json',
    ],
  },
};
