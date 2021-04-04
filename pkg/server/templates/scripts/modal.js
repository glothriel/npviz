function AccordionBuilder(name){
    this.name = name
    this.elements = []
}

AccordionBuilder.prototype.add = function(id, title, content){
    this.elements.push({
        "id": id.replace("/", "-"),
        "title": title,
        "content": content
    })
}


AccordionBuilder.prototype.render = function(id, title, content){
    var html = `<div class="accordion accordion-flush" id="${this.name}">`
    _.each(this.elements, function(element){
        html += `<div class="accordion-item">
        <h2 class="accordion-header" id="${element.id}">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${element.id}-collapseOne" aria-expanded="false" aria-controls="${element.id}-collapseOne">
            ${element.title}
          </button>
        </h2>
        <div id="${element.id}-collapseOne" class="accordion-collapse collapse" aria-labelledby="${element.id}" data-bs-parent="#${element.id}">
          <div class="accordion-body">${element.content}</div>
        </div>
      </div>`
    })
    html += `</div>`
    return html
}

function ListBuilder(name){
    this.name = name
    this.elements = []
}


ListBuilder.prototype.add = function(id){
    this.elements.push({
        "id": id
    })
}


ListBuilder.prototype.render = function(){
    var html = `<div class="list-group" id="${this.name}">`
    _.each(this.elements, function(element){
        html += `<a href="#" class="list-group-item list-group-item-action">${element.id}</a>`
    })
    html += `</div>`
    return html
}



function drawLinksModal(d){
    $("#modal .modal-title").html(
        d.sourceWorkloadMatch.workload.id() + " -> " + d.targetWorkloadMatch.workload.id()
    )
    var sourceAccordion = new AccordionBuilder("source-network-policies")
    if(!_.isEmpty(d.sourceWorkloadMatch.workload.labels())){
        sourceAccordion.add("source-own-labels", "Pod labels", `<pre>${jsyaml.dump(d.sourceWorkloadMatch.workload.labels(), null, 2)}</pre>`)
    }
    if(!_.isEmpty(d.sourceWorkloadMatch.workload.namespaceLabels())){
        sourceAccordion.add("source-ns-labels", `Namespace ${d.sourceWorkloadMatch.workload.namespaceName()} labels`, `<pre>${jsyaml.dump(d.sourceWorkloadMatch.workload.namespaceLabels(), null, 2)}</pre>`)
    }
    _.each(d.sourceRelatedPolicies, function(policy){
        sourceAccordion.add("source-" + policy.id(), "NetworkPolicy " + policy.name(), `<pre>${jsyaml.dump(policy.rawResource.spec, null, 2)}</pre>`)
    })


    var targetAccordion = new AccordionBuilder("target-network-policies")
    if(!_.isEmpty(d.targetWorkloadMatch.workload.labels())){
        targetAccordion.add("target-own-labels", "Pod labels", `<pre>${jsyaml.dump(d.targetWorkloadMatch.workload.labels(), null, 2)}</pre>`)
    }
    if(!_.isEmpty(d.targetWorkloadMatch.workload.namespaceLabels())){
        targetAccordion.add("target-ns-labels", `Namespace ${d.targetWorkloadMatch.workload.namespaceName()} labels`, `<pre>${jsyaml.dump(d.targetWorkloadMatch.workload.namespaceLabels(), null, 2)}</pre>`)
    }
    _.each(d.targetRelatedPolicies, function(policy){
        targetAccordion.add("target-" + policy.id(), "NetworkPolicy " + policy.name(), `<pre>${jsyaml.dump(policy.rawResource.spec, null, 2)}</pre>`)
    })

    $("#modal .modal-body").html(
        `<div class="row justify-content-start">
       <div class="col-sm-6">
        <h4>${d.sourceWorkloadMatch.workload.id()}</h4>
        <hr/>
        ${sourceAccordion.render()}
       </div>
       <div class="col-sm-6">
        <h4>${d.targetWorkloadMatch.workload.id()}</h4>
        <hr/>
        ${targetAccordion.render()}
     </div>`
    )
    var myModal = new bootstrap.Modal(document.getElementById('modal'))
    myModal.show()
}

function NodeSearcher(rawNodes, drawnNodes){
    this.rawNodes = rawNodes
    this.drawnNodes = drawnNodes
}

NodeSearcher.prototype.getById = function(theId){
    lastId = null
    _.find(this.drawnNodes, function(elem, idx){ lastId = idx; return elem.index == theId });
    return this.rawNodes[lastId]
}

function drawNodeModalClosure(rawNodes, nodes, allLinks){
    searcher = new NodeSearcher(rawNodes, nodes)
    return function drawNodeModal(event, nodeId){

        incoming = _.map(_.filter(allLinks, function(link){
            return link.target.index == nodeId
        }), function(item){ return searcher.getById(item.source.index)})
        outgoing = _.map(_.filter(allLinks, function(link){
            return link.source.index == nodeId
        }), function(item){ return searcher.getById(item.target.index)})

        var sourceList = new ListBuilder("source")
        _.each(incoming, function(item){sourceList.add(item.id)})
        var targetList = new ListBuilder("target")
        _.each(outgoing, function(item){targetList.add(item.id)})

        $("#modal .modal-title").html(
            searcher.getById(nodeId).id
        )
        console.log(searcher.getById(nodeId).id)
        console.log($("#modal .modal-title"))

        $("#modal .modal-body").html(
            `<div class="row justify-content-start">
        <div class="col-sm-6">
            <h4>Incoming connections</h4>
            <hr/>
            ${sourceList.render()}
        </div>
        <div class="col-sm-6">
            <h4>Outgoing connections</h4>
            <hr/>
            ${targetList.render()}
        </div>`
        )
        var myModal = new bootstrap.Modal(document.getElementById('modal'))
        myModal.show()

    }
}