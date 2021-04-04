function chart(resources) {
    builder = new ConnectionBuilder(resources)
    const links = builder.links().map(d => Object.create(d));
    const rawNodes = builder.nodes()
    const nodes = rawNodes.map(d => Object.create(d));

    function linkMouseovered(active) {
        return function (event, d) {
            if (
                active
            ) {
                d3.select(`#arrow-${d} path`)
                    .attr("fill", "#bb8082")
                d3.select(`#arrow-${d}`)
                    .attr("refX", 10.2)
                    .attr("refY", 0)
                    .attr("markerWidth", 2)
                    .attr("markerHeight", 2)
                d3.select(this)
                    .attr("stroke-width", 5)
                    .style("cursor", "pointer")
                    .attr("stroke", "#bb8082")
            } else {
                d3.select(`#arrow-${d} path`)
                    .attr("fill", "#046582")
                d3.select(this)
                    .attr("stroke-width", 1.5)
                    .style("cursor", "default")
                    .attr("stroke", "#046582")
                d3.select(`#arrow-${d}`)
                    .attr("refX", 15.2)
                    .attr("refY", -0.5)
                    .attr("markerWidth", 4)
                    .attr("markerHeight", 4)
            }
        };
    }


    function pointMouseOvered(active) {
        return function (event, d) {
            if (
                active
            ) {
                d3.select(`#circle-${d}`)
                    .attr("r", 5);
                d3.select(this)
                    .style("cursor", "pointer")
            } else {
                d3.select(`#circle-${d}`)
                    .attr("r", 3.35);
                d3.select(this)
                    .style("cursor", "default")
            }
        };
    }

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id))
        .force("charge", d3.forceManyBody().strength(-800))
        .force("x", d3.forceX())
        .force("y", d3.forceY());

    var chartDiv = document.getElementById("chart");
    var width = chartDiv.clientWidth;
    var height = chartDiv.clientHeight;

    var svg = d3.select(chartDiv).append("svg");
    svg.attr("width", width)
        .attr("height", height)
        .attr("viewBox", [-chartDiv.clientWidth / 2, -chartDiv.clientHeight / 2, chartDiv.clientWidth, chartDiv.clientHeight])
        .style("font", "14px sans-serif")
        .call(d3.zoom().on("zoom", function () {
            svg.style("font", Math.ceil(14/d3.event.transform.k).toString() + "px sans-serif")
            drawingBoard.attr(
                "transform",
                d3.event.transform
            )
        }));

    var drawingBoard = svg.append("g")

    drawingBoard.append("defs").selectAll("marker")
        .data(links)
        .join("marker")
        .attr("id", function(d){return `arrow-${d.index}`})
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 15.2)
        .attr("refY", -0.5)
        .attr("markerWidth", 4)
        .attr("markerHeight", 4)
        .attr("orient", "auto")
        .append("path")
        .attr("fill", "#046582")
        .attr("d", "M0,-5L10,0L0,5");

    const link = drawingBoard.append("g")
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
        .selectAll("path")
        .data(links)
        .join("path")
        .attr("stroke", "#046582")
        .attr("marker-end", d => `url(${new URL(`#arrow-${d.index}`, location)})`)
        .on("click", drawLinksModal)
        .on("mouseover", linkMouseovered(true))
        .on("mouseout", linkMouseovered(false));


    const node = drawingBoard.append("g")
        .attr("fill", "currentColor")
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .on("click", drawNodeModalClosure(rawNodes, nodes, links))
        .on("mouseover", pointMouseOvered(true))
        .on("mouseout", pointMouseOvered(false));

    node.append("circle")
        .attr("id", function(d){return `circle-${d.index}`})
        .attr("stroke", "white")
        .attr("stroke-width", 1.2)
        .attr("r", 3.35);

    node.append("text")
        .attr("x", 8)
        .attr("y", "0.31em")
        .text(d => d.id)
        .clone(true).lower()
        .attr("fill", "none")
        .attr("stroke", d => d.type == "error" ? "red" : "white")
        .attr("stroke-width", 1);

    simulation.on("tick", () => {
        link.attr("d", linkArc);
        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    return svg.node();
}


function linkArc(d) {
    const r = Math.hypot(d.target.x - d.source.x, d.target.y - d.source.y);
    return `
    M${d.source.x},${d.source.y}
    A${r},${r} 0 0,1 ${d.target.x},${d.target.y}
  `;
}
$.get('/resources', function (resources) {
    $("#spinner").css("display", "none");
    chart(resources);
 })
