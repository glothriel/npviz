package extractor

// Extractor provides a list of kubernetes resources
type Extractor interface {
	Extract() ([]map[string]interface{}, error)
}
