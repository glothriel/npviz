
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
