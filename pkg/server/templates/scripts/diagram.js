function isSubset(smallerSet, biggerSet) {
    return _.every(
        smallerSet,
        function (value, key) {
            return biggerSet[key] == value
        }
    )
}

function basicLabelsExtractor(rawResource){
    return (rawResource.spec.template.metadata || {}).labels || {}
}

function cronJobLabelsExtractor(rawResource){
    return (rawResource.spec.jobTemplate.spec.template.metadata || {}).labels || {}
}

function podLabelsExtractor(rawResource){
    return (rawResource.metadata || {}).labels || {}
}

function getLabelsExtractor(rawResource){
    return {
        "Pod": podLabelsExtractor,
        "CronJob": cronJobLabelsExtractor
    }[rawResource.kind] || basicLabelsExtractor
}

function Workload(rawResource, itsNamespace) {
    this.rawResource = rawResource
    this.itsNamespace = itsNamespace
    this.labelsExtractor = getLabelsExtractor(rawResource)
}

Workload.prototype.id = function () {
    return this.itsNamespace.name() + "/" + this.rawResource.metadata.name
}

Workload.prototype.labels = function () {
    return this.labelsExtractor(this.rawResource)
}

Workload.prototype.namespaceLabels = function () {
    return this.itsNamespace.labels()
}

Workload.prototype.namespaceName = function () {
    return this.itsNamespace.name()
}

Workload.prototype.cidrs = function () {
    return []
}

function VirtualWorkload(cidrs) {
    this._cidrs = cidrs
}

VirtualWorkload.prototype.id = function () {
    return this._cidrs.join(',')
}

VirtualWorkload.prototype.labels = function () {
    return {}
}

VirtualWorkload.prototype.namespaceLabels = function () {
    return {}
}

VirtualWorkload.prototype.namespaceName = function () {
    return "internet"
}

VirtualWorkload.prototype.cidrs = function () {
    return this._cidrs
}

function NetworkPolicy(rawResource) {
    this.rawResource = rawResource
}

NetworkPolicy.prototype.name = function () {
    return this.rawResource.metadata.name
}
NetworkPolicy.prototype.id = function () {
    return this.rawResource.metadata.namespace + "/" + this.rawResource.metadata.name
}

NetworkPolicy.prototype.appliesTo = function (workload) {
    if (this.rawResource.metadata.namespace != workload.namespaceName()) {
        return false
    }
    return isSubset(this.rawResource.spec.podSelector.matchLabels, workload.labels())
}


NetworkPolicy.prototype.externalAddresses = function (workload) {
    var allAddresses = []
    if (!_.isEmpty(this.rawResource.spec.ingress)) {
        _.each(this.rawResource.spec.ingress, function(ingressRule){
            _.each(ingressRule.from, function(fromRule){
                if (!_.isEmpty(fromRule.ipBlock)) {
                    allAddresses = _.union(allAddresses, [fromRule.ipBlock.cidr])
                }
            })
        })
    }
    if (!_.isEmpty(this.rawResource.spec.egress)) {
        _.each(this.rawResource.spec.egress, function(egressRule){
            _.each(egressRule.to, function(toRule){
                if (!_.isEmpty(toRule.ipBlock)) {
                    allAddresses = _.union(allAddresses, [toRule.ipBlock.cidr])
                }
            })
        })
    }
    return allAddresses
}

function cidrMatches(one, another) {
    return one == another
}


NetworkPolicy.prototype.allowsConnectionsFrom = function (otherWorkload) {
    if (_.isEmpty(this.rawResource.spec.ingress)) {
        return false
    }
    for (idx in this.rawResource.spec.ingress) {
        var ingressRule = this.rawResource.spec.ingress[idx]
        if (_.isEmpty(ingressRule.from)) {
            continue
        }
        for (iidx in ingressRule.from) {
            var fromRule = ingressRule.from[iidx]
            if (!_.isEmpty(fromRule.ipBlock)) {
                if (!_.some(_.map(otherWorkload.cidrs(), function (workloadCidr) { return cidrMatches(workloadCidr, fromRule.ipBlock.cidr) }))) {
                    continue
                }
            }
            if (_.isEmpty(fromRule.namespaceSelector)) {
                if (_.isEmpty(fromRule.podSelector)) {
                    return true
                }
                if (isSubset(fromRule.podSelector.matchLabels, otherWorkload.labels())) {
                    return true
                }
            } else {
                if (_.isEmpty(fromRule.podSelector)) {
                    if (isSubset(fromRule.namespaceSelector.matchLabels, otherWorkload.namespaceLabels())) {
                        return true
                    }
                }
                if (isSubset(
                    fromRule.namespaceSelector.matchLabels, otherWorkload.namespaceLabels()
                ) && isSubset(fromRule.podSelector.matchLabels, otherWorkload.labels())) {
                    return true
                }
            }
        }
    }

    return false
}

NetworkPolicy.prototype.allowsConnectionsTo = function (otherWorkload) {
    if (_.isEmpty(this.rawResource.spec.egress)) {
        return false
    }
    for (idx in this.rawResource.spec.egress) {
        var egressRule = this.rawResource.spec.egress[idx]
        if (_.isEmpty(egressRule.to)) {
            continue
        }
        for (iidx in egressRule.to) {
            var toRule = egressRule.to[iidx]
            if (!_.isEmpty(toRule.ipBlock)) {
                if (!_.some(_.map(otherWorkload.cidrs(), function (workloadCidr) { return cidrMatches(workloadCidr, toRule.ipBlock.cidr) }))) {
                    continue
                }
            }
            if (_.isEmpty(toRule.namespaceSelector)) {
                if (_.isEmpty(toRule.podSelector)) {
                    return true
                }
                if (isSubset(toRule.podSelector.matchLabels, otherWorkload.labels())) {
                    return true
                }
            } else {
                if (_.isEmpty(toRule.podSelector)) {
                    if (isSubset(toRule.namespaceSelector.matchLabels, otherWorkload.namespaceLabels())) {
                        return true
                    }
                }
                if (isSubset(
                    toRule.namespaceSelector.matchLabels, otherWorkload.namespaceLabels()
                ) && isSubset(toRule.podSelector.matchLabels, otherWorkload.labels())) {
                    return true
                }
            }
        }
    }

    return false
}



function Namespace(rawResource) {
    this.rawResource = rawResource
}

Namespace.prototype.name = function () {
    return this.rawResource.metadata.name
}

Namespace.prototype.labels = function () {
    return this.rawResource.metadata.labels || {}
}


function ConnectionBuilder(resources) {
    this.resources = resources;
    this.policies = _.map(
        _.filter(rsc, function (item) { return item.kind == "NetworkPolicy" }),
        function (rawResource) { return new NetworkPolicy(rawResource) }
    )

    this.namespaces = _.object(_.map(
        _.filter(rsc, function (item) { return item.kind == "Namespace" }),
        function (rawResource) {
            var theNs = new Namespace(rawResource);
            return [theNs.name(), theNs]
        }
    ))
    var that = this;
    var matchBuilder = new WorkloadPolicyMatchBuilder(this.policies)
    this.workloadPolicyMatches = _.map(
        _.filter(rsc, function (item) {
            return _.contains([
                "Deployment",
                "StatefulSet",
                "Job",
                "DaemonSet",
                "CronJob",
                "Pod",
            ], item.kind)
        }),
        function (rawResource) {
            if(rawResource.kind == "CronJob"){
                console.log(rawResource)
            }
            return matchBuilder.buildFor(
                new Workload(rawResource, that.namespaces[rawResource.metadata.namespace])
            )
        }
    )
    // Generate VirtualWorkloads out of policy definitions
    var allAddresses = []
    _.each(this.policies, function (policy) {
        allAddresses = _.union(allAddresses, policy.externalAddresses())
    })
    _.each(allAddresses, function (address) {
        that.workloadPolicyMatches.push(
            new WorkloadPolicyMatch(
                new VirtualWorkload(
                    [address]
                ),
                []
            )
        )
    })
}

ConnectionBuilder.prototype.nodes = function () {
    return _.map(this.workloadPolicyMatches, function (item) {
        return {
            "id": item.workload.id(),
            "type": item.hasAtLeastOnePolicyAttached() ? "ok" : "error"
        }
    })
}


ConnectionBuilder.prototype.links = function () {
    var allLinks = []
    var that = this
    _.each(this.workloadPolicyMatches, function (source) {
        _.each(that.workloadPolicyMatches, function (target) {
            if (target.workload.id() == source.workload.id()) {
                return
            }
            if (target.isExternal() && source.isExternal()) {
                return
            }
            if (
                target.hasAtLeastOnePolicyAttached() ||
                (target.isExternal() && source.hasAtLeastOnePolicyAttached()) ||
                (!target.hasAtLeastOnePolicyAttached() && source.hasAtLeastOnePolicyAttached())
            ) {
                if (
                    target.allowsConnectionsFrom(source.workload)
                    && source.allowsConnectionsTo(target.workload)
                ) {
                    allLinks.push({
                        "target": target.workload.id(),
                        "source": source.workload.id(),
                        "type": "normal",
                        "sourceWorkloadMatch": source,
                        "sourceRelatedPolicies": source.getPoliciesThatAllowConnectionsTo(target.workload),
                        "targetRelatedPolicies": target.getPoliciesThatAllowConnectionsFrom(source.workload),
                        "targetWorkloadMatch": target,
                    })
                }
            }

        })
    })
    return allLinks
}

function WorkloadPolicyMatch(workload, policies) {
    this.workload = workload
    this.policies = policies
}

WorkloadPolicyMatch.prototype.hasAtLeastOnePolicyAttached = function () {
    return !_.isEmpty(this.policies)
}

WorkloadPolicyMatch.prototype.isExternal = function () {
    return !_.isEmpty(this.workload.cidrs())
}

WorkloadPolicyMatch.prototype.getPoliciesThatAllowConnectionsFrom = function (otherWorkload) {
    allThatAllow = []
    for (idx in this.policies) {
        var policy = this.policies[idx]
        if (policy.allowsConnectionsFrom(otherWorkload)) {
            allThatAllow.push(policy)
        }
    }
    return allThatAllow
}

WorkloadPolicyMatch.prototype.allowsConnectionsFrom = function (otherWorkload) {
    if (!this.hasAtLeastOnePolicyAttached()) {
        return true
    }
    return !_.isEmpty(this.getPoliciesThatAllowConnectionsFrom(otherWorkload))
}


WorkloadPolicyMatch.prototype.getPoliciesThatAllowConnectionsTo = function (otherWorkload) {
    allThatAllow = []
    for (idx in this.policies) {
        var policy = this.policies[idx]
        if (policy.allowsConnectionsTo(otherWorkload)) {
            allThatAllow.push(policy)
        }
    }
    return allThatAllow
}

WorkloadPolicyMatch.prototype.allowsConnectionsTo = function (otherWorkload) {
    if (!this.hasAtLeastOnePolicyAttached()) {
        return true
    }
    return !_.isEmpty(this.getPoliciesThatAllowConnectionsTo(otherWorkload))
}

function WorkloadPolicyMatchBuilder(policies) {
    this.policies = policies
}

WorkloadPolicyMatchBuilder.prototype.buildFor = function (workload) {
    return new WorkloadPolicyMatch(
        workload,
        _.filter(this.policies, function (policy) {
            return policy.appliesTo(workload)
        })
    )
}

var rsc = null
function chart(resources) {
    rsc = resources

    builder = new ConnectionBuilder(resources)

    var data = {
        "nodes": builder.nodes(),
        "links": builder.links()
    }


    var types = Array.from(new Set(data.links.map(d => d.type)))
    var color = d3.scaleOrdinal(types, d3.schemeCategory10);

    const links = data.links.map(d => Object.create(d));
    const nodes = data.nodes.map(d => Object.create(d));

    function linkMouseovered(active) {
        return function (event, d) {
            if (
                active
            ) {
                d3.select(this)
                    .attr("stroke-width", 3)
                    .style("cursor", "pointer")
                    .attr("stroke", "#bb8082")
            } else {
                d3.select(this)
                    .attr("stroke-width", 1.5)
                    .style("cursor", "default")
                    .attr("stroke", "#046582")
            }
        };
    }


    function pointMouseOvered(active) {
        return function (event, d) {
            if (
                active
            ) {
                d3.select(this)
                    .style("cursor", "pointer")
            } else {
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
    // Per-type markers, as they don't inherit styles.
    drawingBoard.append("defs").selectAll("marker")
        .data(types)
        .join("marker")
        .attr("id", d => `arrow-${d}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 15)
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
        .attr("marker-end", d => `url(${new URL(`#arrow-${d.type}`, location)})`)
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
        .on("mouseover", pointMouseOvered(true))
        .on("mouseout", pointMouseOvered(false));

    node.append("circle")
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
