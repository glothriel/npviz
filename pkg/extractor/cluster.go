package extractor

import (
	"bytes"
	"encoding/json"
	"os/exec"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

// liveClusterExtractor connects to live cluster using current kubectl context and extracts related resources from there
type liveClusterExtractor struct {
}

// Extract implements Extractor
func (ext liveClusterExtractor) Extract() ([]map[string]interface{}, error) {
	allObjects := []map[string]interface{}{}
	runner := &kubectlRunner{}
	for _, kind := range []string{
		"namespace",
		"pod",
		"networkpolicy",
	} {
		resources, getErr := runner.List(kind)
		if getErr != nil {
			return allObjects, errors.Wrapf(getErr, "failed to get %s using kubectl", kind)
		}
		allObjects = append(allObjects, resources...)
	}
	return allObjects, nil
}

type kubectlRunner struct {
}

func (runner *kubectlRunner) List(kind string) ([]map[string]interface{}, error) {
	result := map[string]interface{}{}
	finalResult := []map[string]interface{}{}
	theCommand := []string{
		"get",
		kind,
		"-A",
		"-o",
		"json",
	}
	var stdoutBuf bytes.Buffer
	var stderrBuf bytes.Buffer
	command := exec.Command("kubectl", theCommand...)
	command.Stdout = &stdoutBuf
	command.Stderr = &stderrBuf
	logrus.WithFields(map[string]interface{}{
		"command": command.String(),
	}).Info("Running `kubectl get`")
	commandErr := command.Run()
	if commandErr != nil {
		stdoutContent := stdoutBuf.String()
		if len(stdoutContent) > 0 {
			logrus.Error(stdoutContent)
		}
		logrus.Error(stderrBuf.String())
		return finalResult, commandErr
	}
	unmarshalErr := json.Unmarshal(stdoutBuf.Bytes(), &result)
	if unmarshalErr != nil {
		return finalResult, unmarshalErr
	}
	for _, singleItem := range result["items"].([]interface{}) {
		finalResult = append(finalResult, singleItem.(map[string]interface{}))
	}
	return finalResult, nil
}

// NewClusterResourceExtractor creates liveClusterExtractor instances
func NewClusterResourceExtractor() Extractor {
	return liveClusterExtractor{}
}
