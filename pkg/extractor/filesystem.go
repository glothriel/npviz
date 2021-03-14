package extractor

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v2"
)

// RecursiveFilesystemExtractor scans infra directory for kubernetes resources
type recursiveFilesystemExtractor struct {
	directory string
	filter    filter
}

// Extract implements Extractor
func (ext recursiveFilesystemExtractor) Extract() ([]map[string]interface{}, error) {
	allObjects := []map[string]interface{}{}
	walkErr := filepath.Walk(ext.directory,
		func(path string, info os.FileInfo, err error) error {
			if strings.HasSuffix(path, ".yml") || strings.HasSuffix(path, ".yaml") {
				theFile, fileReadErr := ioutil.ReadFile(path)
				if fileReadErr != nil {
					return fileReadErr
				}
				yamlCandidates := strings.Split(string(theFile), "---\n")
				for _, yamlCandidate := range yamlCandidates {
					var yamlFile interface{}
					unmarshalErr := yaml.Unmarshal([]byte(yamlCandidate), &yamlFile)
					if unmarshalErr != nil {
						return unmarshalErr
					}
					if yamlFile == nil {
						continue
					}
					decodedResource := (yaml2JsonInterface(yamlFile)).(map[string]interface{})
					if ext.filter.isValid(decodedResource) {
						allObjects = append(allObjects, decodedResource)
					}
				}
			}
			return nil
		})
	return allObjects, walkErr
}

// yaml2JsonInterface solves problem with translating output of yaml.Unmarshal to a format acceptable by json.Marshal
// more info here: https://stackoverflow.com/questions/40737122/convert-yaml-to-json-without-struct
func yaml2JsonInterface(i interface{}) interface{} {
	switch x := i.(type) {
	case map[interface{}]interface{}:
		m2 := map[string]interface{}{}
		for k, v := range x {
			m2[k.(string)] = yaml2JsonInterface(v)
		}
		return m2
	case []interface{}:
		for i, v := range x {
			x[i] = yaml2JsonInterface(v)
		}
	}
	return i
}

// NewFilesystemResourceExtractor creates RecursiveFilesystemExtractor instances
func NewFilesystemResourceExtractor(directory string) Extractor {
	return recursiveFilesystemExtractor{
		directory: directory,
		filter:    filterOnlyResourcesDirectlyRelatedToNetworkPolicies(),
	}
}
