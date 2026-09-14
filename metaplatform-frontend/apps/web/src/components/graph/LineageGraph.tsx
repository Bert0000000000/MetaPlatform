import { useEffect, useRef } from 'react';
import './graph.css';

/*
 * LineageGraph —— 分层数据血缘 DAG（移植自 ui-redesign 原型 §13 的 buildLineage）。
 *
 * 每层一列，节点矩形 124×40 rx8 在层内垂直居中排布，层间用三次贝塞尔流边连接；
 * 悬停流边高亮（.mp-graph-hi）。同样是「effect 里建 DOM、CSS 控制观感」的零依赖实现。
 */

export interface LineageLayer {
  title: string;
  nodes: Array<{ id: string; label: string; sub?: string; highlight?: boolean }>;
}

export interface LineageGraphProps {
  layers: LineageLayer[];
  /** 节点 id 对，[source, target] */
  flows: Array<[string, string]>;
  width?: number;
  height?: number;
  className?: string;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

const PAD_X = 96;
const PAD_Y = 78;
const NODE_W = 124;
const NODE_H = 40;

function mk<K extends keyof SVGElementTagNameMap>(
  tag: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag);
}

export default function LineageGraph({
  layers,
  flows,
  width = 1200,
  height = 640,
  className,
}: LineageGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const edgesGRef = useRef<SVGGElement>(null);
  const nodesGRef = useRef<SVGGElement>(null);
  const labelsGRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const edgesG = edgesGRef.current;
    const nodesG = nodesGRef.current;
    const labelsG = labelsGRef.current;
    if (!svg || !edgesG || !nodesG || !labelsG) return;

    edgesG.replaceChildren();
    nodesG.replaceChildren();
    labelsG.replaceChildren();

    const pos = new Map<string, { x: number; y: number }>();
    const colCount = Math.max(layers.length, 1);
    const colSpan = Math.max(colCount - 1, 1);

    layers.forEach((layer, li) => {
      const x = PAD_X + li * ((width - PAD_X * 2) / colSpan);
      const rowCount = Math.max(layer.nodes.length, 1);

      layer.nodes.forEach((n, ni) => {
        const y = PAD_Y + (ni + 0.5) * ((height - PAD_Y * 2) / rowCount);
        pos.set(n.id, { x, y });

        const g = mk('g');
        g.setAttribute('class', n.highlight ? 'mp-graph-ln-node mp-graph-l1' : 'mp-graph-ln-node');

        const rect = mk('rect');
        rect.setAttribute('x', String(-NODE_W / 2));
        rect.setAttribute('y', String(-NODE_H / 2));
        rect.setAttribute('width', String(NODE_W));
        rect.setAttribute('height', String(NODE_H));
        rect.setAttribute('rx', '8');

        const t = mk('text');
        t.setAttribute('y', '-1');
        t.textContent = n.label;

        const s = mk('text');
        s.setAttribute('class', 'mp-graph-ln-sub');
        s.setAttribute('y', '13');
        s.textContent = n.sub ?? '';

        g.appendChild(rect);
        g.appendChild(t);
        g.appendChild(s);
        g.setAttribute('transform', `translate(${x},${y})`);
        nodesG.appendChild(g);
      });

      const ll = mk('text');
      ll.setAttribute('class', 'mp-graph-ln-layer-label');
      ll.setAttribute('x', String(x));
      ll.setAttribute('y', '36');
      ll.setAttribute('text-anchor', 'middle');
      ll.textContent = layer.title;
      labelsG.appendChild(ll);
    });

    flows.forEach(([a, b]) => {
      const A = pos.get(a);
      const B = pos.get(b);
      if (!A || !B) return;
      const p = mk('path');
      p.setAttribute('class', 'mp-graph-ln-edge');
      const mx = (A.x + B.x) / 2;
      p.setAttribute(
        'd',
        `M ${A.x + NODE_W / 2} ${A.y} C ${mx} ${A.y}, ${mx} ${B.y}, ${B.x - NODE_W / 2} ${B.y}`,
      );
      p.addEventListener('pointerenter', () => {
        p.classList.add('mp-graph-hi');
        p.setAttribute('stroke-width', '2.2');
      });
      p.addEventListener('pointerleave', () => {
        p.classList.remove('mp-graph-hi');
        p.setAttribute('stroke-width', '1.3');
      });
      edgesG.appendChild(p);
    });
    // 监听挂在 p 上，随 replaceChildren 一并移除，无需额外清理
  }, [layers, flows, width, height]);

  return (
    <div className={className ? `mp-graph-stage ${className}` : 'mp-graph-stage'}>
      <svg ref={svgRef} className="mp-graph-svg" viewBox={`0 0 ${width} ${height}`}>
        <g ref={edgesGRef} />
        <g ref={nodesGRef} />
        <g ref={labelsGRef} />
      </svg>
    </div>
  );
}
