import * as d3 from "https://cdn.skypack.dev/d3@7";
import { interactive_tree } from './edam-tree-reusable-d3.js';

let myTree = null;
let treeInitialized = false;

/**
 * Converts the flat window.globalNodeRegistry (already built by the
 * jsTree browser view from your OWL/vowlData) into the nested
 * { id, text, meta, children } shape interactive_tree() expects
 * (its default identifierAccessor reads d.data.id, textAccessor reads
 * d.data.text, and initTreeAndTriggerUpdate() reads root.data.meta).
 * Nodes with no superclasses become top-level branches under one
 * synthetic "mCODE-ORCHID" root node, the same idea as EDAM's own root.
 */
function buildHierarchyFromRegistry(registry) {
    const built = new Map();      // id -> finished node, computed only once ever
    const inProgress = new Set(); // ids currently being built, guards against real cycles

    function buildNode(id) {
        if (built.has(id)) {
            // Already computed this class's subtree — reuse it, but return a fresh
            // wrapper object so D3 treats each occurrence as its own node instance.
            const cached = built.get(id);
            return { id: cached.id, text: cached.text, meta: cached.meta, children: cached.children };
        }
        if (inProgress.has(id)) return null; // guards against a genuine cycle in the data

        const node = registry[id];
        if (!node) return null;

        inProgress.add(id);
        const children = (node.meta.subclasses || [])
            .map(childId => buildNode(childId))
            .filter(Boolean);
        inProgress.delete(id);

        const result = {
            id: node.id,
            text: node.text,
            meta: node.meta,
            children: children.length ? children : undefined
        };
        built.set(id, result);
        return result;
    }

    const rootIds = Object.keys(registry).filter(id => registry[id].meta.superclasses.length === 0);
    const rootChildren = rootIds.map(id => buildNode(id)).filter(Boolean);

    return { id: '__root__', text: 'mCODE-ORCHID', meta: {}, children: rootChildren };
}

/** Wraps a text label onto multiple short lines so it fits inside a bubble. */
if (!text) return [''];
    const words = String(text).split(/\s+/).flatMap(w => {
        const parts = [];
        for (let i = 0; i < w.length; i += maxLen) parts.push(w.slice(i, i + maxLen));
        return parts.length ? parts : [''];
    });
    const lines = [];
    let current = '';
    words.forEach(word => {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= maxLen) {
            current = candidate;
        } else {
            if (current) lines.push(current);
            current = word;
        }
    });
    if (current) lines.push(current);
    return lines.length ? lines : [''];
}

/** Looks up a class's display text from the global registry, falling back to the raw id. */
function getRegistryLabel(id) {
    const entry = window.globalNodeRegistry ? window.globalNodeRegistry[id] : null;
    return entry && entry.text ? entry.text : id;
}

/**
 * Renders the "Relationship Map" bubble diagram (superclass / subclasses / properties)
 * for whichever class is passed in, into #bubble-diagram-svg-container. Mirrors the
 * look of the team's existing PyVis concept-map export: an orange "Selected Class"
 * hub in the middle, with superclasses, subclasses, and property targets arranged
 * around it and labeled edges (subclassOf, or the property name).
 *
 * Classes with a huge fan-out (e.g. "Histologic Type" with hundreds of subclasses)
 * are capped per category (MAX_PER_ROLE) so bubbles never overlap into an
 * unreadable ring; the rest collapse into a single "+N more" bubble that opens a
 * scrollable, clickable list underneath the diagram.
 */
const MAX_SATELLITES_PER_ROLE = 12;

function renderBubbleDiagram(nodeData) {
    alert('NEW VERSION');
    const container = document.getElementById('bubble-diagram-svg-container');
    if (!container) return;
 
    // Stop any previous simulation so old diagrams don't keep running in the background.
    if (container.__bubbleSim) { container.__bubbleSim.stop(); container.__bubbleSim = null; }
    container.innerHTML = '';
 
    if (!nodeData || nodeData.id === '__root__') {
        container.innerHTML = '<p class="bubble-empty-msg">Select a class in the tree above to see its superclasses, subclasses, and properties as a bubble map.</p>';
        return;
    }
 
    const meta = nodeData.meta || {};
    const centerLabel = nodeData.text || nodeData.id;
 
    // ---- 1. Collect + cap satellites (same logic as before) ----
    const superclassIds = [...new Set(meta.superclasses || [])];
    const subclassIds = [...new Set(meta.subclasses || [])];
 
    const propSeen = new Set();
    const propertyEntries = [];
    (meta.slots || []).forEach(slot => {
        if (!slot || !slot.range) return;
        if (slot.type !== 'Object Property' && slot.type !== 'Data Property') return;
        const key = `${slot.name}::${slot.range}`;
        if (propSeen.has(key)) return;
        propSeen.add(key);
        propertyEntries.push(slot);
    });
 
    const cap = arr => [arr.slice(0, MAX_SATELLITES_PER_ROLE), arr.slice(MAX_SATELLITES_PER_ROLE)];
    const [cappedSup, overflowSup] = cap(superclassIds);
    const [cappedSub, overflowSub] = cap(subclassIds);
    const [cappedProps, overflowProps] = cap(propertyEntries);
 
    const SUB_EDGE = { label: 'subclassOf', dashed: true, color: '#999999' };
    const satellites = [];
 
    cappedSup.forEach(id => satellites.push({
        id, label: getRegistryLabel(id), role: 'Superclass', color: '#b2f5f7', size: 40,
        edge: { ...SUB_EDGE, direction: 'outgoing' }
    }));
    if (overflowSup.length) satellites.push({
        id: null, label: `+${overflowSup.length} more`, role: 'Superclass', isOverflow: true,
        overflowIds: overflowSup, color: '#e2e8f0', size: 34,
        edge: { ...SUB_EDGE, direction: 'outgoing' }
    });
 
    cappedSub.forEach(id => satellites.push({
        id, label: getRegistryLabel(id), role: 'Subclass', color: '#c2ffce', size: 38,
        edge: { ...SUB_EDGE, direction: 'incoming' }
    }));
    if (overflowSub.length) satellites.push({
        id: null, label: `+${overflowSub.length} more`, role: 'Subclass', isOverflow: true,
        overflowIds: overflowSub, color: '#e2e8f0', size: 34,
        edge: { ...SUB_EDGE, direction: 'incoming' }
    });
 
    cappedProps.forEach(slot => satellites.push({
        id: slot.range, label: getRegistryLabel(slot.range), role: 'Class', color: '#e3cfff', size: 36,
        edge: { direction: 'outgoing', label: slot.name, dashed: false, color: '#02bac7' }
    }));
    if (overflowProps.length) satellites.push({
        id: null, label: `+${overflowProps.length} more`, role: 'Class', isOverflow: true,
        overflowProps, color: '#e2e8f0', size: 34,
        edge: { direction: 'outgoing', label: 'relatesTo', dashed: false, color: '#02bac7' }
    });
 
    if (satellites.length === 0) {
        container.innerHTML = `<p class="bubble-empty-msg">"${centerLabel}" has no linked superclasses, subclasses, or properties to show.</p>`;
        return;
    }
 
    // ---- 2. Build simulation nodes + links ----
    const width = Math.max(container.clientWidth || 900, 700);
    const height = 620;
    const cx = width / 2, cy = height / 2;
    const centerRadius = 46;
    const ringRadius = Math.max(170, (satellites.length * 100) / (2 * Math.PI));
 
    const centerNode = {
        key: '__center__', isCenter: true, size: centerRadius,
        x: cx, y: cy, fx: cx, fy: cy // pinned only until the user first drags it
    };
    const nodes = [centerNode];
    const links = [];
 
    satellites.forEach((sat, i) => {
        const angle = (i / satellites.length) * 2 * Math.PI - Math.PI / 2;
        const node = {
            ...sat, key: `sat-${i}`,
            x: cx + ringRadius * Math.cos(angle),
            y: cy + ringRadius * Math.sin(angle)
        };
        nodes.push(node);
        const outgoing = sat.edge.direction === 'outgoing';
        links.push({
            source: outgoing ? centerNode.key : node.key,
            target: outgoing ? node.key : centerNode.key,
            sat: node, edge: sat.edge, isOverflow: !!sat.isOverflow
        });
    });
 
    // Pill dimensions come from the label text
    links.forEach(l => {
        l.pillW = Math.max(36, l.edge.label.length * 5.6 + 16);
        l.pillH = 17;
    });
 
    // ---- 3. SVG scaffolding ----
    const svg = d3.select(container).append('svg')
        .attr('width', '100%')
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('cursor', 'grab')
        .style('touch-action', 'none');
 
    const defs = svg.append('defs');
    [['bubble-arrow-gray', '#999999'], ['bubble-arrow-teal', '#02bac7']].forEach(([id, fill]) => {
        defs.append('marker')
            .attr('id', id).attr('viewBox', '0 0 10 10')
            .attr('refX', 9).attr('refY', 5)
            .attr('markerWidth', 6).attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path').attr('d', 'M0,0 L10,5 L0,10 Z').attr('fill', fill);
    });
 
    const zoomLayer = svg.append('g').attr('class', 'bubble-zoom-layer');
    const linkLayer = zoomLayer.append('g').attr('class', 'bubble-links');
    const pillLayer = zoomLayer.append('g').attr('class', 'bubble-pills');
    const nodeLayer = zoomLayer.append('g').attr('class', 'bubble-nodes-layer');
 
    svg.call(
        d3.zoom()
            .scaleExtent([0.3, 4])
            .filter(event => !event.target.closest('.bubble-node') && !event.button) // don't pan while dragging a bubble
            .on('zoom', e => zoomLayer.attr('transform', e.transform))
            .on('start', () => svg.style('cursor', 'grabbing'))
            .on('end', () => svg.style('cursor', 'grab'))
    );
 
    // ---- 4. Draw links, pills, nodes ----
    const linkSel = linkLayer.selectAll('line').data(links).enter().append('line')
        .attr('stroke', d => d.edge.color)
        .attr('stroke-width', d => d.edge.dashed ? 1.4 : 2)
        .attr('stroke-dasharray', d => d.edge.dashed ? '5,4' : null)
        .attr('marker-end', d => d.isOverflow ? null : (d.edge.dashed ? 'url(#bubble-arrow-gray)' : 'url(#bubble-arrow-teal)'));
 
    const pillSel = pillLayer.selectAll('g').data(links.filter(l => !l.isOverflow)).enter().append('g')
        .attr('class', 'bubble-pill')
        .style('pointer-events', 'none');
    pillSel.append('rect')
        .attr('width', d => d.pillW).attr('height', d => d.pillH)
        .attr('x', d => -d.pillW / 2).attr('y', d => -d.pillH / 2)
        .attr('rx', d => d.pillH / 2).attr('ry', d => d.pillH / 2)
        .attr('fill', '#ffffff')
        .attr('stroke', d => d.edge.color)
        .attr('stroke-width', 1.2);
    pillSel.append('text')
        .attr('text-anchor', 'middle').attr('dy', '0.35em')
        .attr('font-size', 10)
        .attr('fill', '#334155')
        .text(d => d.edge.label);
 
    const nodeSel = nodeLayer.selectAll('g').data(nodes, d => d.key).enter().append('g')
        .attr('class', 'bubble-node')
        .style('cursor', 'pointer');
 
    nodeSel.append('circle')
        .attr('r', d => d.size)
        .attr('fill', d => d.isCenter ? '#87c5ff' : d.color)
        .attr('stroke', d => d.isCenter ? '#02bac7' : (d.isOverflow ? '#94a3b8' : '#6b8fa3'))
        .attr('stroke-dasharray', d => d.isOverflow ? '4,3' : null);
 
    nodeSel.each(function (d) {
        const g = d3.select(this);
        const lines = d.isCenter
            ? [...wrapBubbleLabel(centerLabel, 14), '(Selected Class)']
            : d.isOverflow
                ? wrapBubbleLabel(d.label, 14)
                : [...wrapBubbleLabel(d.label, 14), `(${d.role})`];
        lines.forEach((line, i) => {
            const isTag = (d.isCenter || !d.isOverflow) && i === lines.length - 1;
            g.append('text')
                .attr('y', (i - (lines.length - 1) / 2) * 12)
                .attr('font-weight', d.isCenter && !isTag ? 'bold' : 'normal')
                .attr('font-style', isTag ? 'italic' : 'normal')
                .style('pointer-events', 'none')
                .text(line);
        });
    });
 
    // Click = re-center on that class (unless it was a drag; d3.drag suppresses click after movement)
    nodeSel.on('click', (event, d) => {
        if (d.isCenter) return;
        if (d.isOverflow) { showBubbleOverflowList(d, nodeData); return; }
        const registryEntry = window.globalNodeRegistry ? window.globalNodeRegistry[d.id] : null;
        if (registryEntry) showNodeDetails({ data: registryEntry });
    });
 
    // Double-click = pin / unpin (WebVOWL-style)
    nodeSel.on('dblclick', (event, d) => {
        event.stopPropagation();
        if (d.fx != null && !d.isCenter) { d.fx = null; d.fy = null; }
        else if (d.fx != null && d.isCenter) { d.fx = null; d.fy = null; }
        else { d.fx = d.x; d.fy = d.y; }
        simulation.alpha(0.3).restart();
    });
 
    // ---- 5. Force simulation ----
    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.key)
            .distance(d => ringRadius * 0.95).strength(0.7))
        .force('charge', d3.forceManyBody().strength(-420))
        .force('collide', d3.forceCollide().radius(d => d.size + 16).strength(0.9))
        .force('x', d3.forceX(cx).strength(0.025))
        .force('y', d3.forceY(cy).strength(0.025))
        .force('drift', alpha => {
            // Very small random nudge so the map keeps gently floating instead of freezing.
            nodes.forEach(n => {
                if (n.fx != null) return;
                n.vx += (Math.random() - 0.5) * 0.12;
                n.vy += (Math.random() - 0.5) * 0.12;
            });
        })
        .alphaTarget(0.03)      // never fully cools => perpetual gentle float
        .alphaDecay(0.02)
        .velocityDecay(0.35);
    container.__bubbleSim = simulation;
 
    // Release the center pin after the first tick so it floats like everything else
    // (it still starts at the middle, and you can drag it).
    setTimeout(() => { if (centerNode.fx === cx) { centerNode.fx = null; centerNode.fy = null; } }, 800);
 
    simulation.on('tick', () => {
        // keep nodes within the viewBox
        nodes.forEach(n => {
            n.x = Math.max(n.size + 4, Math.min(width - n.size - 4, n.x));
            n.y = Math.max(n.size + 4, Math.min(height - n.size - 4, n.y));
        });
 
        linkSel.each(function (d) {
            const s = d.source, t = d.target;
            const dx = t.x - s.x, dy = t.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / dist, uy = dy / dist;
            d3.select(this)
                .attr('x1', s.x + ux * s.size).attr('y1', s.y + uy * s.size)
                .attr('x2', t.x - ux * t.size).attr('y2', t.y - uy * t.size);
        });
 
        pillSel.attr('transform', d => `translate(${(d.source.x + d.target.x) / 2},${(d.source.y + d.target.y) / 2})`);
        nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
    });
 
    // ---- 6. Dragging ----
    nodeSel.call(
        d3.drag()
            .on('start', (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x; d.fy = d.y;
                svg.style('cursor', 'grabbing');
            })
            .on('drag', (event, d) => {
                d.fx = event.x; d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) simulation.alphaTarget(0.03);
                // Release so it keeps floating (double-click to pin instead).
                d.fx = null; d.fy = null;
                svg.style('cursor', 'grab');
            })
    );
}

/**
 * Renders a scrollable, clickable list of whichever ids/properties got capped out
 * of the bubble diagram, directly under the SVG — so nothing is ever truly hidden,
 * just tucked one click away.
 */
function showBubbleOverflowList(overflowSat, centerNodeData) {
    const container = document.getElementById('bubble-diagram-svg-container');
    if (!container) return;

    let listBox = document.getElementById('bubble-overflow-list');
    if (listBox) listBox.remove();

    listBox = document.createElement('div');
    listBox.id = 'bubble-overflow-list';
    listBox.className = 'bubble-overflow-list';

    const heading = document.createElement('div');
    heading.className = 'bubble-overflow-heading';
    heading.textContent = overflowSat.overflowProps
        ? `Remaining ${overflowSat.overflowProps.length} properties`
        : `Remaining ${overflowSat.role.toLowerCase()}es`.replace('Classes', 'classes');
    listBox.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'bubble-overflow-items';

    if (overflowSat.overflowProps) {
        overflowSat.overflowProps.forEach(slot => {
            const item = document.createElement('span');
            item.className = 'value-link bubble-overflow-item';
            item.textContent = `${slot.name} → ${getRegistryLabel(slot.range)}`;
            item.addEventListener('click', () => {
                const registryEntry = window.globalNodeRegistry ? window.globalNodeRegistry[slot.range] : null;
                if (registryEntry) showNodeDetails({ data: registryEntry });
            });
            list.appendChild(item);
        });
    } else {
        (overflowSat.overflowIds || []).forEach(id => {
            const item = document.createElement('span');
            item.className = 'value-link bubble-overflow-item';
            item.textContent = getRegistryLabel(id);
            item.addEventListener('click', () => {
                const registryEntry = window.globalNodeRegistry ? window.globalNodeRegistry[id] : null;
                if (registryEntry) showNodeDetails({ data: registryEntry });
            });
            list.appendChild(item);
        });
    }

    listBox.appendChild(list);
    container.appendChild(listBox);
}

/** Populates the right-hand "Details of Class:" panel for the clicked node. */
function showNodeDetails(d) {
    if (!d || !d.data) return;
    const meta = d.data.meta || {};

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value && value !== 'None' ? value : '-';
    };

    const titleEl = document.getElementById('panel-title');
    if (titleEl) {
        // If a node is selected, show its name; otherwise show a default header
        titleEl.textContent = d && d.data && d.data.text 
            ? `Details of Class: "${d.data.text}"` 
            : 'Details of Class';
    }

    setText('val-rdfs-label', meta.rdfsLabel);
    setText('val-pref-label', meta.prefLabel);
    setText('val-definition', meta.comment);
    setText('val-comment', meta.rdfsComment);

    const copyToClipboard = (text, iconEl) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            if (!iconEl) return;
            const original = iconEl.textContent;
            iconEl.textContent = '✓';
            setTimeout(() => { iconEl.textContent = original; }, 1000);
        });
    };

    // URI / IRI rendered as a pill (like Class Parents), click to copy
    const uriCell = document.getElementById('val-uri-cell');
    if (uriCell) {
        uriCell.innerHTML = '';
        if (meta.iri && meta.iri !== 'None') {
            const pill = document.createElement('span');
            pill.className = 'ontology-pill iri-pill';
            pill.title = 'Click to copy IRI';

            const label = document.createElement('span');
            label.textContent = meta.iri;
            pill.appendChild(label);

            const icon = document.createElement('span');
            icon.className = 'ontology-pill-copy-icon';
            icon.textContent = '🗐';
            pill.appendChild(icon);

            pill.addEventListener('click', () => copyToClipboard(meta.iri, icon));
            uriCell.appendChild(pill);
        } else {
            uriCell.textContent = '-';
        }
    }

   const fillPills = (cellId, ids) => {
        const cell = document.getElementById(cellId);
        if (!cell) return;
        cell.innerHTML = '';
        (ids || []).forEach(refId => {
            const refNode = window.globalNodeRegistry ? window.globalNodeRegistry[refId] : null;
            if (!refNode) return;

            // 'pill' must be declared here within the loop scope
            const pill = document.createElement('span');
            pill.className = 'ontology-pill';
            pill.title = 'Click to copy IRI';

            const label = document.createElement('span');
            label.textContent = refNode.text;
            pill.appendChild(label);

            const icon = document.createElement('span');
            icon.className = 'ontology-pill-copy-icon';
            icon.textContent = '🗐';
            pill.appendChild(icon);

            pill.addEventListener('click', () => {
                copyToClipboard(refNode.meta ? refNode.meta.iri : null, icon);
            });

            cell.appendChild(pill);
        });
    };

    /** Renders meta.slots (populated by processOntologyData's propertiesList pass)
     *  filtered to one property type, as plain (non-clickable) pills. */
    const fillSlotPills = (cellId, slots, slotType, colorClass) => {
        const cell = document.getElementById(cellId);
        if (!cell) return;
        cell.innerHTML = '';
        (slots || []).filter(s => s.type === slotType).forEach(s => {
            const pill = document.createElement('span');
            pill.className = 'ontology-pill property-pill ' + colorClass;
            if (s.range) pill.title = `Range: ${s.range}`;
            pill.textContent = s.name;
            cell.appendChild(pill);
        });
    };

    fillPills('val-parents', meta.superclasses);
    fillPills('val-equivalent', meta.equivalent);
    fillSlotPills('val-object-properties', meta.slots, 'Object Property', 'property-pill-object');
    fillSlotPills('val-datatype-properties', meta.slots, 'Data Property', 'property-pill-data');

    // Mark this node as the visually "selected" (green) node, EDAM-style.
    if (myTree && myTree.cmd && d.data.id !== '__root__') {
        myTree.cmd.selectElement(d.data.id, true, false);
    }

    // Refresh the relationship bubble diagram for this class.
    renderBubbleDiagram(d.data);
}

/**
 * Called by the tab-switch handler already in index.html the first
 * time the "Visualization View" tab is opened. Waiting until then
 * guarantees window.globalNodeRegistry has been populated.
 */
window.initializeEdamGraphicView = function () {
    if (treeInitialized) return;

    if (!window.globalNodeRegistry || Object.keys(window.globalNodeRegistry).length === 0) {
        console.warn('Ontology registry not ready yet — cannot build the tree view.');
        return;
    }

    const hierarchyData = buildHierarchyFromRegistry(window.globalNodeRegistry);

    myTree = interactive_tree()
        .clickedElementHandler(showNodeDetails);

    // 1. Render the tree into its container (sets up the svg/zoom/update fns)
    d3.select('#ontology-tree-container').call(myTree);

    // 2. Pass the data — this triggers the first layout + collapse pass
    myTree.data(hierarchyData);

    // 3. Auto-expand just the root level so the top branches are visible
    //    on first load, matching EDAM's own default view.
    if (hierarchyData.children && hierarchyData.children.length) {
        myTree.cmd.expandElement(hierarchyData.children[0].id);
    }

    // Wire up the +/-/home zoom control buttons (see index.html markup)
    document.getElementById('tree-zoom-in')?.addEventListener('click', () => myTree.cmd.manualZoomInAndOut('in'));
    document.getElementById('tree-zoom-out')?.addEventListener('click', () => myTree.cmd.manualZoomInAndOut('out'));
    document.getElementById('tree-zoom-reset')?.addEventListener('click', () => myTree.cmd.resetPanAndZoom());
    document.getElementById('tree-expand-all')?.addEventListener('click', () => myTree.cmd.expandAllDescendantElement());
    document.getElementById('tree-collapse-all')?.addEventListener('click', () => myTree.cmd.collapseNotSelectedElement());

    treeInitialized = true;
    console.log('Ontology tree initialized successfully.');
};
