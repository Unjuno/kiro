import report from '../../reports/consider-validation.json';
// Counts and validation status only. No story text, future choices, or ending paths.
export function GET() {
  return Response.json({status:report.status, nodes:report.nodes, edges:report.edges, endings:report.endings, unreachable:report.unreachable_nodes.length, dangling:report.dangling_edges.length, cycles:report.cycles.length, graph_sha256:report.graph_sha256}, {headers:{'Cache-Control':'no-store'}});
}
