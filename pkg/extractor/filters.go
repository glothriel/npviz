package extractor

type filter interface {
	isValid(map[string]interface{}) bool
}

type allowOnlySpecificKinds struct {
	kinds []string
}

func (filter allowOnlySpecificKinds) isValid(resource map[string]interface{}) bool {
	resourceKind, ok := resource["kind"].(string)
	if !ok {
		return false
	}
	for _, allowedKind := range filter.kinds {
		if allowedKind == resourceKind {
			return true
		}
	}
	return false
}

type filterDenySpecificNamespaces struct {
	namespaces []string
}

func (filter filterDenySpecificNamespaces) isValid(resource map[string]interface{}) bool {
	metadata, ok := resource["metadata"].(map[string]interface{})
	if !ok {
		return false
	}
	resourceNamespace, ok := metadata["namespace"].(string)
	if !ok {
		return true
	}
	for _, deniedNamespace := range filter.namespaces {
		if deniedNamespace == resourceNamespace {
			return false
		}
	}
	return true
}

func filterOnlyResourcesDirectlyRelatedToNetworkPolicies() filter {
	return filterChain{
		children: []filter{
			allowOnlySpecificKinds{
				kinds: []string{
					"Deployment",
					"StatefulSet",
					"DaemonSet",
					"Job",
					"CronJob",
					"Pod",
					"Namespace",
					"NetworkPolicy",
				},
			},
		},
	}
}

type filterChain struct {
	children []filter
}

func (filter filterChain) isValid(resource map[string]interface{}) bool {
	for _, child := range filter.children {
		if !child.isValid(resource) {
			return false
		}
	}
	return true
}
