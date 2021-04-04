
function Namespace(rawResource) {
    this.rawResource = rawResource
}

Namespace.prototype.name = function () {
    return this.rawResource.metadata.name
}

Namespace.prototype.labels = function () {
    return this.rawResource.metadata.labels || {}
}