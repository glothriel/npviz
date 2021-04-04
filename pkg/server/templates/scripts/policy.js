
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


