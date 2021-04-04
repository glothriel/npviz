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

function ConnectionBuilder(resources) {
    this.resources = resources;
    this.policies = _.map(
        _.filter(resources, function (item) { return item.kind == "NetworkPolicy" }),
        function (rawResource) { return new NetworkPolicy(rawResource) }
    )

    this.namespaces = _.object(_.map(
        _.filter(resources, function (item) { return item.kind == "Namespace" }),
        function (rawResource) {
            var theNs = new Namespace(rawResource);
            return [theNs.name(), theNs]
        }
    ))
    var that = this;
    var matchBuilder = new WorkloadPolicyMatchBuilder(this.policies)
    this.workloadPolicyMatches = _.map(
        _.filter(resources, function (item) {
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